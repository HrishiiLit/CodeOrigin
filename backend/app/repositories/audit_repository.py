import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional
from pymongo.collection import Collection

from app.core.database import get_db
from app.core.logging import logger
from app.repositories.fallback_store import PersistentFileStore


class AuditRepository:
    def __init__(self):
        self._store = PersistentFileStore("audit_events.json")

    @property
    def _memory_store(self) -> List[dict]:
        """Backwards compatibility for tests checking _memory_store list."""
        return self._store.values()

    @property
    def _collection(self) -> Optional[Collection]:
        db = get_db()
        return db.audit_events if db is not None else None

    def log_event(self, action: str, actor_id: str, details: Optional[dict] = None) -> dict:
        event = {
            "_id": str(uuid.uuid4()),
            "action": action,
            "actor_id": actor_id,
            "details": details or {},
            "created_at": datetime.now(timezone.utc),
        }
        col = self._collection
        if col is not None:
            try:
                col.insert_one(event)
            except Exception as err:
                logger.warning(f"Could not persist audit event to MongoDB: {err}")
        else:
            self._store.set(event["_id"], event)

        logger.info(f"Audit event logged: {action} by {actor_id}")
        return event


audit_repository = AuditRepository()
