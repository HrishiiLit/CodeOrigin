from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.schemas.analysis import AnalysisSummary


class CreateReviewRequest(BaseModel):
    submission_id: str = Field(..., description="UUID of the submission being reviewed")
    notes: str = Field(..., min_length=1, description="Qualitative feedback or review notes")
    author_id: Optional[str] = Field("demo-faculty", description="Identifier of the reviewer/faculty member")


class ReviewResponse(BaseModel):
    review_id: str
    submission_id: str
    author_id: str
    notes: str
    created_at: datetime


class ReviewReportResponse(BaseModel):
    report_id: str
    submission_id: str
    generated_at: datetime
    submission_metadata: Dict[str, Any]
    analysis_summary: Optional[AnalysisSummary] = None
    findings_count: int = 0
    reviews: List[ReviewResponse] = Field(default_factory=list)
    markdown_report: str
