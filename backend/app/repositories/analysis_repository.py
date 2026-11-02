from typing import Dict, List, Optional
from pymongo.collection import Collection

from app.core.database import get_db
from app.core.errors import PersistenceError
from app.core.logging import logger


class AnalysisRepository:
    def __init__(self):
        self._memory_store: Dict[str, dict] = {}

    @property
    def _collection(self) -> Optional[Collection]:
        db = get_db()
        return db.analysis_runs if db is not None else None

    def insert(self, analysis_data: dict) -> dict:
        analysis_id = analysis_data["_id"]
        col = self._collection

        if col is not None:
            try:
                col.insert_one(analysis_data)
                logger.info(f"Inserted analysis run {analysis_id} into MongoDB.")
            except Exception as err:
                logger.error(f"MongoDB insert failed for analysis {analysis_id}: {err}")
                raise PersistenceError(
                    message="Failed to persist analysis results to database.",
                    details=str(err),
                )
        else:
            logger.info(f"Storing analysis {analysis_id} in memory fallback.")
            self._memory_store[analysis_id] = analysis_data

        return analysis_data

    def find_by_id(self, analysis_id: str) -> Optional[dict]:
        col = self._collection
        if col is not None:
            try:
                return col.find_one({"_id": analysis_id})
            except Exception as err:
                logger.error(f"MongoDB query failed for analysis {analysis_id}: {err}")
                raise PersistenceError(
                    message="Failed to retrieve analysis run from database.",
                    details=str(err),
                )
        return self._memory_store.get(analysis_id)

    def find_by_submission_id(self, submission_id: str) -> Optional[dict]:
        col = self._collection
        if col is not None:
            try:
                # Return most recent analysis run for this submission
                return col.find_one({"submission_id": submission_id}, sort=[("created_at", -1)])
            except Exception as err:
                logger.error(f"MongoDB query failed for submission analysis {submission_id}: {err}")
                raise PersistenceError(
                    message="Failed to retrieve submission analysis from database.",
                    details=str(err),
                )
        matches = [x for x in self._memory_store.values() if x.get("submission_id") == submission_id]
        if matches:
            matches.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
            return matches[0]
        return None

    def delete_by_submission_id(self, submission_id: str) -> int:
        col = self._collection
        if col is not None:
            try:
                res = col.delete_many({"submission_id": submission_id})
                return res.deleted_count
            except Exception as err:
                logger.error(f"MongoDB delete failed for analysis of {submission_id}: {err}")
                return 0
        else:
            keys_to_del = [k for k, v in self._memory_store.items() if v.get("submission_id") == submission_id]
            for k in keys_to_del:
                del self._memory_store[k]
            return len(keys_to_del)


analysis_repository = AnalysisRepository()
