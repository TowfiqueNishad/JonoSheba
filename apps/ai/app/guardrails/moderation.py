"""Moderation, PII redaction, prompt-injection defense, and R8 emergency detection."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.telemetry import redact_pii_text

_INJECTION_PATTERNS: list[tuple[re.Pattern[str], float, str]] = [
    (
        re.compile(r"ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions", re.I),
        0.95,
        "ignore_instructions",
    ),
    (
        re.compile(r"(?:reveal|print|show)\s+(?:your\s+)?system\s+prompt", re.I),
        0.95,
        "system_prompt_exfil",
    ),
    (
        re.compile(
            r"(?:act|pretend)\s+as\s+(?:an?\s+)?(?:official\s+government|admin|root)", re.I
        ),
        0.85,
        "role_impersonation",
    ),
    (
        re.compile(r"(?:book|buy|reserve)\s+(?:the\s+)?ticket\s+for\s+me", re.I),
        0.80,
        "auto_booking_violation_r4",
    ),
    (
        re.compile(r"(?:bypass|skip)\s+(?:captcha|queue|rate\s*limit)", re.I),
        0.95,
        "bypass_violation_r2",
    ),
    (re.compile(r"পূর্বের\s+নির্দেশ\s+ভুলে\s+যাও", re.I), 0.95, "ignore_instructions_bn"),
]

_ABUSE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\b(?:kill\s+you|bomb\s+attack|terrorist\s+attack)\b", re.I),
    re.compile(r"(?:খুন\s+করব|বোমা\s+মারব)", re.I),
]

_EMERGENCY_SELF_HARM_PATTERNS: list[re.Pattern[str]] = [
    re.compile(
        r"\b(?:suicide|kill\s+myself|self\s*harm|overdose|chest\s+pain|unconscious)\b",
        re.I,
    ),
    re.compile(r"(?:আত্মহত্যা|নিজেকে\s+শেষ|বুক\s+ব্যথা|অজ্ঞান|আগুন\s+লেগেছে)", re.I),
]


@dataclass(frozen=True)
class ModerationResult:
    flagged: bool
    abuse_detected: bool
    pii_detected: bool
    pii_types: list[str]
    redacted_text: str
    prompt_injection_score: float
    injection_signals: list[str]
    emergency_or_self_harm: bool
    recommended_hotline: str | None


def moderate_text(text: str) -> ModerationResult:
    redacted, pii_types = redact_pii_text(text)

    injection_score = 0.0
    injection_signals: list[str] = []
    for pattern, weight, tag in _INJECTION_PATTERNS:
        if pattern.search(text):
            injection_score = max(injection_score, weight)
            injection_signals.append(tag)

    abuse_detected = any(pat.search(text) for pat in _ABUSE_PATTERNS)
    emergency = any(pat.search(text) for pat in _EMERGENCY_SELF_HARM_PATTERNS)

    flagged = abuse_detected or injection_score >= 0.7
    return ModerationResult(
        flagged=flagged,
        abuse_detected=abuse_detected,
        pii_detected=len(pii_types) > 0,
        pii_types=pii_types,
        redacted_text=redacted,
        prompt_injection_score=round(injection_score, 3),
        injection_signals=injection_signals,
        emergency_or_self_harm=emergency,
        recommended_hotline="999" if emergency else None,
    )
