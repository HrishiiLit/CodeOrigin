from typing import Optional
from fastapi import APIRouter, Body, Header, status

from app.schemas.github_issue import (
    CreateIssueRequest,
    CreateIssueResponse,
    IssueDraftRequest,
    IssueDraftResponse,
)
from app.services.github_service import github_service

router = APIRouter(prefix="/integrations/github", tags=["GitHub Integration"])


@router.post(
    "/issues/draft",
    response_model=IssueDraftResponse,
    summary="Prepare GitHub issue draft from reviewer-selected findings",
)
def draft_github_issue(payload: IssueDraftRequest = Body(...)):
    """
    Constructs a structured issue title and Markdown body containing
    reviewer-selected static analysis findings.
    Does NOT write to GitHub.
    """
    return github_service.prepare_issue_draft(
        submission_id=payload.submission_id,
        finding_ids=payload.finding_ids,
        repository_url=payload.repository_url,
        custom_title=payload.custom_title,
        custom_notes=payload.custom_notes,
    )


@router.post(
    "/issues",
    response_model=CreateIssueResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit GitHub issue upon explicit faculty approval",
)
async def create_github_issue(
    payload: CreateIssueRequest = Body(...),
    x_user_id: Optional[str] = Header(default="demo-faculty", alias="X-User-ID"),
):
    """
    Creates an issue on the target GitHub repository.
    Enforces that 'confirmed' is True and records the approver in audit logs.
    """
    actor = x_user_id or "demo-faculty"
    return await github_service.create_issue(
        submission_id=payload.submission_id,
        repository=payload.repository,
        title=payload.title,
        body=payload.body,
        confirmed=payload.confirmed,
        actor_id=actor,
        finding_ids=payload.finding_ids,
    )
