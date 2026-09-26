import os
from functools import lru_cache
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings:
    def __init__(self) -> None:
        self.database_url = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'fireflies.db'}")
        self.cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY") or None
        self.anthropic_model = os.getenv("ANTHROPIC_MODEL", "claude-opus-5")
        self.seed_on_startup = os.getenv("SEED_ON_STARTUP", "true").lower() == "true"


@lru_cache
def get_settings() -> Settings:
    return Settings()
