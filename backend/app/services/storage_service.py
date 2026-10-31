import io
import os
import tarfile
import uuid
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.core.errors import (
    AppException,
    EmptyFileError,
    FileTooLargeError,
    InvalidEncodingError,
    InvalidFileTypeError,
    PersistenceError,
    ResourceNotFoundError,
    StorageSecurityError,
)
from app.core.logging import logger

IGNORED_DIRECTORIES = {
    ".git",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".venv",
    "venv",
    "env",
    "node_modules",
    ".next",
    ".idea",
    ".vscode",
    "dist",
    "build",
}

IGNORED_EXTENSIONS = {
    ".pyc",
    ".pyo",
    ".pyd",
    ".so",
    ".dll",
    ".dylib",
    ".exe",
    ".bin",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".svg",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".mp4",
    ".mp3",
    ".pdf",
}


class StorageService:
    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = (base_dir or settings.resolved_upload_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, storage_key: str) -> Path:
        """
        Resolves the file path and verifies that it is strictly contained
        inside the base upload directory to prevent path traversal.
        """
        if ".." in storage_key or storage_key.startswith("/") or storage_key.startswith("\\"):
            raise StorageSecurityError("Illegal characters detected in storage key.")

        target_path = (self.base_dir / storage_key).resolve()

        try:
            if not target_path.is_relative_to(self.base_dir):
                raise StorageSecurityError("Target file path escapes the configured upload root.")
        except AttributeError:
            if not str(target_path).startswith(str(self.base_dir)):
                raise StorageSecurityError("Target file path escapes the configured upload root.")

        return target_path

    def save_single_file(self, content: bytes, original_filename: str) -> Tuple[str, Path]:
        ext = Path(original_filename).suffix.lower() or ".py"
        storage_key = f"{uuid.uuid4()}{ext}"
        file_path = self._resolve_safe_path(storage_key)

        try:
            with open(file_path, "wb") as f:
                f.write(content)
            logger.info(f"Safely persisted single file to storage key: {storage_key}")
            return storage_key, file_path
        except IOError as err:
            logger.error(f"Failed to write file to disk: {err}")
            raise PersistenceError(message="Failed to write uploaded source code to storage.", details=str(err))

    def extract_archive(self, archive_bytes: bytes, filename: str) -> Tuple[str, Path, int]:
        """
        Safely extracts a ZIP or TAR archive into a dedicated directory
        preventing Zip Slip / directory traversal vulnerabilities.
        Returns (storage_key_dirname, extraction_dir_path, extracted_file_count).
        """
        folder_key = f"repo_{uuid.uuid4().hex}"
        target_dir = self._resolve_safe_path(folder_key)
        target_dir.mkdir(parents=True, exist_ok=True)

        lower_name = filename.lower()
        file_count = 0

        try:
            if lower_name.endswith(".zip"):
                file_count = self._extract_zip(archive_bytes, target_dir)
            elif lower_name.endswith((".tar.gz", ".tgz", ".tar")):
                file_count = self._extract_tar(archive_bytes, target_dir)
            else:
                raise InvalidFileTypeError(f"Unsupported archive format for file '{filename}'.")
            
            logger.info(f"Safely extracted {file_count} files to {target_dir}")
            return folder_key, target_dir, file_count
        except (AppException, ValueError) as err:
            self.delete_storage(folder_key)
            raise err
        except Exception as err:
            self.delete_storage(folder_key)
            logger.error(f"Failed to extract archive: {err}", exc_info=True)
            raise PersistenceError(message=f"Archive extraction failed: {str(err)}")

    def _extract_zip(self, archive_bytes: bytes, target_dir: Path) -> int:
        count = 0
        with zipfile.ZipFile(io.BytesIO(archive_bytes)) as zf:
            for member in zf.infolist():
                filename = member.filename
                if filename.startswith("/") or filename.startswith("\\") or ".." in filename:
                    raise StorageSecurityError(f"Potential Zip Slip vulnerability detected in path: {filename}")

                dest_path = (target_dir / filename).resolve()
                if not dest_path.is_relative_to(target_dir):
                    raise StorageSecurityError(f"Archive entry escapes destination: {filename}")

                if member.is_dir():
                    dest_path.mkdir(parents=True, exist_ok=True)
                    continue

                dest_path.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(member) as source, open(dest_path, "wb") as target:
                    target.write(source.read())
                count += 1
        return count

    def _extract_tar(self, archive_bytes: bytes, target_dir: Path) -> int:
        count = 0
        mode = "r:gz" if archive_bytes[:2] == b"\x1f\x8b" else "r:*"
        with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode=mode) as tf:
            for member in tf.getmembers():
                filename = member.name
                if filename.startswith("/") or filename.startswith("\\") or ".." in filename:
                    raise StorageSecurityError(f"Potential Tar traversal vulnerability detected: {filename}")

                dest_path = (target_dir / filename).resolve()
                if not dest_path.is_relative_to(target_dir):
                    raise StorageSecurityError(f"Archive entry escapes destination: {filename}")

                if member.isdir():
                    dest_path.mkdir(parents=True, exist_ok=True)
                    continue

                if member.isreg():
                    dest_path.parent.mkdir(parents=True, exist_ok=True)
                    f = tf.extractfile(member)
                    if f is not None:
                        with open(dest_path, "wb") as target:
                            target.write(f.read())
                        count += 1
        return count

    def scan_repository_tree(self, storage_key: str) -> Dict[str, Any]:
        """
        Recursively scans the directory or single file associated with storage_key.
        Returns a tree hierarchy and a flat list of source files.
        """
        base_path = self._resolve_safe_path(storage_key)
        if not base_path.exists():
            raise ResourceNotFoundError(resource_type="Submission storage", resource_id=storage_key)

        if base_path.is_file():
            stats = base_path.stat()
            file_entry = {
                "path": base_path.name,
                "name": base_path.name,
                "size_bytes": stats.st_size,
                "extension": base_path.suffix.lower(),
                "is_source": base_path.suffix.lower() == ".py",
            }
            return {
                "is_directory": False,
                "root_name": base_path.name,
                "total_files": 1,
                "source_files_count": 1 if file_entry["is_source"] else 0,
                "tree": [file_entry],
                "source_files": [file_entry["path"]],
            }

        tree: List[Dict[str, Any]] = []
        source_files: List[str] = []
        total_files = 0

        effective_root = base_path
        children = [c for c in base_path.iterdir() if c.name not in IGNORED_DIRECTORIES]
        if len(children) == 1 and children[0].is_dir():
            effective_root = children[0]

        for root, dirs, files in os.walk(effective_root):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRECTORIES and not d.startswith(".")]

            rel_root = Path(root).relative_to(effective_root)
            for f in files:
                file_path = Path(root) / f
                rel_path = (rel_root / f).as_posix()
                if rel_path.startswith("./"):
                    rel_path = rel_path[2:]

                ext = file_path.suffix.lower()
                if ext in IGNORED_EXTENSIONS:
                    continue

                total_files += 1
                is_source = ext in {".py", ".sh", ".json", ".yaml", ".yml", ".toml", ".md", ".txt", ".js", ".ts"}
                is_python = ext == ".py"

                if is_python:
                    source_files.append(rel_path)

                tree.append({
                    "path": rel_path,
                    "name": f,
                    "size_bytes": file_path.stat().st_size,
                    "extension": ext,
                    "is_source": is_source,
                    "is_python": is_python,
                })

        return {
            "is_directory": True,
            "root_name": effective_root.name,
            "total_files": total_files,
            "source_files_count": len(source_files),
            "tree": tree,
            "source_files": sorted(source_files),
        }

    def read_text(self, storage_key: str, relative_file_path: Optional[str] = None) -> str:
        """
        Reads source code. If storage_key points to a directory, relative_file_path is required.
        """
        base_path = self._resolve_safe_path(storage_key)
        if not base_path.exists():
            raise ResourceNotFoundError(resource_type="Submission source", resource_id=storage_key)

        target_file = base_path
        if base_path.is_dir():
            if not relative_file_path:
                tree_info = self.scan_repository_tree(storage_key)
                if tree_info["source_files"]:
                    relative_file_path = tree_info["source_files"][0]
                else:
                    return "# Repository loaded. No Python source files found."

            clean_rel = relative_file_path.replace("\\", "/").lstrip("/")
            if ".." in clean_rel:
                raise StorageSecurityError("Relative file path traversal detected.")
            
            target_file = (base_path / clean_rel).resolve()
            if not target_file.is_file():
                children = [c for c in base_path.iterdir() if c.is_dir() and c.name not in IGNORED_DIRECTORIES]
                if children:
                    alt_target = (children[0] / clean_rel).resolve()
                    if alt_target.is_file():
                        target_file = alt_target

        if not target_file.is_file():
            raise ResourceNotFoundError(resource_type="Source file", resource_id=str(relative_file_path or storage_key))

        try:
            with open(target_file, "r", encoding="utf-8") as f:
                return f.read()
        except UnicodeDecodeError:
            with open(target_file, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        except IOError as err:
            logger.error(f"Failed to read file from disk: {err}")
            raise PersistenceError(message="Failed to read file from storage.", details=str(err))

    def delete_storage(self, storage_key: str) -> bool:
        """
        Safely removes a stored file or directory (e.g. for rollback).
        """
        try:
            target_path = self._resolve_safe_path(storage_key)
            if not target_path.exists():
                return False

            if target_path.is_file():
                target_path.unlink()
            elif target_path.is_dir():
                import shutil
                shutil.rmtree(target_path, ignore_errors=True)

            logger.info(f"Cleaned up storage key: {storage_key}")
            return True
        except Exception as err:
            logger.warning(f"Failed to clean up storage {storage_key}: {err}")
            return False


storage_service = StorageService()
