from typing import Dict, List, Optional
from pymongo.collection import Collection

from app.core.database import get_db
from app.core.errors import PersistenceError
from app.core.logging import logger


class ReviewRepository:
    def __init__(self):
        self._memory_store: Dict[str, dict] = {}

    @property
    def _collection(self) -> Optional[Collection]:
        db = get_db()
        return db.reviews if db is not None else None

    def insert(self, review_data: dict) -> dict:
        review_id = review_data["_id"]
        col = self._collection

        if col is not None:
            try:
                col.insert_one(review_data)
                logger.info(f"Inserted review {review_id} into MongoDB.")
            except Exception as err:
                logger.error(f"MongoDB insert failed for review {review_id}: {err}")
                raise PersistenceError(
                    message="Failed to persist review note to database.",
                    details=str(err),
                )
        else:
            self._memory_store[review_id] = review_data

        return review_data

    def find_by_id(self, review_id: str) -> Optional[dict]:
        col = self._collection
        if col is not None:
            try:
                return col.find_one({"_id": review_id})
            except Exception as err:
                logger.error(f"MongoDB query failed for review {review_id}: {err}")
                raise PersistenceError(
                    message="Failed to retrieve review from database.",
                    details=str(err),
                )
        return self._memory_store.get(review_id)

    def list_by_submission_id(self, submission_id: str) -> List[dict]:
        col = self._collection
        if col is not None:
            try:
                cursor = col.find({"submission_id": submission_id}).sort("created_at", -1)
                return list(cursor)
            except Exception as err:
                logger.error(f"MongoDB query failed for submission reviews {submission_id}: {err}")
                raise PersistenceError(
                    message="Failed to list reviews from database.",
                    details=str(err),
                )
        matches = [x for x in self._memory_store.values() if x.get("submission_id") == submission_id]
        matches.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
        return matches


review_repository = ReviewRepository()
