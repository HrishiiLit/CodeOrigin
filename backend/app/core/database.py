from typing import Optional
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, PyMongoError

from app.core.config import settings
from app.core.logging import logger


class DatabaseManager:
    client: Optional[MongoClient] = None
    db: Optional[Database] = None

    @classmethod
    def connect(cls) -> bool:
        try:
            logger.info(f"Connecting to MongoDB at {settings.MONGODB_URI}...")
            cls.client = MongoClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=settings.MONGODB_CONNECT_TIMEOUT_MS,
                connectTimeoutMS=settings.MONGODB_CONNECT_TIMEOUT_MS,
            )
            # Verify connectivity
            cls.client.admin.command("ping")
            cls.db = cls.client[settings.MONGODB_DATABASE]
            logger.info(f"Connected successfully to MongoDB database: {settings.MONGODB_DATABASE}")
            cls.init_indexes()
            return True
        except (ConnectionFailure, PyMongoError) as err:
            logger.warning(f"Could not connect to MongoDB: {err}. Backend running in degraded mode.")
            cls.db = None
            return False

    @classmethod
    def disconnect(cls) -> None:
        if cls.client:
            logger.info("Closing MongoDB connection.")
            cls.client.close()
            cls.client = None
            cls.db = None

    @classmethod
    def is_connected(cls) -> bool:
        if cls.client is None:
            return False
        try:
            cls.client.admin.command("ping")
            return True
        except PyMongoError:
            return False

    @classmethod
    def get_db(cls) -> Optional[Database]:
        return cls.db

    @classmethod
    def init_indexes(cls) -> None:
        if cls.db is None:
            return
        try:
            # projects indexes
            cls.db.projects.create_index([("owner_id", 1)])
            cls.db.projects.create_index([("created_at", -1)])

            # submissions indexes
            cls.db.submissions.create_index([("project_id", 1), ("created_at", -1)])
            cls.db.submissions.create_index([("owner_id", 1), ("created_at", -1)])
            cls.db.submissions.create_index([("parent_submission_id", 1)])
            cls.db.submissions.create_index([("source_sha256", 1)])

            # analysis_runs indexes
            cls.db.analysis_runs.create_index([("submission_id", 1)])

            # comparisons indexes
            cls.db.comparisons.create_index([("base_submission_id", 1), ("target_submission_id", 1)])

            # reviews indexes
            cls.db.reviews.create_index([("submission_id", 1)])

            logger.info("Database indexes initialized successfully.")
        except Exception as e:
            logger.warning(f"Failed to initialize database indexes: {e}")


def get_db() -> Optional[Database]:
    return DatabaseManager.get_db()
