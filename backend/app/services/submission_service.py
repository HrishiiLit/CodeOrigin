import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.core.errors import PersistenceError, ResourceNotFoundError
from app.core.logging import logger
from app.repositories.submission_repository import (
    SubmissionRepository,
    submission_repository,
)
from app.schemas.submission import (
    SubmissionListResponse,
    SubmissionResponse,
    SubmissionStatus,
)
from app.services.storage_service import StorageService, storage_service
from app.utils.file_validation import validate_source_file


class SubmissionService:
    def __init__(
        self,
        repository: Optional[SubmissionRepository] = None,
        storage: Optional[StorageService] = None,
    ):
        self.repo = repository or submission_repository
        self.storage = storage or storage_service

    def create_submission(
        self,
        file_bytes: bytes,
        filename: str,
        project_id: Optional[str] = None,
        parent_submission_id: Optional[str] = None,
        owner_id: str = "demo-user",
        display_name: Optional[str] = None,
    ) -> SubmissionResponse:
        # 1. Clean filename & validate content
        safe_display_filename = Path(filename).name or "submission.py"
        source_text, sha256_hash = validate_source_file(file_bytes, safe_display_filename)

        # 2. Validate parent submission if specified
        if parent_submission_id:
            parent = self.repo.find_by_id(parent_submission_id)
            if not parent:
                raise ResourceNotFoundError(
                    resource_type="Parent submission",
                    resource_id=parent_submission_id,
                )
            if not project_id:
                project_id = parent.get("project_id")

        # 3. Generate IDs
        submission_id = str(uuid.uuid4())
        project_id = project_id or str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        # 4. Save file to disk
        storage_key = self.storage.save_file(file_bytes, extension=".py")

        # 5. Build submission document
        submission_doc = {
            "_id": submission_id,
            "project_id": project_id,
            "owner_id": owner_id,
            "parent_submission_id": parent_submission_id,
            "original_filename": safe_display_filename,
            "display_name": display_name or safe_display_filename,
            "language": "python",
            "storage_key": storage_key,
            "source_sha256": sha256_hash,
            "size_bytes": len(file_bytes),
            "status": SubmissionStatus.QUEUED.value,
            "error_details": None,
            "created_at": now,
            "updated_at": now,
        }

        # 6. Persist to repository with rollback if DB insert fails
        try:
            self.repo.insert(submission_doc)
            logger.info(f"Successfully registered submission: {submission_id}")
        except Exception as err:
            logger.error(f"Persistence failed for submission {submission_id}. Rolling back file {storage_key}.")
            self.storage.delete_file(storage_key)
            raise PersistenceError(
                message="Failed to persist submission to database. Cleaned up uploaded file.",
                details=str(err),
            )

        return self._to_response(submission_doc)

    def get_submission(self, submission_id: str) -> SubmissionResponse:
        doc = self.repo.find_by_id(submission_id)
        if not doc:
            raise ResourceNotFoundError(resource_type="Submission", resource_id=submission_id)
        return self._to_response(doc)

    def get_source_code(self, submission_id: str) -> str:
        doc = self.repo.find_by_id(submission_id)
        if not doc:
            raise ResourceNotFoundError(resource_type="Submission", resource_id=submission_id)

        storage_key = doc.get("storage_key")
        if not storage_key:
            raise ResourceNotFoundError(resource_type="Submission file key", resource_id=submission_id)

        return self.storage.read_text(storage_key)

    def list_submissions(
        self,
        project_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> SubmissionListResponse:
        docs, total = self.repo.list_submissions(
            project_id=project_id,
            status=status,
            limit=limit,
            offset=offset,
        )
        items = [self._to_response(doc) for doc in docs]
        return SubmissionListResponse(total=total, items=items)

    @staticmethod
    def _to_response(doc: dict) -> SubmissionResponse:
        return SubmissionResponse(
            submission_id=doc["_id"],
            project_id=doc["project_id"],
            owner_id=doc.get("owner_id", "demo-user"),
            parent_submission_id=doc.get("parent_submission_id"),
            original_filename=doc.get("original_filename", "submission.py"),
            language=doc.get("language", "python"),
            source_sha256=doc["source_sha256"],
            size_bytes=doc["size_bytes"],
            status=SubmissionStatus(doc.get("status", SubmissionStatus.QUEUED.value)),
            error_details=doc.get("error_details"),
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
        )


submission_service = SubmissionService()
