from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ComparisonRequest(BaseModel):
    base_submission_id: str = Field(..., description="UUID of the base submission revision")
    target_submission_id: str = Field(..., description="UUID of the target submission revision")


class ComparisonSummary(BaseModel):
    added_lines: int = 0
    removed_lines: int = 0
    changed_files: int = 0


class ComparisonResponse(BaseModel):
    comparison_id: str
    base_submission_id: str
    target_submission_id: str
    summary: ComparisonSummary
    diff: str
    created_at: datetime
