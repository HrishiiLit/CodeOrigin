import json
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.core.logging import logger


def _json_serial(obj: Any) -> Any:
    """JSON serializer for objects not serializable by default json code."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


class PersistentFileStore:
    """
    Thread-safe JSON-backed storage used as a persistent fallback
    when MongoDB is not reachable. Data is written to `storage/data/<filename>.json`
    so submissions and metadata survive full server restarts.
    """

    def __init__(self, filename: str):
        self.filename = filename
        self._lock = threading.Lock()
        self._data: Dict[str, dict] = {}
        self._load()

    @property
    def file_path(self) -> Path:
        return settings.resolved_data_dir / self.filename

    def _load(self) -> None:
        with self._lock:
            path = self.file_path
            if path.is_file():
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        loaded = json.load(f)
                    if isinstance(loaded, dict):
                        self._data = loaded
                    elif isinstance(loaded, list):
                        self._data = {item.get("_id", str(idx)): item for idx, item in enumerate(loaded)}
                    logger.info(f"Loaded {len(self._data)} records from persistent store: {path.name}")
                except Exception as err:
                    logger.warning(f"Failed to read persistent store {path.name}: {err}")
                    self._data = {}
            else:
                self._data = {}

    def _save(self) -> None:
        """Saves current state atomically to disk."""
        path = self.file_path
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = path.with_suffix(".tmp")
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2, default=_json_serial)
            tmp_path.replace(path)
        except Exception as err:
            logger.error(f"Failed to persist store to {path.name}: {err}")

    def get(self, key: str) -> Optional[dict]:
        with self._lock:
            item = self._data.get(key)
            return dict(item) if item is not None else None

    def set(self, key: str, value: dict) -> dict:
        with self._lock:
            # Normalize datetime to isoformat for consistent storage
            serialized = {}
            for k, v in value.items():
                if isinstance(v, datetime):
                    serialized[k] = v.isoformat()
                else:
                    serialized[k] = v
            self._data[key] = serialized
            self._save()
            return dict(serialized)

    def values(self) -> List[dict]:
        with self._lock:
            return [dict(v) for v in self._data.values()]

    def update(self, key: str, fields: dict) -> bool:
        with self._lock:
            if key in self._data:
                for k, v in fields.items():
                    if isinstance(v, datetime):
                        self._data[key][k] = v.isoformat()
                    else:
                        self._data[key][k] = v
                self._save()
                return True
            return False

    def pop(self, key: str, default: Any = None) -> Optional[dict]:
        with self._lock:
            val = self._data.pop(key, default)
            if val is not None:
                self._save()
            return val

    def count(self) -> int:
        with self._lock:
            return len(self._data)
