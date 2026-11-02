from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class FindingCategory(str, Enum):
    CORRECTNESS = "correctness"
    MAINTAINABILITY = "maintainability"
    COMPLEXITY = "complexity"
    SECURITY = "security"
    STYLE = "style"


class FindingSeverity(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class Finding(BaseModel):
    finding_id: str
    tool: str = Field(..., description="Tool name: ast, ruff, radon, or bandit")
    rule_id: str
    category: FindingCategory
    severity: FindingSeverity
    message: str
    file: str
    line: int
    column: int = 1
    end_line: Optional[int] = None
    end_column: Optional[int] = None
    suggestion: Optional[str] = None


class AnalysisSummary(BaseModel):
    finding_count: int = 0
    error_count: int = 0
    warning_count: int = 0
    info_count: int = 0


class AnalysisRunResponse(BaseModel):
    analysis_id: str
    submission_id: str
    status: str = "completed"
    tool_versions: Dict[str, str] = Field(default_factory=dict)
    summary: AnalysisSummary
    findings: List[Finding] = Field(default_factory=list)
    duration_ms: int = 0
    created_at: datetime
