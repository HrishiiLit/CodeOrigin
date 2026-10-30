import io
import pytest
from app.services.storage_service import storage_service
from app.core.errors import StorageSecurityError


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
    # Non UTF-8 binary bytes
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


def test_upload_with_fixtures_and_parent_revision(client):
    from pathlib import Path
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

