from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "D&D 5e Campaign Manager"
    DATABASE_URL: str = "sqlite+aiosqlite:///./dnd_campaign.db"
    SECRET_KEY: str = "super-secret-dm-screen-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 часа на игровую сессию

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
