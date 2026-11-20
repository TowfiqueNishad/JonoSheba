"""Internal service-to-service JWT authentication for apps/ai.

Only apps/api and apps/workers may invoke internal AI endpoints.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Annotated, Any

from fastapi import Depends, Header, HTTPException, status

from app.config import Settings, get_settings


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * ((4 - len(segment) % 4) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def create_service_jwt(
    secret: str,
    subject: str = "jonoshheba-api",
    ttl_seconds: int = 300,
) -> str:
    """Signs a short-lived HS256 internal service JWT."""
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "iss": "jonoshheba-api",
        "aud": "jonoshheba-ai",
        "sub": subject,
        "iat": now,
        "exp": now + ttl_seconds,
    }
    h_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{h_b64}.{p_b64}".encode("ascii")
    sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{h_b64}.{p_b64}.{_b64url_encode(sig)}"


def verify_service_jwt(token: str, secret: str) -> dict[str, Any]:
    """Verifies signature, issuer, audience, and expiration of an internal service JWT."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Malformed service JWT")

    h_b64, p_b64, s_b64 = parts
    signing_input = f"{h_b64}.{p_b64}".encode("ascii")
    expected_sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    actual_sig = _b64url_decode(s_b64)
    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ValueError("Invalid service JWT signature")

    payload: dict[str, Any] = json.loads(_b64url_decode(p_b64).decode("utf-8"))
    if payload.get("aud") != "jonoshheba-ai":
        raise ValueError("Invalid JWT audience")
    exp = payload.get("exp")
    if not isinstance(exp, int) or exp < int(time.time()):
        raise ValueError("Expired service JWT")
    return payload


def require_service_auth(
    authorization: Annotated[str | None, Header()] = None,
    settings: Annotated[Settings, Depends(get_settings)] = ...,  # type: ignore[assignment]
) -> dict[str, Any]:
    """FastAPI dependency enforcing internal service JWT authentication."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Internal service JWT required",
        )
    token = authorization[7:].strip()
    try:
        return verify_service_jwt(token, settings.ai_service_jwt_secret)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid internal service token: {exc}",
        ) from exc
