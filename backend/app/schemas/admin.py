from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SubmissionsStats(BaseModel):
    total: int = 0
    files: int = 0
    repositories: int = 0
    by_status: Dict[str, int] = Field(default_factory=dict)
    total_storage_bytes: int = 0
    unique_students: int = 0
    unique_projects: int = 0


class AnalysisStats(BaseModel):
    total_runs: int = 0
    total_findings: int = 0
    by_severity: Dict[str, int] = Field(default_factory=dict)
    by_tool: Dict[str, int] = Field(default_factory=dict)
    by_category: Dict[str, int] = Field(default_factory=dict)
    avg_duration_ms: float = 0.0


class ReviewStats(BaseModel):
    total_reviews: int = 0
    unique_reviewers: int = 0


class ComparisonStats(BaseModel):
    total_comparisons: int = 0
    total_added_lines: int = 0
    total_removed_lines: int = 0


class SystemStats(BaseModel):
    api: str = "up"
    database: str = "fallback_store"
    version: str = "0.1.0"
    timestamp: str


class AuditEventItem(BaseModel):
    event_id: str
    action: str
    actor_id: str
    details: Dict[str, Any] = Field(default_factory=dict)
    created_at: str


class AdminOverviewResponse(BaseModel):
    submissions: SubmissionsStats
    analysis: AnalysisStats
    reviews: ReviewStats
    comparisons: ComparisonStats
    system: SystemStats
    recent_activity: List[AuditEventItem] = Field(default_factory=list)
