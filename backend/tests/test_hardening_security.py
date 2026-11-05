import io
import os
import tarfile
import zipfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.errors import StorageSecurityError
from app.main import app
from app.services.storage_service import storage_service
from app.services.submission_service import submission_service

client = TestClient(app)


# -----------------------------------------------------------------------------
# 1. Path Traversal & Archive Hardening (Zip Slip, Tar Traversal, Filename)
# -----------------------------------------------------------------------------

def test_upload_filename_traversal_sanitized():
    """Verify that path traversal in uploaded filename is stripped to basename and isolated."""
    code = b"def harmless():\n    return 42\n"
    malicious_filename = "../../../evil_traversal.py"

    response = client.post(
        "/api/v1/submissions",
        files={"file": (malicious_filename, io.BytesIO(code), "text/x-python")},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["original_filename"] == "evil_traversal.py"
    assert ".." not in data["original_filename"]

    # Verify physical file is safely stored under storage/uploads
    sub_doc = submission_service.repo.find_by_id(data["submission_id"])
    assert sub_doc is not None
    saved_path = storage_service.get_file_path(sub_doc["storage_key"])
    assert saved_path.is_file()
    assert saved_path.is_relative_to(settings.resolved_storage_dir)


def test_zip_slip_vulnerability_blocked():
    """Verify that ZIP archives containing path traversal entries ('../') are rejected with 400."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("../../escaped_payload.py", "print('hacked')")
        zf.writestr("normal.py", "print('safe')")
    zip_bytes = buf.getvalue()

    response = client.post(
        "/api/v1/submissions",
        files={"file": ("malicious_slip.zip", io.BytesIO(zip_bytes), "application/zip")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "STORAGE_SECURITY_VIOLATION"


def test_zip_absolute_path_blocked():
    """Verify that ZIP archives containing absolute slash paths are rejected."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("/etc/escaped.py", "print('root escaped')")
    zip_bytes = buf.getvalue()

    response = client.post(
        "/api/v1/submissions",
        files={"file": ("absolute_slip.zip", io.BytesIO(zip_bytes), "application/zip")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "STORAGE_SECURITY_VIOLATION"


def test_tar_traversal_blocked():
    """Verify that tar.gz archives containing traversal entries are rejected."""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        tinfo = tarfile.TarInfo(name="../../escaped_tar.py")
        content = b"print('tar hacked')"
        tinfo.size = len(content)
        tf.addfile(tinfo, io.BytesIO(content))
    tar_bytes = buf.getvalue()

    response = client.post(
        "/api/v1/submissions",
        files={"file": ("malicious_tar.tar.gz", io.BytesIO(tar_bytes), "application/gzip")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "STORAGE_SECURITY_VIOLATION"


def test_tar_symlink_blocked():
    """Verify that tar archives with symlinks pointing outside are rejected."""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        tinfo = tarfile.TarInfo(name="symlink_link.py")
        tinfo.type = tarfile.SYMTYPE
        tinfo.linkname = "/etc/passwd"
        tf.addfile(tinfo)
    tar_bytes = buf.getvalue()

    response = client.post(
        "/api/v1/submissions",
        files={"file": ("symlink_archive.tar.gz", io.BytesIO(tar_bytes), "application/gzip")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "STORAGE_SECURITY_VIOLATION"


def test_corrupted_zip_archive_rejection():
    """Verify that malformed/corrupted ZIP archives are rejected with 400 MALFORMED_ARCHIVE."""
    corrupted_bytes = b"NOT_A_VALID_ZIP_ARCHIVE_DATA_123456789"
    response = client.post(
        "/api/v1/submissions",
        files={"file": ("corrupted.zip", io.BytesIO(corrupted_bytes), "application/zip")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "MALFORMED_ARCHIVE"


def test_corrupted_tar_archive_rejection():
    """Verify that malformed/corrupted TAR archives are rejected with 400 MALFORMED_ARCHIVE."""
    corrupted_bytes = b"\x1f\x8b\x08\x00NOT_VALID_GZIP_CONTENT"
    response = client.post(
        "/api/v1/submissions",
        files={"file": ("corrupted.tar.gz", io.BytesIO(corrupted_bytes), "application/gzip")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "MALFORMED_ARCHIVE"


# -----------------------------------------------------------------------------
# 2. Upload Validation Boundaries (Empty, Oversized, Invalid Type, Non-UTF8)
# -----------------------------------------------------------------------------

def test_empty_file_rejected():
    """Verify that empty uploads (0 bytes) return 400 EMPTY_FILE."""
    response = client.post(
        "/api/v1/submissions",
        files={"file": ("empty.py", io.BytesIO(b""), "text/x-python")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "EMPTY_FILE"


def test_unsupported_extension_rejected():
    """Verify that non-python and non-archive extensions (.exe, .sh, .pdf) are rejected."""
    for bad_name in ["binary.exe", "script.sh", "doc.pdf", "data.json"]:
        response = client.post(
            "/api/v1/submissions",
            files={"file": (bad_name, io.BytesIO(b"dummy binary data"), "application/octet-stream")},
        )
        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "INVALID_FILE_TYPE"


def test_oversized_file_rejected():
    """Verify that payloads exceeding MAX_UPLOAD_SIZE_MB return 413 FILE_TOO_LARGE."""
    # Temporarily mock MAX_UPLOAD_SIZE_MB to 1MB
    with patch.object(settings, "MAX_UPLOAD_SIZE_MB", 1):
        big_content = b"a = 1\n" * 300_000  # ~1.8 MB
        response = client.post(
            "/api/v1/submissions",
            files={"file": ("large_file.py", io.BytesIO(big_content), "text/x-python")},
        )
        assert response.status_code == 413
        data = response.json()
        assert data["error"]["code"] == "FILE_TOO_LARGE"


def test_invalid_utf8_encoding_rejected():
    """Verify that Python files with invalid UTF-8 byte sequences are rejected."""
    bad_bytes = b"def test():\n    return '\xff\xfe\x00\x00'"
    response = client.post(
        "/api/v1/submissions",
        files={"file": ("bad_encoding.py", io.BytesIO(bad_bytes), "text/x-python")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "INVALID_ENCODING"


# -----------------------------------------------------------------------------
# 3. Source & Download Query Path Traversal Hardening
# -----------------------------------------------------------------------------

def test_source_endpoint_path_traversal_blocked():
    """Verify that GET /submissions/{id}/source?path=../../etc/passwd is blocked."""
    # 1. Create a valid repo submission
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("main.py", "print('hello world')")
    
    upload_res = client.post(
        "/api/v1/submissions",
        files={"file": ("repo_test.zip", io.BytesIO(buf.getvalue()), "application/zip")},
    )
    assert upload_res.status_code == 201
    sub_id = upload_res.json()["submission_id"]

    # 2. Try to traverse path
    res = client.get(f"/api/v1/submissions/{sub_id}/source?path=../../etc/passwd")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "STORAGE_SECURITY_VIOLATION"


def test_download_endpoint_path_traversal_blocked():
    """Verify that GET /submissions/{id}/download?path=../../windows/win.ini is blocked."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("app.py", "x = 10")
    
    upload_res = client.post(
        "/api/v1/submissions",
        files={"file": ("download_test.zip", io.BytesIO(buf.getvalue()), "application/zip")},
    )
    assert upload_res.status_code == 201
    sub_id = upload_res.json()["submission_id"]

    res = client.get(f"/api/v1/submissions/{sub_id}/download?path=../../windows/win.ini")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "STORAGE_SECURITY_VIOLATION"


def test_storage_service_direct_key_traversal_rejected():
    """Directly test that storage_service._resolve_safe_path raises on illegal traversal keys."""
    with pytest.raises(StorageSecurityError):
        storage_service._resolve_safe_path("../../secret_directory")

    with pytest.raises(StorageSecurityError):
        storage_service._resolve_safe_path("uploads/../../../etc/shadow")


# -----------------------------------------------------------------------------
# 4. Execution Protection (Student code is never executed) & Security Findings
# -----------------------------------------------------------------------------

def test_static_analysis_never_executes_malicious_code():
    """
    Verify that dangerous code patterns (os.system, subprocess, eval)
    are parsed statically WITHOUT executing on the host, and flagged by analyzers.
    """
    marker_file = settings.resolved_storage_dir / "HACKED_MARKER.txt"
    if marker_file.exists():
        marker_file.unlink()

    # If code were executed, marker_file would be created
    malicious_code = f"""
import os
import subprocess

# Malicious payload attempt
marker_path = r"{marker_file}"
try:
    with open(marker_path, "w") as f:
        f.write("COMPROMISED")
except Exception:
    pass

def dangerous_eval(expr):
    return eval(expr)

def dangerous_exec(cmd):
    return os.system(cmd)
""".encode("utf-8")

    upload_res = client.post(
        "/api/v1/submissions",
        files={"file": ("malicious_script.py", io.BytesIO(malicious_code), "text/x-python")},
    )
    assert upload_res.status_code == 201
    sub_id = upload_res.json()["submission_id"]

    # Trigger analysis
    analysis_res = client.post(f"/api/v1/submissions/{sub_id}/analyze")
    assert analysis_res.status_code == 200
    data = analysis_res.json()

    # 1. Verify marker file was NEVER created (proof of zero runtime execution)
    assert not marker_file.exists(), "CRITICAL: Malicious student code was executed on host!"

    # 2. Verify security tools flagged findings (Bandit or AST flags eval / os.system)
    findings = data["findings"]
    rules = [f["rule_id"] for f in findings]
    tools = {f["tool"] for f in findings}

    assert "bandit" in tools or "ast" in tools
    # Bandit flags B307 (eval), B605/B607 (os.system/shell), B404 (import subprocess)
    assert any("B307" in r or "B605" in r or "B404" in r or "AST_" in r for r in rules)


# -----------------------------------------------------------------------------
# 5. Fault Tolerance & Graceful Analyzer Degradation
# -----------------------------------------------------------------------------

def test_analyzer_failure_gracefully_handled():
    """Verify that if one analyzer fails/crashes, the other analyzers still complete and report."""
    code = b"import math\ndef compute():\n    return math.sqrt(16)\n"
    upload_res = client.post(
        "/api/v1/submissions",
        files={"file": ("graceful_test.py", io.BytesIO(code), "text/x-python")},
    )
    assert upload_res.status_code == 201
    sub_id = upload_res.json()["submission_id"]

    # Simulate bandit raising an unhandled exception
    from app.services.analysis_service import analysis_service
    with patch.object(analysis_service.bandit_analyzer, "analyze", side_effect=RuntimeError("Simulated Bandit crash")):
        analysis_res = client.post(f"/api/v1/submissions/{sub_id}/analyze")
        assert analysis_res.status_code == 200
        data = analysis_res.json()
        assert data["status"] == "completed"
        # AST and Ruff still worked
        assert "ast" in data["tool_versions"]
        assert "ruff" in data["tool_versions"]


# -----------------------------------------------------------------------------
# 6. Access Control & Human Approval Enforcement
# -----------------------------------------------------------------------------

def test_github_issue_creation_requires_explicit_confirmation():
    """Verify that POST /integrations/github/issues fails if confirmed is false."""
    payload = {
        "submission_id": "dummy-sub-id",
        "repository": "owner/repo",
        "title": "Security Issue",
        "body": "Detailed report",
        "confirmed": False,  # Not approved
    }
    response = client.post("/api/v1/integrations/github/issues", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "EXPLICIT_APPROVAL_REQUIRED"


def test_error_responses_never_leak_secrets():
    """Verify that standardized error responses follow schema and do not leak environment variables."""
    # Request a non-existent resource
    res = client.get("/api/v1/submissions/non-existent-uuid-1234")
    assert res.status_code == 404
    data = res.json()
    assert "error" in data
    assert "code" in data["error"]
    assert "message" in data["error"]
    assert "request_id" in data["error"]

    # Ensure no token or password substrings in response text
    content_str = res.text.lower()
    assert "password" not in content_str
    assert "secret" not in content_str
    assert "ghp_" not in content_str
