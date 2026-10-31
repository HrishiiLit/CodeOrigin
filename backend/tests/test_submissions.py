import io
import zipfile
from pathlib import Path
from unittest.mock import AsyncMock, patch
import pytest

from app.core.errors import StorageSecurityError
from app.services.storage_service import storage_service


def test_upload_valid_python_file(client):
    code_content = b"def add(a, b):\n    return a + b\n"
    response = client.post(
        "/api/v1/submissions",
        files={"file": ("solution.py", io.BytesIO(code_content), "text/x-python")},
        data={"display_name": "Test Addition Module"},
    )
    assert response.status_code == 201
    data = response.json()
    assert "submission_id" in data
    assert "project_id" in data
    assert data["original_filename"] == "solution.py"
    assert data["language"] == "python"
    assert data["status"] == "queued"
    assert data["submission_type"] == "file"
    assert data["size_bytes"] == len(code_content)
    assert len(data["source_sha256"]) == 64

    # Fetch submission by ID
    sub_id = data["submission_id"]
    get_res = client.get(f"/api/v1/submissions/{sub_id}")
    assert get_res.status_code == 200
    assert get_res.json()["submission_id"] == sub_id

    # Fetch source code text
    source_res = client.get(f"/api/v1/submissions/{sub_id}/source")
    assert source_res.status_code == 200
    assert "def add(a, b):" in source_res.text


def test_upload_repository_zip_archive(client):
    # Construct an in-memory zip archive containing a repository tree
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("repo_sample/main.py", "print('hello world')\n")
        zf.writestr("repo_sample/utils/helpers.py", "def helper(): return True\n")
        zf.writestr("repo_sample/README.md", "# Test Repo\n")
    zip_bytes = zip_buffer.getvalue()

    response = client.post(
        "/api/v1/submissions",
        files={"file": ("project.zip", io.BytesIO(zip_bytes), "application/zip")},
        data={"display_name": "Full Project Archive"},
    )
    assert response.status_code == 201
    data = response.json()
    sub_id = data["submission_id"]
    assert data["submission_type"] == "repository"
    assert data["total_files"] == 3
    assert data["source_files_count"] == 2

    # Fetch repository tree
    tree_res = client.get(f"/api/v1/submissions/{sub_id}/tree")
    assert tree_res.status_code == 200
    tree_data = tree_res.json()
    assert tree_data["is_directory"] is True
    assert tree_data["total_files"] == 3
    assert len(tree_data["source_files"]) == 2

    # Fetch specific file from repository
    src_res = client.get(f"/api/v1/submissions/{sub_id}/source?path=utils/helpers.py")
    assert src_res.status_code == 200
    assert "def helper(): return True" in src_res.text


def test_github_repo_ingestion_mocked(client):
    # Mock GitHub service returning a zipball
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("HrishiiLit_CodeOrigin/app.py", "def run(): pass\n")
    mock_zip = zip_buffer.getvalue()

    with patch("app.api.routes.submissions.github_service.fetch_repository_archive", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = (mock_zip, "HrishiiLit_CodeOrigin_main.zip", "HrishiiLit/CodeOrigin (main)")

        response = client.post(
            "/api/v1/submissions/github",
            json={"repo_url": "https://github.com/HrishiiLit/CodeOrigin", "ref": "main"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["submission_type"] == "repository"
        assert data["original_filename"] == "HrishiiLit_CodeOrigin_main.zip"
        assert "app.py" in data["source_files"][0]


def test_list_submissions(client):
    code_content = b"print('Hello CodeOrigin')\n"
    client.post(
        "/api/v1/submissions",
        files={"file": ("hello.py", io.BytesIO(code_content), "text/x-python")},
    )

    response = client.get("/api/v1/submissions")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data
    assert data["total"] >= 1


def test_reject_invalid_extension(client):
    invalid_content = b"console.log('not python');"
    response = client.post(
        "/api/v1/submissions",
        files={"file": ("script.js", io.BytesIO(invalid_content), "application/javascript")},
    )
    assert response.status_code == 400
    err = response.json()["error"]
    assert err["code"] == "INVALID_FILE_TYPE"


def test_reject_empty_file(client):
    response = client.post(
        "/api/v1/submissions",
        files={"file": ("empty.py", io.BytesIO(b""), "text/x-python")},
    )
    assert response.status_code == 400
    err = response.json()["error"]
    assert err["code"] == "EMPTY_FILE"


def test_reject_invalid_encoding(client):
    bad_bytes = b"\xff\xfe\x00\x00def broken(): pass"
    response = client.post(
        "/api/v1/submissions",
        files={"file": ("corrupt.py", io.BytesIO(bad_bytes), "text/x-python")},
    )
    assert response.status_code == 400
    err = response.json()["error"]
    assert err["code"] == "INVALID_ENCODING"


def test_path_traversal_prevention():
    with pytest.raises(StorageSecurityError):
        storage_service._resolve_safe_path("../secret.py")

    with pytest.raises(StorageSecurityError):
        storage_service._resolve_safe_path("subdir/../../secret.py")


def test_zip_slip_prevention():
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("../../etc/passwd", "root:x:0:0:")
    
    with pytest.raises(StorageSecurityError):
        storage_service.extract_archive(zip_buffer.getvalue(), "malicious.zip")


def test_upload_with_fixtures_and_parent_revision(client):
    fixtures_dir = Path(__file__).parent / "fixtures"

    v1_path = fixtures_dir / "revision_v1.py"
    with open(v1_path, "rb") as f:
        v1_bytes = f.read()

    res1 = client.post(
        "/api/v1/submissions",
        files={"file": ("bubble_sort_v1.py", io.BytesIO(v1_bytes), "text/x-python")},
        data={"display_name": "Bubble Sort Base Revision"},
    )
    assert res1.status_code == 201
    sub1_data = res1.json()
    sub1_id = sub1_data["submission_id"]
    proj_id = sub1_data["project_id"]

    v2_path = fixtures_dir / "revision_v2.py"
    with open(v2_path, "rb") as f:
        v2_bytes = f.read()

    res2 = client.post(
        "/api/v1/submissions",
        files={"file": ("bubble_sort_v2.py", io.BytesIO(v2_bytes), "text/x-python")},
        data={
            "display_name": "Bubble Sort Optimized Revision",
            "project_id": proj_id,
            "parent_submission_id": sub1_id,
        },
    )
    assert res2.status_code == 201
    sub2_data = res2.json()
    assert sub2_data["project_id"] == proj_id
    assert sub2_data["parent_submission_id"] == sub1_id
