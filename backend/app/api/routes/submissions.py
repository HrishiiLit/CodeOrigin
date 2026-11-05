from typing import Optional
from fastapi import (
    APIRouter,
    Body,
    File,
    Form,
    Header,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse, PlainTextResponse

from app.core.errors import ResourceNotFoundError
from app.schemas.submission import (
    GitHubIngestRequest,
    RepositoryTreeResponse,
    SubmissionListResponse,
    SubmissionResponse,
)
from app.services.github_service import github_service
from app.services.storage_service import storage_service
from app.services.submission_service import submission_service

router = APIRouter(prefix="/submissions", tags=["Submissions"])


@router.post(
    "",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and register a Python code or repository archive submission",
)
async def create_submission(
    file: UploadFile = File(..., description="Python file (.py) or repository archive (.zip, .tar.gz)"),
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


@router.post(
    "/github",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Fetch and ingest a repository directly from GitHub",
)
async def ingest_from_github(
    payload: GitHubIngestRequest = Body(...),
    x_user_id: str = Header(default="demo-user", alias="X-User-ID"),
    x_user_role: str = Header(default="student", alias="X-User-Role"),
):
    archive_bytes, filename, default_display = await github_service.fetch_repository_archive(
        repo_url=payload.repo_url,
        ref=payload.ref,
    )

    return submission_service.create_submission(
        file_bytes=archive_bytes,
        filename=filename,
        project_id=payload.project_id,
        owner_id=x_user_id,
        display_name=payload.display_name or default_display,
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
    "/{submission_id}/tree",
    response_model=RepositoryTreeResponse,
    summary="Get full repository file tree and statistics",
)
def get_submission_tree(submission_id: str):
    return submission_service.get_repository_tree(submission_id)


@router.get(
    "/{submission_id}/source",
    response_class=PlainTextResponse,
    summary="Retrieve raw submission source code or specific file in repository",
)
def get_submission_source(
    submission_id: str,
    path: Optional[str] = Query(None, description="Relative file path within repository tree"),
):
    source_code = submission_service.get_source_code(submission_id, relative_file_path=path)
    return PlainTextResponse(content=source_code, media_type="text/plain; charset=utf-8")


@router.get(
    "/{submission_id}/download",
    summary="Download submission source file or complete repository archive",
)
def download_submission(
    submission_id: str,
    path: Optional[str] = Query(None, description="Optional relative file path within repository"),
):
    sub_doc = submission_service.repo.find_by_id(submission_id)
    if not sub_doc:
        raise ResourceNotFoundError(resource_type="Submission", resource_id=submission_id)

    storage_key = sub_doc.get("storage_key")
    if not storage_key:
        raise ResourceNotFoundError(resource_type="Submission file key", resource_id=submission_id)

    file_path = storage_service.get_file_path(storage_key, relative_file_path=path)
    if file_path.is_file():
        dl_name = path or sub_doc.get("original_filename") or file_path.name
        if "/" in dl_name or "\\" in dl_name:
            dl_name = dl_name.replace("\\", "/").split("/")[-1]
        return FileResponse(
            path=str(file_path),
            filename=dl_name,
            media_type="application/octet-stream",
        )
    elif file_path.is_dir():
        zip_path = storage_service.create_zip_archive(storage_key)
        orig_name = sub_doc.get("original_filename", "submission")
        download_name = f"{orig_name}.zip" if not orig_name.endswith(".zip") else orig_name
        return FileResponse(
            path=str(zip_path),
            filename=download_name,
            media_type="application/zip",
        )
    raise ResourceNotFoundError(resource_type="File", resource_id=submission_id)


@router.delete(
    "/{submission_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete submission record and clean up stored files",
)
def delete_submission(submission_id: str):
    deleted = submission_service.delete_submission(submission_id)
    return {"status": "deleted", "submission_id": submission_id, "success": deleted}
