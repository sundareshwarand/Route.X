from pathlib import Path
from typing import List, Union
from pydantic import Field, AliasChoices, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "RouteX - Intelligent Emergency Traffic Management System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = Field(default="development", validation_alias=AliasChoices("ENVIRONMENT", "ROUTEX_ENV", "NODE_ENV"))
    
    # Server Binding
    HOST: str = Field(default="0.0.0.0", validation_alias=AliasChoices("HOST", "ROUTEX_HOST"))
    PORT: int = Field(default=8000, validation_alias=AliasChoices("PORT", "ROUTEX_PORT"))
    
    # Security
    SECRET_KEY: str = "routex-dev-secret-key-change-in-production-123456789"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    
    # Database
    DATABASE_URL: str = "sqlite:///./routex.db"
    
    # Operational limits & timing
    DEFAULT_PRIORITY_TIMEOUT_SECONDS: int = 20
    REQUEST_EXPIRY_SECONDS: int = 60
    HEARTBEAT_TIMEOUT_SECONDS: int = 45
    
    # LoRa / Hardware safety
    REQUIRE_VERIFIED_DEVICE_AUTH: bool = True
    SIMULATED_MODE_ALLOWED: bool = True
    
    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                import json
                try:
                    return json.loads(v_stripped)
                except Exception:
                    pass
            return [origin.strip() for origin in v_stripped.split(",") if origin.strip()]
        return v

    # Google Gemini AI Advisory Integration
    GEMINI_API_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("GEMINI_API_KEY", "ROUTEX_GEMINI_API_KEY")
    )
    GEMINI_MODEL: str = Field(
        default="gemini-3.5-flash",
        validation_alias=AliasChoices("GEMINI_MODEL", "ROUTEX_GEMINI_MODEL")
    )

    model_config = SettingsConfigDict(
        env_file=(str(Path(__file__).resolve().parent.parent / ".env"), ".env"),
        env_prefix="ROUTEX_",
        extra="ignore"
    )



settings = Settings()
