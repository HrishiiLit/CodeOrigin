from typing import Optional
from fastapi import (
    APIRouter,
    File,
    Form,
    Header,
    Query,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import PlainTextResponse

from app.schemas.submission import (
    SubmissionListResponse,
    SubmissionResponse,
)
from app.services.submission_service import submission_service

router = APIRouter(prefix="/submissions", tags=["Submissions"])


@router.post(
    "",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and register a Python code submission",
)
async def create_submission(
    file: UploadFile = File(..., description="Python source file (.py)"),
    project_id: Optional[str] = Form(None, description="Optional target project UUID"),
    parent_submission_id: Optional[str] = Form(None, description="Optional prior revision UUID"),
    display_name: Optional[str] = Form(None, description="Optional user-friendly submission title"),
    x_user_id: str = Header(default="demo-user", alias="X-User-ID"),
    x_user_role: str = Header(default="student", alias="X-User-Role"),
):
    file_bytes = await file.read()
    filename = file.filename or "submission.py"

    return submission_service.create_submission(
        file_bytes=file_bytes,
        filename=filename,
        project_id=project_id,
        parent_submission_id=parent_submission_id,
        owner_id=x_user_id,
        display_name=display_name,
    )


@router.get(
    "",
    response_model=SubmissionListResponse,
    summary="List code submissions",
)
def list_submissions(
    project_id: Optional[str] = Query(None, description="Filter by project UUID"),
    status: Optional[str] = Query(None, description="Filter by status (queued, processing, completed, failed)"),
    limit: int = Query(50, ge=1, le=100, description="Page limit"),
    offset: int = Query(0, ge=0, description="Page offset"),
):
    return submission_service.list_submissions(
        project_id=project_id,
        status=status,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{submission_id}",
    response_model=SubmissionResponse,
    summary="Get submission metadata and status",
)
def get_submission(submission_id: str):
    return submission_service.get_submission(submission_id)


@router.get(
    "/{submission_id}/source",
    response_class=PlainTextResponse,
    summary="Retrieve raw submission source code",
)
def get_submission_source(submission_id: str):
    source_code = submission_service.get_source_code(submission_id)
    return PlainTextResponse(content=source_code, media_type="text/plain; charset=utf-8")
