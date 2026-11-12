from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 480
    cors_origins: str = "http://localhost:5173"
    upload_dir: str = "uploads"


@lru_cache
def get_app_settings() -> Settings:
    return Settings()  # raises a validation error if DATABASE_URL or JWT_SECRET is missing
