from fastapi import APIRouter, Body, status
from app.schemas.comparison import ComparisonRequest, ComparisonResponse
from app.services.comparison_service import comparison_service

router = APIRouter(prefix="/comparisons", tags=["Comparisons"])


@router.post(
    "",
    response_model=ComparisonResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Compute unified diff and change metrics between two code revisions",
)
def create_comparison(payload: ComparisonRequest = Body(...)):
    return comparison_service.compare_submissions(
        base_submission_id=payload.base_submission_id,
        target_submission_id=payload.target_submission_id,
    )


@router.get(
    "/{comparison_id}",
    response_model=ComparisonResponse,
    summary="Retrieve revision comparison details and unified diff",
)
def get_comparison(comparison_id: str):
    return comparison_service.get_comparison(comparison_id)
