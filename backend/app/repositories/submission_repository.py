from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from pymongo.collection import Collection

from app.core.database import get_db
from app.core.errors import PersistenceError
from app.core.logging import logger


class SubmissionRepository:
    def __init__(self):
        # In-memory store fallback when MongoDB is unavailable (e.g. initial offline setup/tests)
        self._memory_store: Dict[str, dict] = {}

    @property
    def _collection(self) -> Optional[Collection]:
        db = get_db()
        return db.submissions if db is not None else None

    def insert(self, submission_data: dict) -> dict:
        """
        Inserts a submission document.
        Uses MongoDB if connected; otherwise falls back to memory store.
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
            logger.warning(f"MongoDB not connected. Storing submission {sub_id} in memory fallback.")
            self._memory_store[sub_id] = submission_data

        return submission_data

    def find_by_id(self, submission_id: str) -> Optional[dict]:
        col = self._collection
        if col is not None:
            try:
                doc = col.find_one({"_id": submission_id})
                return doc
            except Exception as err:
                logger.error(f"MongoDB query failed for submission {submission_id}: {err}")
                raise PersistenceError(
                    message="Failed to retrieve submission from database.",
                    details=str(err),
                )
        return self._memory_store.get(submission_id)

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
            items = list(self._memory_store.values())
            if project_id:
                items = [x for x in items if x.get("project_id") == project_id]
            if status:
                items = [x for x in items if x.get("status") == status]
            items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
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
            if submission_id in self._memory_store:
                self._memory_store[submission_id].update(update_fields)
                return True
            return False


submission_repository = SubmissionRepository()
