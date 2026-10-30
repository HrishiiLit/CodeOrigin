from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class SubmissionStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class SubmissionResponse(BaseModel):
    submission_id: str
    project_id: str
    owner_id: str
    parent_submission_id: Optional[str] = None
    original_filename: str
    language: str = "python"
    source_sha256: str
    size_bytes: int
    status: SubmissionStatus
    error_details: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class SubmissionListResponse(BaseModel):
    total: int
    items: List[SubmissionResponse]
