from pathlib import Path
from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    UPLOAD_DIR: str = "./storage/uploads"
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
    def resolved_upload_dir(self) -> Path:
        path = Path(self.UPLOAD_DIR).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path


settings = Settings()
