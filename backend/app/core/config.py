from pathlib import Path
from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def find_project_root() -> Path:
    """
    Locates the project root directory regardless of current working directory.
    Climbs parent directories looking for markers like docker-compose.yml, .git, or storage.
    """
    current = Path(__file__).resolve().parent
    for parent in [current] + list(current.parents):
        if (parent / "docker-compose.yml").exists() or (parent / ".git").exists():
            return parent
        if (parent / "backend").exists() and (parent / "frontend").exists():
            return parent
        if (parent / "storage").is_dir() or (parent / "Storage").is_dir():
            return parent

    if (Path("/app") / "app").exists():
        return Path("/app")

    try:
        return Path(__file__).resolve().parents[3]
    except IndexError:
        return Path.cwd()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_ENV: str = "development"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DATABASE: str = "codeorigin_ai"
    MONGODB_CONNECT_TIMEOUT_MS: int = 3000

    STORAGE_DIR: str = "storage"
    UPLOAD_DIR: str = "storage/uploads"
    MAX_UPLOAD_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: Union[List[str], str] = [".py", ".zip", ".tar.gz", ".tgz", ".tar"]

    ANALYSIS_TIMEOUT_SECONDS: int = 20

    GITHUB_TOKEN: str = ""
    GITHUB_DEFAULT_REPOSITORY: str = ""

    @field_validator("ALLOWED_EXTENSIONS", mode="before")
    @classmethod
    def parse_allowed_extensions(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [ext.strip().lower() for ext in v.split(",") if ext.strip()]
        return [ext.lower() for ext in v]

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @property
    def project_root(self) -> Path:
        return find_project_root()

    @property
    def resolved_storage_dir(self) -> Path:
        # Check if an explicit absolute UPLOAD_DIR or STORAGE_DIR was passed (e.g. pytest tempdir)
        if Path(self.UPLOAD_DIR).is_absolute():
            base = Path(self.UPLOAD_DIR).resolve()
            base.mkdir(parents=True, exist_ok=True)
            return base

        raw_storage = self.STORAGE_DIR
        if Path(raw_storage).is_absolute():
            base = Path(raw_storage).resolve()
        else:
            root = self.project_root
            if (root / "Storage").is_dir():
                base = (root / "Storage").resolve()
            else:
                base = (root / "storage").resolve()
        base.mkdir(parents=True, exist_ok=True)
        return base

    @property
    def resolved_upload_dir(self) -> Path:
        if Path(self.UPLOAD_DIR).is_absolute():
            path = Path(self.UPLOAD_DIR).resolve()
        else:
            path = self.resolved_storage_dir / "uploads"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def resolved_processed_dir(self) -> Path:
        path = self.resolved_storage_dir / "processed"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def resolved_generated_dir(self) -> Path:
        path = self.resolved_storage_dir / "generated"
        path.mkdir(parents=True, exist_ok=True)
        return path


settings = Settings()
