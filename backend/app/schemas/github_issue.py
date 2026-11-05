from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class IssueDraftRequest(BaseModel):
    submission_id: str = Field(..., description="UUID of the submission to draft an issue for")
    finding_ids: List[str] = Field(default_factory=list, description="IDs of reviewer-selected static analysis findings")
    repository_url: Optional[str] = Field(None, description="GitHub repository in owner/repo or full URL format")
    custom_title: Optional[str] = Field(None, description="Optional custom title for the issue")
    custom_notes: Optional[str] = Field(None, description="Optional reviewer notes to prepend to the issue body")


class IssueDraftResponse(BaseModel):
    submission_id: str
    repository: str
    title: str
    body: str
    finding_count: int
    selected_finding_ids: List[str]


class CreateIssueRequest(BaseModel):
    submission_id: str = Field(..., description="UUID of the submission")
    repository: str = Field(..., min_length=3, description="GitHub repository in 'owner/repo' format or full URL")
    title: str = Field(..., min_length=3, description="Issue title")
    body: str = Field(..., min_length=5, description="Issue markdown body")
    confirmed: bool = Field(..., description="Explicit faculty/reviewer confirmation flag")
    finding_ids: Optional[List[str]] = Field(default_factory=list, description="Selected finding IDs attached to this issue")


class CreateIssueResponse(BaseModel):
    issue_id: int
    issue_number: int
    issue_url: str
    title: str
    repository: str
    created_at: datetime
    actor_id: str
    status: str = "created"
