"""Core configuration for Jonoshheba AI service (fail-fast pydantic-settings)."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "test", "staging", "production"] = "development"
    ai_host: str = "0.0.0.0"
    ai_port: int = Field(default=8000, ge=1, le=65535)
    app_timezone: Literal["Asia/Dhaka"] = "Asia/Dhaka"

    ai_service_jwt_secret: str = Field(
        default="dev_only_replace_with_32_byte_internal_ai_shared_secret",
        min_length=32,
    )

    llm_provider: Literal["gemini", "openai", "anthropic", "ollama", "mock"] = "ollama"
    llm_api_key: str = ""
    llm_model_fast: str = "qwen2.5:7b-instruct"
    llm_model_strong: str = "qwen2.5:14b-instruct"
    ollama_base_url: str = "http://localhost:11434"
    embedding_model: str = "BAAI/bge-m3"
    reranker_model: str = "BAAI/bge-reranker-v2-m3"
    device: Literal["cpu", "cuda", "mps"] = "cpu"

    database_url: str = (
        "postgresql://jonoshheba:jonoshheba_dev_password_change_me@localhost:5432/jonoshheba"
    )
    redis_url: str = "redis://localhost:6379/1"
    mlflow_tracking_uri: str = "http://localhost:5000"
    otel_exporter_otlp_endpoint: str = "http://localhost:4318"
    sentry_dsn: str = ""

    @model_validator(mode="after")
    def validate_production_safety(self) -> Settings:
        if self.app_env == "production":
            if self.ai_service_jwt_secret.startswith("dev_only_"):
                raise ValueError(
                    "Production boot refused: AI_SERVICE_JWT_SECRET uses development default."
                )
            if self.llm_provider in {"gemini", "openai", "anthropic"} and not self.llm_api_key:
                raise ValueError(
                    f"Production boot refused: LLM_API_KEY is required for {self.llm_provider}."
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
