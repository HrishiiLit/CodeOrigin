import io
import os
import tarfile
import uuid
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from app.core.config import settings
from app.core.errors import (
    AppException,
    EmptyFileError,
    FileTooLargeError,
    InvalidEncodingError,
    InvalidFileTypeError,
    MalformedArchiveError,
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
        self.base_dir = (base_dir or settings.resolved_storage_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.uploads_dir = (self.base_dir / "uploads").resolve()
        self.processed_dir = (self.base_dir / "processed").resolve()
        self.generated_dir = (self.base_dir / "generated").resolve()
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        self.generated_dir.mkdir(parents=True, exist_ok=True)

    def _get_effective_root(self, base_path: Path) -> Path:
        """
        If base_path is a directory and has exactly one non-ignored directory child,
        returns that child as the effective root (common for extracted ZIPs/tarballs).
        """
        if base_path.is_dir():
            children = [c for c in base_path.iterdir() if c.is_dir() and c.name not in IGNORED_DIRECTORIES]
            if len(children) == 1:
                return children[0]
        return base_path

    def _resolve_safe_path(self, storage_key: str) -> Path:
        """
        Resolves the file path and verifies that it is strictly contained
        inside the base storage directory to prevent path traversal.
        Supports both direct subpaths ('uploads/...', 'processed/...', 'generated/...')
        and legacy flat keys ('...py', 'repo_...').
        """
        if ".." in storage_key:
            raise StorageSecurityError("Illegal characters detected in storage key.")

        clean_key = storage_key.replace("\\", "/").lstrip("/")

        # Check direct resolution under base_dir
        target_path = (self.base_dir / clean_key).resolve()

        # If it doesn't exist directly under base_dir, check subdirectories for legacy flat keys
        if not target_path.exists():
            if (self.uploads_dir / clean_key).exists():
                target_path = (self.uploads_dir / clean_key).resolve()
            elif (self.processed_dir / clean_key).exists():
                target_path = (self.processed_dir / clean_key).resolve()
            elif (self.generated_dir / clean_key).exists():
                target_path = (self.generated_dir / clean_key).resolve()

        # Fallback: check if file was temporarily stored in backend/storage during legacy split
        if not target_path.exists():
            alt_backend = (self.base_dir.parent / "backend" / "storage" / clean_key).resolve()
            if alt_backend.exists():
                target_path = alt_backend

        try:
            if not target_path.is_relative_to(self.base_dir):
                alt_base = (self.base_dir.parent / "backend" / "storage").resolve()
                if not (alt_base.exists() and target_path.is_relative_to(alt_base)):
                    raise StorageSecurityError("Target file path escapes the configured upload root.")
        except AttributeError:
            if not str(target_path).startswith(str(self.base_dir)):
                raise StorageSecurityError("Target file path escapes the configured upload root.")

        return target_path

    def save_single_file(self, content: bytes, original_filename: str) -> Tuple[str, Path]:
        ext = Path(original_filename).suffix.lower() or ".py"
        file_id = f"{uuid.uuid4()}{ext}"
        storage_key = f"uploads/{file_id}"
        file_path = self.uploads_dir / file_id

        try:
            with open(file_path, "wb") as f:
                f.write(content)
            logger.info(f"Safely persisted single file to storage key: {storage_key}")
            return storage_key, file_path
        except IOError as err:
            logger.error(f"Failed to write file to disk: {err}")
            raise PersistenceError(message="Failed to write uploaded source code to storage.", details=str(err))

    def save_generated_file(self, content: Union[str, bytes], filename: str) -> Tuple[str, Path]:
        clean_name = Path(filename).name
        file_id = f"{uuid.uuid4().hex[:8]}_{clean_name}"
        storage_key = f"generated/{file_id}"
        file_path = self.generated_dir / file_id

        try:
            if isinstance(content, str):
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)
            else:
                with open(file_path, "wb") as f:
                    f.write(content)
            logger.info(f"Safely persisted generated file to storage key: {storage_key}")
            return storage_key, file_path
        except IOError as err:
            logger.error(f"Failed to write generated file to disk: {err}")
            raise PersistenceError(message="Failed to write generated file to storage.", details=str(err))

    def extract_archive(self, archive_bytes: bytes, filename: str) -> Tuple[str, Path, int]:
        """
        Safely extracts a ZIP or TAR archive into a dedicated directory in processed/
        preventing Zip Slip / directory traversal vulnerabilities.
        Returns (storage_key_dirname, extraction_dir_path, extracted_file_count).
        """
        folder_name = f"repo_{uuid.uuid4().hex}"
        storage_key = f"processed/{folder_name}"
        target_dir = self.processed_dir / folder_name
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
            return storage_key, target_dir, file_count
        except (AppException, ValueError) as err:
            self.delete_storage(storage_key)
            raise err
        except (zipfile.BadZipFile, tarfile.ReadError, tarfile.CompressionError) as err:
            self.delete_storage(storage_key)
            logger.warning(f"Malformed or corrupted archive uploaded: {err}")
            raise MalformedArchiveError(message=f"Uploaded archive file is corrupt or invalid: {str(err)}")
        except Exception as err:
            self.delete_storage(storage_key)
            logger.error(f"Failed to extract archive: {err}", exc_info=True)
            raise PersistenceError(message=f"Archive extraction failed: {str(err)}")

    def _extract_zip(self, archive_bytes: bytes, target_dir: Path) -> int:
        count = 0
        with zipfile.ZipFile(io.BytesIO(archive_bytes)) as zf:
            for member in zf.infolist():
                filename = member.filename
                if filename.startswith("/") or filename.startswith("\\") or ".." in filename or ":" in filename:
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
                if filename.startswith("/") or filename.startswith("\\") or ".." in filename or ":" in filename:
                    raise StorageSecurityError(f"Potential Tar traversal vulnerability detected: {filename}")

                if member.issym() or member.islnk():
                    raise StorageSecurityError(f"Symlinks and hardlinks in archives are prohibited: {filename}")

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

    def scan_repository_tree(self, storage_key: str, original_filename: Optional[str] = None) -> Dict[str, Any]:
        """
        Recursively scans the directory or single file associated with storage_key.
        Returns a tree hierarchy and a flat list of source files.
        """
        base_path = self._resolve_safe_path(storage_key)
        if not base_path.exists():
            raise ResourceNotFoundError(resource_type="Submission storage", resource_id=storage_key)

        if base_path.is_file():
            stats = base_path.stat()
            display_name = original_filename or base_path.name
            file_entry = {
                "path": display_name,
                "name": display_name,
                "size_bytes": stats.st_size,
                "extension": Path(display_name).suffix.lower(),
                "is_source": Path(display_name).suffix.lower() == ".py",
            }
            return {
                "is_directory": False,
                "root_name": display_name,
                "total_files": 1,
                "source_files_count": 1 if file_entry["is_source"] else 0,
                "tree": [file_entry],
                "source_files": [file_entry["path"]],
            }

        tree: List[Dict[str, Any]] = []
        source_files: List[str] = []
        total_files = 0

        effective_root = self._get_effective_root(base_path)

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
            effective_root = self._get_effective_root(base_path)

            if not relative_file_path:
                tree_info = self.scan_repository_tree(storage_key)
                if tree_info["source_files"]:
                    relative_file_path = tree_info["source_files"][0]
                else:
                    return "# Repository loaded. No Python source files found."

            clean_rel = relative_file_path.replace("\\", "/").lstrip("/")
            if ".." in clean_rel:
                raise StorageSecurityError("Relative file path traversal detected.")
            
            # Check effective root first
            candidate = (effective_root / clean_rel).resolve()
            if not candidate.is_relative_to(base_path):
                raise StorageSecurityError("Relative file path escapes storage root.")
            if candidate.is_file():
                target_file = candidate
            else:
                candidate_base = (base_path / clean_rel).resolve()
                if not candidate_base.is_relative_to(base_path):
                    raise StorageSecurityError("Relative file path escapes storage root.")
                if candidate_base.is_file():
                    target_file = candidate_base
                else:
                    target_file = candidate

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

    def get_file_path(self, storage_key: str, relative_file_path: Optional[str] = None) -> Path:
        base_path = self._resolve_safe_path(storage_key)
        if not base_path.exists():
            raise ResourceNotFoundError(resource_type="Submission storage", resource_id=storage_key)

        if base_path.is_file():
            return base_path

        if relative_file_path:
            clean_rel = relative_file_path.replace("\\", "/").lstrip("/")
            if ".." in clean_rel:
                raise StorageSecurityError("Relative file path traversal detected.")
            
            effective_root = self._get_effective_root(base_path)
            candidate = (effective_root / clean_rel).resolve()
            if not candidate.is_relative_to(base_path):
                raise StorageSecurityError("Relative file path escapes storage root.")
            if candidate.is_file():
                return candidate
            candidate_base = (base_path / clean_rel).resolve()
            if not candidate_base.is_relative_to(base_path):
                raise StorageSecurityError("Relative file path escapes storage root.")
            if candidate_base.is_file():
                return candidate_base

        return base_path

    def create_zip_archive(self, storage_key: str) -> Path:
        base_path = self._resolve_safe_path(storage_key)
        if not base_path.exists():
            raise ResourceNotFoundError(resource_type="Submission storage", resource_id=storage_key)

        zip_name = f"download_{uuid.uuid4().hex[:8]}.zip"
        zip_path = self.generated_dir / zip_name

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            if base_path.is_file():
                zf.write(base_path, arcname=base_path.name)
            else:
                for root, _, files in os.walk(base_path):
                    for f in files:
                        full_f = Path(root) / f
                        arcname = full_f.relative_to(base_path).as_posix()
                        zf.write(full_f, arcname=arcname)
        return zip_path

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
