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
    assert (settings.resolved_storage_dir / "data").is_dir()


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

    physical_path = storage_service.get_file_path(storage_key)
    assert physical_path.is_file()
    assert physical_path.is_relative_to(settings.resolved_storage_dir)

    # 4. Retrieve source code via API
    src_res = client.get(f"/api/v1/submissions/{submission_id}/source")
    assert src_res.status_code == 200
    assert src_res.text == test_code.decode("utf-8")

    # 5. Download file via API
    dl_res = client.get(f"/api/v1/submissions/{submission_id}/download")
    assert dl_res.status_code == 200
    assert dl_res.content == test_code
    assert dl_res.headers.get("content-disposition") is not None

    # 6. Delete submission and verify physical file is unlinked
    del_res = client.delete(f"/api/v1/submissions/{submission_id}")
    assert del_res.status_code == 200
    assert not physical_path.exists()


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


def test_persistence_across_server_restarts():
    """
    Verifies that submissions and metadata survive a simulated server restart
    even when MongoDB is not connected, using the persistent disk fallback store.
    """
    client = TestClient(app)
    code = b"print('persistent test')\n"
    res = client.post(
        "/api/v1/submissions",
        files={"file": ("persistent_sample.py", io.BytesIO(code), "text/x-python")},
    )
    assert res.status_code == 201
    sub_id = res.json()["submission_id"]

    # Verify fallback file exists on disk
    submissions_json = settings.resolved_data_dir / "submissions.json"
    assert submissions_json.is_file(), "submissions.json was not created on disk!"

    # Simulate a full server restart by instantiating a fresh SubmissionRepository
    from app.repositories.submission_repository import SubmissionRepository
    fresh_repo = SubmissionRepository()
    reloaded_doc = fresh_repo.find_by_id(sub_id)
    assert reloaded_doc is not None, "Submission was lost after repository re-initialization!"
    assert reloaded_doc["original_filename"] == "persistent_sample.py"

    # Verify listing also contains the submission
    items, total = fresh_repo.list_submissions()
    assert any(x["_id"] == sub_id for x in items)

    # Clean up test submission
    client.delete(f"/api/v1/submissions/{sub_id}")
