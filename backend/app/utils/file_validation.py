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


def validate_source_file(file_bytes: bytes, filename: str) -> Tuple[str, str]:
    """
    Validates file extension, size, non-emptiness, and UTF-8 encoding.
    Returns decoded source text and SHA-256 hex digest.
    """
    # 1. Extension validation
    ext = Path(filename).suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise InvalidFileTypeError(
            message=f"File extension '{ext}' is not permitted. Only {settings.ALLOWED_EXTENSIONS} files are supported."
        )

    # 2. Size validation
    size_bytes = len(file_bytes)
    if size_bytes == 0:
        raise EmptyFileError("Uploaded file is empty (0 bytes).")

    if size_bytes > settings.max_upload_size_bytes:
        raise FileTooLargeError(max_size_mb=settings.MAX_UPLOAD_SIZE_MB)

    # 3. UTF-8 encoding check (untrusted text only, must decode cleanly)
    try:
        source_text = file_bytes.decode("utf-8")
    except UnicodeDecodeError as err:
        raise InvalidEncodingError(
            message=f"Uploaded source code must be valid UTF-8 text. Decoding failed at byte {err.start}."
        )

    # 4. Compute SHA-256 hash
    sha256_hash = hashlib.sha256(file_bytes).hexdigest()

    return source_text, sha256_hash
