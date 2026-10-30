import uuid
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.core.errors import (
    PersistenceError,
    ResourceNotFoundError,
    StorageSecurityError,
)
from app.core.logging import logger


class StorageService:
    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = (base_dir or settings.resolved_upload_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, storage_key: str) -> Path:
        """
        Resolves the file path and verifies that it is strictly contained
        inside the base upload directory to prevent path traversal.
        """
        # Reject keys containing path separators
        if "/" in storage_key or "\\" in storage_key or ".." in storage_key:
            raise StorageSecurityError("Illegal characters detected in storage key.")

        target_path = (self.base_dir / storage_key).resolve()

        try:
            # Python 3.9+ is_relative_to
            if not target_path.is_relative_to(self.base_dir):
                raise StorageSecurityError("Target file path escapes the configured upload root.")
        except AttributeError:
            if not str(target_path).startswith(str(self.base_dir)):
                raise StorageSecurityError("Target file path escapes the configured upload root.")

        return target_path

    def save_file(self, content: bytes, extension: str = ".py") -> str:
        """
        Saves raw bytes under an opaque generated UUIDv4 key and returns the storage_key.
        """
        if not extension.startswith("."):
            extension = f".{extension}"

        storage_key = f"{uuid.uuid4()}{extension}"
        file_path = self._resolve_safe_path(storage_key)

        try:
            with open(file_path, "wb") as f:
                f.write(content)
            logger.info(f"Safely persisted {len(content)} bytes to storage key: {storage_key}")
            return storage_key
        except IOError as err:
            logger.error(f"Failed to write file to disk: {err}")
            raise PersistenceError(message="Failed to write uploaded source code to storage.", details=str(err))

    def read_text(self, storage_key: str) -> str:
        """
        Reads and returns the text content of a stored file.
        """
        file_path = self._resolve_safe_path(storage_key)
        if not file_path.is_file():
            raise ResourceNotFoundError(resource_type="Submission source", resource_id=storage_key)

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except UnicodeDecodeError:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        except IOError as err:
            logger.error(f"Failed to read file from disk: {err}")
            raise PersistenceError(message="Failed to read file from storage.", details=str(err))

    def delete_file(self, storage_key: str) -> bool:
        """
        Safely removes a stored file (e.g. for rollback).
        """
        try:
            file_path = self._resolve_safe_path(storage_key)
            if file_path.is_file():
                file_path.unlink()
                logger.info(f"Deleted storage file: {storage_key}")
                return True
            return False
        except Exception as err:
            logger.warning(f"Failed to delete file {storage_key}: {err}")
            return False


storage_service = StorageService()
