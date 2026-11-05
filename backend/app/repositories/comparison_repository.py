from typing import Dict, Optional
from pymongo.collection import Collection

from app.core.database import get_db
from app.core.errors import PersistenceError
from app.core.logging import logger


class ComparisonRepository:
    def __init__(self):
        self._memory_store: Dict[str, dict] = {}

    @property
    def _collection(self) -> Optional[Collection]:
        db = get_db()
        return db.comparisons if db is not None else None

    def insert(self, comparison_data: dict) -> dict:
        comp_id = comparison_data["_id"]
        col = self._collection

        if col is not None:
            try:
                col.insert_one(comparison_data)
                logger.info(f"Inserted comparison {comp_id} into MongoDB.")
            except Exception as err:
                logger.error(f"MongoDB insert failed for comparison {comp_id}: {err}")
                raise PersistenceError(
                    message="Failed to persist revision comparison to database.",
                    details=str(err),
                )
        else:
            self._memory_store[comp_id] = comparison_data

        return comparison_data

    def find_by_id(self, comparison_id: str) -> Optional[dict]:
        col = self._collection
        if col is not None:
            try:
                return col.find_one({"_id": comparison_id})
            except Exception as err:
                logger.error(f"MongoDB query failed for comparison {comparison_id}: {err}")
                raise PersistenceError(
                    message="Failed to retrieve comparison from database.",
                    details=str(err),
                )
        return self._memory_store.get(comparison_id)

    def find_by_pair(self, base_id: str, target_id: str) -> Optional[dict]:
        col = self._collection
        if col is not None:
            try:
                return col.find_one({
                    "base_submission_id": base_id,
                    "target_submission_id": target_id,
                }, sort=[("created_at", -1)])
            except Exception as err:
                logger.error(f"MongoDB query failed for pair ({base_id}, {target_id}): {err}")
                return None
        matches = [
            x for x in self._memory_store.values()
            if x.get("base_submission_id") == base_id and x.get("target_submission_id") == target_id
        ]
        return matches[0] if matches else None


comparison_repository = ComparisonRepository()
