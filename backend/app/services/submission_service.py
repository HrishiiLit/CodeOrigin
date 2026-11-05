import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from app.core.errors import PersistenceError, ResourceNotFoundError
from app.core.logging import logger
from app.repositories.submission_repository import (
    SubmissionRepository,
    submission_repository,
)
from app.schemas.submission import (
    RepositoryTreeResponse,
    SubmissionListResponse,
    SubmissionResponse,
    SubmissionStatus,
    SubmissionType,
)
from app.services.storage_service import StorageService, storage_service
from app.utils.file_validation import validate_uploaded_file


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
        # 1. Clean filename & validate
        safe_display_filename = Path(filename).name or "submission.py"
        is_archive, sha256_hash = validate_uploaded_file(file_bytes, safe_display_filename)

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

        # 4. Save/extract storage
        if is_archive:
            storage_key, _, _ = self.storage.extract_archive(file_bytes, safe_display_filename)
            sub_type = SubmissionType.REPOSITORY
        else:
            storage_key, _ = self.storage.save_single_file(file_bytes, safe_display_filename)
            sub_type = SubmissionType.FILE

        # 5. Scan repository tree
        tree_info = self.storage.scan_repository_tree(storage_key, original_filename=safe_display_filename)

        # 6. Build submission document
        submission_doc = {
            "_id": submission_id,
            "project_id": project_id,
            "owner_id": owner_id,
            "parent_submission_id": parent_submission_id,
            "original_filename": safe_display_filename,
            "display_name": display_name or safe_display_filename,
            "submission_type": sub_type.value,
            "language": "python",
            "storage_key": storage_key,
            "source_sha256": sha256_hash,
            "size_bytes": len(file_bytes),
            "total_files": tree_info["total_files"],
            "source_files_count": tree_info["source_files_count"],
            "source_files": tree_info["source_files"],
            "status": SubmissionStatus.QUEUED.value,
            "error_details": None,
            "created_at": now,
            "updated_at": now,
        }

        # 7. Persist to repository with rollback
        try:
            self.repo.insert(submission_doc)
            logger.info(f"Successfully registered submission: {submission_id} (type: {sub_type.value})")
        except Exception as err:
            logger.error(f"Persistence failed for submission {submission_id}. Rolling back storage {storage_key}.")
            self.storage.delete_storage(storage_key)
            raise PersistenceError(
                message="Failed to persist submission to database. Cleaned up storage.",
                details=str(err),
            )

        return self._to_response(submission_doc)

    def get_submission(self, submission_id: str) -> SubmissionResponse:
        doc = self.repo.find_by_id(submission_id)
        if not doc:
            raise ResourceNotFoundError(resource_type="Submission", resource_id=submission_id)
        return self._to_response(doc)

    def get_source_code(self, submission_id: str, relative_file_path: Optional[str] = None) -> str:
        doc = self.repo.find_by_id(submission_id)
        if not doc:
            raise ResourceNotFoundError(resource_type="Submission", resource_id=submission_id)

        storage_key = doc.get("storage_key")
        if not storage_key:
            raise ResourceNotFoundError(resource_type="Submission file key", resource_id=submission_id)

        return self.storage.read_text(storage_key, relative_file_path=relative_file_path)

    def get_repository_tree(self, submission_id: str) -> RepositoryTreeResponse:
        doc = self.repo.find_by_id(submission_id)
        if not doc:
            raise ResourceNotFoundError(resource_type="Submission", resource_id=submission_id)

        storage_key = doc.get("storage_key")
        if not storage_key:
            raise ResourceNotFoundError(resource_type="Submission file key", resource_id=submission_id)

        orig_name = doc.get("original_filename")
        info = self.storage.scan_repository_tree(storage_key, original_filename=orig_name)
        return RepositoryTreeResponse(
            is_directory=info["is_directory"],
            root_name=info["root_name"],
            total_files=info["total_files"],
            source_files_count=info["source_files_count"],
            tree=info["tree"],
            source_files=info["source_files"],
        )

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

    def delete_submission(self, submission_id: str) -> bool:
        doc = self.repo.find_by_id(submission_id)
        if not doc:
            raise ResourceNotFoundError(resource_type="Submission", resource_id=submission_id)

        storage_key = doc.get("storage_key")
        if storage_key:
            self.storage.delete_storage(storage_key)

        return self.repo.delete(submission_id)

    @staticmethod
    def _to_response(doc: dict) -> SubmissionResponse:
        sub_type_val = doc.get("submission_type", SubmissionType.FILE.value)
        try:
            status_val = SubmissionStatus(doc.get("status", SubmissionStatus.QUEUED.value))
        except (ValueError, KeyError):
            status_val = SubmissionStatus.COMPLETED

        return SubmissionResponse(
            submission_id=doc["_id"],
            project_id=doc["project_id"],
            owner_id=doc.get("owner_id", "demo-user"),
            parent_submission_id=doc.get("parent_submission_id"),
            original_filename=doc.get("original_filename", "submission.py"),
            submission_type=SubmissionType(sub_type_val),
            language=doc.get("language", "python"),
            source_sha256=doc["source_sha256"],
            size_bytes=doc["size_bytes"],
            total_files=doc.get("total_files", 1),
            source_files_count=doc.get("source_files_count", 1),
            source_files=doc.get("source_files", []),
            status=status_val,
            error_details=doc.get("error_details"),
            created_at=doc["created_at"],
            updated_at=doc.get("updated_at") or doc.get("created_at"),
        )


submission_service = SubmissionService()
