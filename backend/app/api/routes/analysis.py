from fastapi import APIRouter, status
from app.core.errors import ResourceNotFoundError
from app.schemas.analysis import AnalysisRunResponse
from app.services.analysis_service import analysis_service

router = APIRouter(prefix="/submissions", tags=["Static Analysis"])


@router.post(
    "/{submission_id}/analyze",
    response_model=AnalysisRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger or re-run static analysis pipeline (AST, Ruff, Radon, Bandit)",
)
def run_analysis(submission_id: str):
    return analysis_service.analyze_submission(submission_id)


@router.get(
    "/{submission_id}/analysis",
    response_model=AnalysisRunResponse,
    summary="Retrieve normalised static analysis findings and tool versions",
)
def get_analysis(submission_id: str):
    res = analysis_service.get_analysis_for_submission(submission_id)
    if not res:
        raise ResourceNotFoundError(
            resource_type="Analysis run",
            resource_id=submission_id,
        )
    return res
