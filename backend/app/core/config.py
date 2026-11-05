from pathlib import Path
from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def find_project_root() -> Path:
    """
    Locates the project root directory regardless of current working directory.
    Climbs parent directories looking for markers like backend+frontend or docker-compose.yml.
    """
    if (Path("/app") / "app").exists():
        return Path("/app")

    current = Path(__file__).resolve().parent
    for parent in [current] + list(current.parents):
        # The true repository root has both backend and frontend directories
        if (parent / "backend").is_dir() and (parent / "frontend").is_dir():
            return parent
        if (parent / "docker-compose.yml").is_file():
            return parent
        if (parent / ".git").is_dir() or (parent / ".git").is_file():
            return parent

    try:
        return Path(__file__).resolve().parents[2]
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
        # Check if an explicit absolute STORAGE_DIR or UPLOAD_DIR was passed (e.g. pytest tempdir or container)
        if Path(self.STORAGE_DIR).is_absolute():
            base = Path(self.STORAGE_DIR).resolve()
        elif Path(self.UPLOAD_DIR).is_absolute():
            upload_path = Path(self.UPLOAD_DIR).resolve()
            if upload_path.name.lower() in {"uploads", "upload"}:
                base = upload_path.parent
            else:
                base = upload_path
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

    @property
    def resolved_data_dir(self) -> Path:
        path = self.resolved_storage_dir / "data"
        path.mkdir(parents=True, exist_ok=True)
        return path


settings = Settings()
