from typing import List
from fastapi import APIRouter, Body, Header, status

from app.schemas.review import (
    CreateReviewRequest,
    ReviewReportResponse,
    ReviewResponse,
)
from app.services.review_service import review_service

router = APIRouter(tags=["Reviews & Reports"])


@router.post(
    "/reviews",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a faculty review note for a code submission",
)
def create_review(
    payload: CreateReviewRequest = Body(...),
    x_user_id: str = Header(default="demo-faculty", alias="X-User-ID"),
):
    author_id = payload.author_id or x_user_id
    return review_service.create_review(
        submission_id=payload.submission_id,
        notes=payload.notes,
        author_id=author_id,
    )


@router.get(
    "/submissions/{submission_id}/reviews",
    response_model=List[ReviewResponse],
    summary="List all faculty review notes attached to a submission",
)
def list_submission_reviews(submission_id: str):
    return review_service.list_reviews_for_submission(submission_id)


@router.get(
    "/submissions/{submission_id}/report",
    response_model=ReviewReportResponse,
    summary="Generate a comprehensive review, analysis, and evolution report",
)
def get_submission_report(submission_id: str):
    return review_service.generate_report(submission_id)
