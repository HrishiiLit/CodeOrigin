import io
import os
import shutil
import zipfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings, find_project_root
from app.main import app
from app.services.storage_service import StorageService, storage_service


def test_centralized_storage_path_resolution():
    """Verify that storage resolution is identical regardless of execution directory."""
    root = find_project_root()
    assert (root / "storage").is_dir() or (root / "Storage").is_dir()
    assert settings.resolved_storage_dir.is_dir()
    assert (settings.resolved_storage_dir / "uploads").is_dir()
    assert (settings.resolved_storage_dir / "processed").is_dir()
    assert (settings.resolved_storage_dir / "generated").is_dir()


def test_file_complete_lifecycle():
    """
    Test full lifecycle:
    1. Upload a file
    2. Save it
    3. Verify physical location in intended storage/uploads
    4. Retrieve source code
    5. Download file
    6. Delete submission and verify file cleanup
    """
    client = TestClient(app)
    test_code = b"# File lifecycle verification test\ndef hello_lifecycle():\n    return 'success'\n"
    filename = "lifecycle_test.py"

    # 1. Upload file
    response = client.post(
        "/api/v1/submissions",
        files={"file": (filename, io.BytesIO(test_code), "text/x-python")},
        data={"display_name": "Lifecycle Verification"},
    )
    assert response.status_code == 201
    data = response.json()
    submission_id = data["submission_id"]

    # 2 & 3. Verify physical location is inside storage_service.uploads_dir and NOT inside backend source directory
    from app.services.submission_service import submission_service
    sub_doc = submission_service.repo.find_by_id(submission_id)
    assert sub_doc is not None
    storage_key = sub_doc["storage_key"]
    assert storage_key.startswith("uploads/")

    resolved_file = storage_service._resolve_safe_path(storage_key)
    assert resolved_file.exists()
    assert resolved_file.is_file()
    # Confirm it is inside settings.resolved_storage_dir and NOT backend/
    assert resolved_file.is_relative_to(settings.resolved_storage_dir)

    # 4. Retrieve source code
    source_res = client.get(f"/api/v1/submissions/{submission_id}/source")
    assert source_res.status_code == 200
    assert "hello_lifecycle" in source_res.text

    # 5. Download file
    download_res = client.get(f"/api/v1/submissions/{submission_id}/download")
    assert download_res.status_code == 200
    assert download_res.content == test_code

    # 6. Delete submission
    del_res = client.delete(f"/api/v1/submissions/{submission_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

    # Confirm physical file is removed
    assert not resolved_file.exists()


def test_archive_processed_storage_location():
    """Verify archive extraction stores repo into storage/processed/."""
    client = TestClient(app)
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w") as zf:
        zf.writestr("my_project/module.py", "def mod(): return 42\n")
    zip_bytes = zip_buf.getvalue()

    response = client.post(
        "/api/v1/submissions",
        files={"file": ("my_project.zip", io.BytesIO(zip_bytes), "application/zip")},
    )
    assert response.status_code == 201
    data = response.json()
    sub_id = data["submission_id"]

    from app.services.submission_service import submission_service
    sub_doc = submission_service.repo.find_by_id(sub_id)
    storage_key = sub_doc["storage_key"]
    assert storage_key.startswith("processed/")

    resolved_dir = storage_service._resolve_safe_path(storage_key)
    assert resolved_dir.is_dir()
    assert resolved_dir.is_relative_to(settings.resolved_storage_dir)

    # Download archive
    dl_res = client.get(f"/api/v1/submissions/{sub_id}/download")
    assert dl_res.status_code == 200
    assert len(dl_res.content) > 0

    # Delete
    del_res = client.delete(f"/api/v1/submissions/{sub_id}")
    assert del_res.status_code == 200
    assert not resolved_dir.exists()
