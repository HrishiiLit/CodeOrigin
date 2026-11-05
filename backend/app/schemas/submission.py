from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SubmissionStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class SubmissionType(str, Enum):
    FILE = "file"
    REPOSITORY = "repository"


class FileTreeNode(BaseModel):
    path: str
    name: str
    size_bytes: int
    extension: str
    is_source: bool = False
    is_python: bool = False


class RepositoryTreeResponse(BaseModel):
    is_directory: bool
    root_name: str
    total_files: int
    source_files_count: int
    tree: List[FileTreeNode]
    source_files: List[str]


class GitHubIngestRequest(BaseModel):
    repo_url: str = Field(..., description="GitHub repository URL (e.g. https://github.com/owner/repo)")
    ref: Optional[str] = Field(None, description="Branch, tag, or commit SHA")
    project_id: Optional[str] = Field(None, description="Optional target project UUID")
    display_name: Optional[str] = Field(None, description="Optional custom title")


class SubmissionResponse(BaseModel):
    submission_id: str
    project_id: str
    owner_id: str
    parent_submission_id: Optional[str] = None
    original_filename: str
    submission_type: SubmissionType = SubmissionType.FILE
    language: str = "python"
    source_sha256: str
    size_bytes: int
    total_files: int = 1
    source_files_count: int = 1
    source_files: List[str] = Field(default_factory=list)
    status: SubmissionStatus
    error_details: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class SubmissionListResponse(BaseModel):
    total: int
    items: List[SubmissionResponse]
