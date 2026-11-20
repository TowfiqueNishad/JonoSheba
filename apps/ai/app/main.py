"""Jonoshheba AI FastAPI entry point (Phase 09 AI Foundation & Model Gateway)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

from app.api.routes import internal_router, observability_router
from app.config import get_settings


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "down"]
    service: str
    version: str
    timestamp: str
    timezone: Literal["Asia/Dhaka"]


def create_app() -> FastAPI:
    # Validate configuration eagerly at boot (fail fast).
    settings = get_settings()

    application = FastAPI(
        title="Jonoshheba AI Service (Internal)",
        description=(
            "Internal RAG, NLP, OCR, Speech, and ML service for Jonoshheba AI. "
            "Never exposed directly to the public internet."
        ),
        version="0.2.0",
    )
    application.state.settings = settings

    @application.get("/health", response_model=HealthResponse, tags=["System"])
    def health() -> HealthResponse:
        return HealthResponse(
            status="ok",
            service="jonoshheba-ai",
            version="0.2.0",
            timestamp=datetime.now(UTC).isoformat(),
            timezone="Asia/Dhaka",
        )

    @application.get("/ready", response_model=HealthResponse, tags=["System"])
    def ready() -> HealthResponse:
        return HealthResponse(
            status="ok",
            service="jonoshheba-ai",
            version="0.2.0",
            timestamp=datetime.now(UTC).isoformat(),
            timezone="Asia/Dhaka",
        )

    application.include_router(observability_router)
    application.include_router(internal_router)

    return application


app = create_app()
