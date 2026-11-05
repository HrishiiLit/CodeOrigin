import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from pymongo.collection import Collection

from app.core.config import settings
from app.core.database import get_db
from app.core.errors import PersistenceError
from app.core.logging import logger
from app.repositories.fallback_store import PersistentFileStore


class SubmissionRepository:
    def __init__(self):
        # Persistent JSON file fallback when MongoDB is unavailable
        self._store = PersistentFileStore("submissions.json")

    @property
    def _memory_store(self) -> Dict[str, dict]:
        """Backwards compatibility for tests directly inspecting _memory_store."""
        return self._store._data

    @property
    def _collection(self) -> Optional[Collection]:
        db = get_db()
        return db.submissions if db is not None else None

    def insert(self, submission_data: dict) -> dict:
        """
        Inserts a submission document.
        Uses MongoDB if connected; otherwise persists to fallback store.
        """
        sub_id = submission_data["_id"]
        col = self._collection

        if col is not None:
            try:
                col.insert_one(submission_data)
                logger.info(f"Inserted submission {sub_id} into MongoDB.")
            except Exception as err:
                logger.error(f"MongoDB insert failed for submission {sub_id}: {err}")
                raise PersistenceError(
                    message="Failed to persist submission metadata to database.",
                    details=str(err),
                )
        else:
            logger.info(f"MongoDB not connected. Persisting submission {sub_id} to disk store.")
            self._store.set(sub_id, submission_data)

        return submission_data

    def find_by_id(self, submission_id: str) -> Optional[dict]:
        col = self._collection
        if col is not None:
            try:
                doc = col.find_one({"_id": submission_id})
                if doc:
                    return doc
            except Exception as err:
                logger.error(f"MongoDB query failed for submission {submission_id}: {err}")
                raise PersistenceError(
                    message="Failed to retrieve submission from database.",
                    details=str(err),
                )
        return self._store.get(submission_id)

    def list_submissions(
        self,
        project_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[dict], int]:
        col = self._collection
        query: dict = {}
        if project_id:
            query["project_id"] = project_id
        if status:
            query["status"] = status

        if col is not None:
            try:
                cursor = col.find(query).sort("created_at", -1).skip(offset).limit(limit)
                total = col.count_documents(query)
                return list(cursor), total
            except Exception as err:
                logger.error(f"MongoDB list query failed: {err}")
                raise PersistenceError(
                    message="Failed to list submissions from database.",
                    details=str(err),
                )
        else:
            items = self._store.values()
            if project_id:
                items = [x for x in items if x.get("project_id") == project_id]
            if status:
                items = [x for x in items if x.get("status") == status]
            items.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
            total = len(items)
            return items[offset : offset + limit], total

    def update_status(
        self,
        submission_id: str,
        status: str,
        error_details: Optional[str] = None,
    ) -> bool:
        col = self._collection
        update_fields = {
            "status": status,
            "error_details": error_details,
            "updated_at": datetime.now(timezone.utc),
        }

        if col is not None:
            try:
                result = col.update_one({"_id": submission_id}, {"$set": update_fields})
                return result.matched_count > 0
            except Exception as err:
                logger.error(f"MongoDB status update failed: {err}")
                return False
        else:
            return self._store.update(submission_id, update_fields)

    def delete(self, submission_id: str) -> bool:
        col = self._collection
        if col is not None:
            try:
                res = col.delete_one({"_id": submission_id})
                return res.deleted_count > 0
            except Exception as err:
                logger.error(f"MongoDB delete failed for {submission_id}: {err}")
                raise PersistenceError(message="Failed to delete submission from database.", details=str(err))
        else:
            return self._store.pop(submission_id) is not None

    def reconcile_untracked_files(self) -> int:
        """
        Scans storage/uploads for existing files that may have been created
        in previous sessions, ensuring they appear even across server restarts.
        """
        uploads_dir = settings.resolved_upload_dir
        if not uploads_dir.is_dir():
            return 0

        existing_keys = set()
        col = self._collection
        if col is not None:
            try:
                for doc in col.find({}, {"storage_key": 1}):
                    if "storage_key" in doc:
                        existing_keys.add(doc["storage_key"])
            except Exception:
                pass

        for doc in self._store.values():
            if "storage_key" in doc:
                existing_keys.add(doc["storage_key"])

        reconciled = 0
        for item in uploads_dir.iterdir():
            if item.name.startswith(".") or item.name == ".gitkeep":
                continue

            rel_key = f"uploads/{item.name}"
            if rel_key in existing_keys:
                continue

            try:
                stats = item.stat()
                sha256 = hashlib.sha256()
                if item.is_file():
                    with open(item, "rb") as f:
                        for chunk in iter(lambda: f.read(65536), b""):
                            sha256.update(chunk)
                    size = stats.st_size
                    is_repo = False
                    total_files = 1
                    source_files_count = 1 if item.suffix.lower() == ".py" else 0
                else:
                    size = 0
                    is_repo = True
                    total_files = len([f for f in item.rglob("*") if f.is_file()])
                    source_files_count = len([f for f in item.rglob("*.py") if f.is_file()])

                stem = item.stem
                try:
                    uuid.UUID(stem)
                    sub_id = stem
                except ValueError:
                    sub_id = str(uuid.uuid4())

                clean_name = item.name
                if len(clean_name) > 36 and clean_name[36:37] in {"_", "-"}:
                    clean_name = clean_name[37:]

                doc = {
                    "_id": sub_id,
                    "project_id": str(uuid.uuid4()),
                    "parent_submission_id": None,
                    "owner_id": "student-alex",
                    "submission_type": "repository" if is_repo else "file",
                    "original_filename": clean_name,
                    "storage_key": rel_key,
                    "source_sha256": sha256.hexdigest(),
                    "size_bytes": size,
                    "status": "completed",
                    "created_at": datetime.fromtimestamp(stats.st_mtime, timezone.utc).isoformat(),
                    "total_files": total_files,
                    "source_files_count": source_files_count,
                }
                self.insert(doc)
                reconciled += 1
                logger.info(f"Reconciled prior upload into submission {sub_id} ({item.name})")
            except Exception as err:
                logger.warning(f"Could not reconcile upload {item.name}: {err}")

        return reconciled


submission_repository = SubmissionRepository()
