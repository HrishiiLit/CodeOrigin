import hashlib
from pathlib import Path
from typing import Tuple

from app.core.config import settings
from app.core.errors import (
    EmptyFileError,
    FileTooLargeError,
    InvalidEncodingError,
    InvalidFileTypeError,
)

ARCHIVE_EXTENSIONS = {".zip", ".tar.gz", ".tgz", ".tar"}


def validate_uploaded_file(file_bytes: bytes, filename: str) -> Tuple[bool, str]:
    """
    Validates uploaded file size and extension.
    Determines whether it is an archive (repo) or a single Python source file.
    Returns (is_archive, sha256_hash).
    """
    size_bytes = len(file_bytes)
    if size_bytes == 0:
        raise EmptyFileError("Uploaded file is empty (0 bytes).")

    if size_bytes > settings.max_upload_size_bytes:
        raise FileTooLargeError(max_size_mb=settings.MAX_UPLOAD_SIZE_MB)

    lower_name = filename.lower()
    is_archive = any(lower_name.endswith(ext) for ext in ARCHIVE_EXTENSIONS)
    is_python = lower_name.endswith(".py")

    if not is_archive and not is_python:
        raise InvalidFileTypeError(
            message=f"File '{filename}' is not permitted. Only Python files (.py) or repository archives (.zip, .tar.gz) are supported."
        )

    # For single .py, verify UTF-8 encoding
    if is_python:
        try:
            file_bytes.decode("utf-8")
        except UnicodeDecodeError as err:
            raise InvalidEncodingError(
                message=f"Uploaded source code must be valid UTF-8 text. Decoding failed at byte {err.start}."
            )

    sha256_hash = hashlib.sha256(file_bytes).hexdigest()
    return is_archive, sha256_hash
