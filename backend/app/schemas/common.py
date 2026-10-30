from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Any] = None
    request_id: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class HealthServices(BaseModel):
    api: str = "up"
    database: str = "up"


class HealthResponse(BaseModel):
    status: str
    version: str = "0.1.0"
    timestamp: datetime
    services: HealthServices
