from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "StudyBuddy"
    DEBUG: bool = True
    FRONTEND_URL: str = "http://localhost:5173"

    DATABASE_URL: str = "postgresql+psycopg://studybuddy:studybuddy@localhost:5432/studybuddy"

    SECRET_KEY: str = "change-me-to-something-long-and-secure"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    RESET_TOKEN_EXPIRE_MINUTES: int = 30
    EMAIL_VERIFY_TOKEN_EXPIRE_HOURS: int = 48
    ALGORITHM: str = "HS256"

    ANTHROPIC_API_KEY: str = ""
    AI_MODEL: str = "claude-sonnet-4-6"

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "StudyBuddy <no-reply@studybuddy.local>"
    SMTP_TLS: bool = True

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_MB: int = 20


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
