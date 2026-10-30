import os
import shutil
import tempfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure test upload directory before importing app modules
test_upload_dir = tempfile.mkdtemp(prefix="codeorigin_test_uploads_")
os.environ["UPLOAD_DIR"] = test_upload_dir
os.environ["APP_ENV"] = "testing"

from app.core.config import settings
settings.UPLOAD_DIR = test_upload_dir

from app.main import app
from app.services.storage_service import storage_service
storage_service.base_dir = Path(test_upload_dir).resolve()


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_uploads():
    yield
    shutil.rmtree(test_upload_dir, ignore_errors=True)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
