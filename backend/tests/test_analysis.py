import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app

fixtures_dir = Path(__file__).parent / "fixtures"


def test_analyze_simple_valid_file(client):
    with open(fixtures_dir / "valid_simple.py", "rb") as f:
        file_bytes = f.read()

    upload_res = client.post(
        "/api/v1/submissions",
        files={"file": ("valid_simple.py", io.BytesIO(file_bytes), "text/x-python")},
    )
    assert upload_res.status_code == 201
    sub_id = upload_res.json()["submission_id"]

    # Trigger analysis
    analyze_res = client.post(f"/api/v1/submissions/{sub_id}/analyze")
    assert analyze_res.status_code == 200
    data = analyze_res.json()

    assert data["submission_id"] == sub_id
    assert data["status"] == "completed"
    assert "ast" in data["tool_versions"]
    assert "ruff" in data["tool_versions"]
    assert "radon" in data["tool_versions"]
    assert "bandit" in data["tool_versions"]
    assert "summary" in data

    # Retrieve analysis
    get_res = client.get(f"/api/v1/submissions/{sub_id}/analysis")
    assert get_res.status_code == 200
    assert get_res.json()["analysis_id"] == data["analysis_id"]


def test_analyze_unused_imports(client):
    with open(fixtures_dir / "unused_import.py", "rb") as f:
        file_bytes = f.read()

    upload_res = client.post(
        "/api/v1/submissions",
        files={"file": ("unused_import.py", io.BytesIO(file_bytes), "text/x-python")},
    )
    sub_id = upload_res.json()["submission_id"]

    analyze_res = client.post(f"/api/v1/submissions/{sub_id}/analyze")
    assert analyze_res.status_code == 200
    data = analyze_res.json()

    findings = data["findings"]
    # Check that Ruff or AST flagged unused imports (os or sys)
    ruff_findings = [f for f in findings if f["tool"] == "ruff"]
    assert len(ruff_findings) >= 1
    assert any("F401" in f["rule_id"] or "unused" in f["message"].lower() for f in ruff_findings)


def test_analyze_security_issues(client):
    with open(fixtures_dir / "security_pattern.py", "rb") as f:
        file_bytes = f.read()

    upload_res = client.post(
        "/api/v1/submissions",
        files={"file": ("security_pattern.py", io.BytesIO(file_bytes), "text/x-python")},
    )
    sub_id = upload_res.json()["submission_id"]

    analyze_res = client.post(f"/api/v1/submissions/{sub_id}/analyze")
    assert analyze_res.status_code == 200
    data = analyze_res.json()

    findings = data["findings"]
    bandit_findings = [f for f in findings if f["tool"] == "bandit"]
    assert len(bandit_findings) >= 1
    assert any("B602" in f["rule_id"] or "B404" in f["rule_id"] or "subprocess" in f["message"].lower() for f in bandit_findings)


def test_analyze_high_complexity(client):
    with open(fixtures_dir / "high_complexity.py", "rb") as f:
        file_bytes = f.read()

    upload_res = client.post(
        "/api/v1/submissions",
        files={"file": ("high_complexity.py", io.BytesIO(file_bytes), "text/x-python")},
    )
    sub_id = upload_res.json()["submission_id"]

    analyze_res = client.post(f"/api/v1/submissions/{sub_id}/analyze")
    assert analyze_res.status_code == 200
    data = analyze_res.json()

    findings = data["findings"]
    radon_findings = [f for f in findings if f["tool"] == "radon"]
    assert len(radon_findings) >= 1
    assert radon_findings[0]["category"] == "complexity"


def test_analyze_syntax_error(client):
    with open(fixtures_dir / "syntax_error.py", "rb") as f:
        file_bytes = f.read()

    upload_res = client.post(
        "/api/v1/submissions",
        files={"file": ("syntax_error.py", io.BytesIO(file_bytes), "text/x-python")},
    )
    sub_id = upload_res.json()["submission_id"]

    analyze_res = client.post(f"/api/v1/submissions/{sub_id}/analyze")
    assert analyze_res.status_code == 200
    data = analyze_res.json()

    findings = data["findings"]
    syntax_findings = [f for f in findings if "syntax" in f["message"].lower() or "syntax" in f["rule_id"].lower()]
    assert len(syntax_findings) >= 1
    assert syntax_findings[0]["severity"] == "error"
