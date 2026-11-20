"""Phase 01 tests for apps/ai health endpoint and fail-fast config validation."""

from __future__ import annotations

import asyncio

import httpx
import pytest
from pydantic import ValidationError

from app.config import Settings
from app.main import app


def test_health_endpoint_returns_200() -> None:
    async def _call() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get("/health")

    response = asyncio.run(_call())
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "jonoshheba-ai"
    assert body["timezone"] == "Asia/Dhaka"


def test_settings_fail_fast_on_production_default_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(app_env="production")


def test_settings_fail_fast_on_short_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(ai_service_jwt_secret="too-short")
