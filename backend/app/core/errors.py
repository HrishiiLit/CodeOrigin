import uuid
from typing import Any, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.logging import logger


class AppException(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: Optional[Any] = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


class InvalidFileTypeError(AppException):
    def __init__(self, message: str = "Only Python source files (.py) are supported.", details: Any = None):
        super().__init__(code="INVALID_FILE_TYPE", message=message, status_code=400, details=details)


class EmptyFileError(AppException):
    def __init__(self, message: str = "Uploaded file cannot be empty.", details: Any = None):
        super().__init__(code="EMPTY_FILE", message=message, status_code=400, details=details)


class InvalidEncodingError(AppException):
    def __init__(self, message: str = "Uploaded file must be valid UTF-8 text.", details: Any = None):
        super().__init__(code="INVALID_ENCODING", message=message, status_code=400, details=details)


class FileTooLargeError(AppException):
    def __init__(self, max_size_mb: int = 5, details: Any = None):
        super().__init__(
            code="FILE_TOO_LARGE",
            message=f"Uploaded file exceeds the maximum allowed size of {max_size_mb} MB.",
            status_code=413,
            details=details,
        )


class ResourceNotFoundError(AppException):
    def __init__(self, resource_type: str = "Resource", resource_id: str = ""):
        super().__init__(
            code="RESOURCE_NOT_FOUND",
            message=f"{resource_type} with ID '{resource_id}' was not found.",
            status_code=404,
        )


class PersistenceError(AppException):
    def __init__(self, message: str = "A database or storage persistence error occurred.", details: Any = None):
        super().__init__(code="PERSISTENCE_ERROR", message=message, status_code=500, details=details)


class StorageSecurityError(AppException):
    def __init__(self, message: str = "Invalid file path or potential path traversal detected."):
        super().__init__(code="STORAGE_SECURITY_VIOLATION", message=message, status_code=400)


def format_error_response(code: str, message: str, details: Any = None, request_id: Optional[str] = None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "request_id": request_id or str(uuid.uuid4()),
        }
    }


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        logger.warning(f"[{request_id}] AppException: {exc.code} - {exc.message}")
        return JSONResponse(
            status_code=exc.status_code,
            content=format_error_response(
                code=exc.code,
                message=exc.message,
                details=exc.details,
                request_id=request_id,
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        logger.warning(f"[{request_id}] Validation error: {exc.errors()}")
        return JSONResponse(
            status_code=422,
            content=format_error_response(
                code="VALIDATION_ERROR",
                message="The submitted data failed validation.",
                details=exc.errors(),
                request_id=request_id,
            ),
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        code = "HTTP_ERROR"
        if exc.status_code == 404:
            code = "RESOURCE_NOT_FOUND"
        elif exc.status_code == 403:
            code = "FORBIDDEN"
        elif exc.status_code == 401:
            code = "UNAUTHORIZED"

        return JSONResponse(
            status_code=exc.status_code,
            content=format_error_response(
                code=code,
                message=str(exc.detail),
                details=None,
                request_id=request_id,
            ),
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        logger.error(f"[{request_id}] Unhandled error: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content=format_error_response(
                code="INTERNAL_SERVER_ERROR",
                message="An unexpected server error occurred. Please try again later.",
                details=None,
                request_id=request_id,
            ),
        )
