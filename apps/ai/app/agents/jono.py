"""Jono (জনো) — Jonoshheba's grounded, tool-calling citizen-service AI assistant (Phase 11).

Strictly obeys AGENTS.md Rules R1-R11:
- R1/R4: Never books tickets, submits applications, or fabricates status.
- R5: Every fact carries trust_label, source_url, agency, and last_verified_at.
- R7: Deterministic eligibility & zero medical diagnosis.
- R8: Emergency fast-path returns 999 immediately without waiting on an LLM.
- R9/R10: PII redacted before memory persistence; sessions strictly isolated per user_id.
- R11: Independent platform disclaimer on every response.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal

from app.core.telemetry import redact_pii_text
from app.guardrails.moderation import moderate_text
from app.nlp.bangla import detect_language
from app.nlp.ner_intent import classify_intent, extract_entities
from app.rag.pipeline import RagPipeline, rag_pipeline, serialize_answer

_MEDICAL_DIAGNOSIS_TERMS = (
    "diagnose",
    "prescription",
    "medicine for",
    "what disease",
    "রোগ নির্ণয়",
    "কোন ওষুধ খাব",
    "প্রেসক্রিপশন",
    "আমার কি ডেঙ্গু হয়েছে",
    "কি রোগ হয়েছে",
)


@dataclass
class ChatTurn:
    turn_id: str
    role: Literal["user", "assistant"]
    text: str
    created_at: str
    intent: str | None = None
    tools_used: list[str] = field(default_factory=list)


@dataclass
class ChatSession:
    session_id: str
    user_id: str
    locale: Literal["bn", "en"]
    created_at: str
    turns: list[ChatTurn] = field(default_factory=list)


@dataclass
class ChatFeedback:
    feedback_id: str
    session_id: str
    user_id: str
    turn_id: str
    rating: Literal["up", "down"]
    reason: str | None
    created_at: str


class JonoAgent:
    """Grounded multi-tool agentic orchestrator for Jono."""

    def __init__(self, pipeline: RagPipeline | None = None) -> None:
        self._rag = pipeline or rag_pipeline
        self._sessions: dict[str, ChatSession] = {}
        self._feedback: list[ChatFeedback] = []

    def _get_or_create_session(
        self,
        session_id: str | None,
        user_id: str,
        locale: Literal["bn", "en"],
    ) -> ChatSession:
        if session_id and session_id in self._sessions:
            sess = self._sessions[session_id]
            # Rule R10: Strict per-user isolation — never expose another user's session
            if sess.user_id != user_id:
                new_id = str(uuid.uuid4())
                sess = ChatSession(
                    session_id=new_id,
                    user_id=user_id,
                    locale=locale,
                    created_at=datetime.now(UTC).isoformat(),
                )
                self._sessions[new_id] = sess
            return sess

        sid = session_id or str(uuid.uuid4())
        sess = ChatSession(
            session_id=sid,
            user_id=user_id,
            locale=locale,
            created_at=datetime.now(UTC).isoformat(),
        )
        self._sessions[sid] = sess
        return sess

    def get_session_history(self, session_id: str, user_id: str) -> list[dict[str, Any]]:
        sess = self._sessions.get(session_id)
        if not sess or sess.user_id != user_id:
            return []
        return [
            {
                "turn_id": t.turn_id,
                "role": t.role,
                "text": t.text,
                "created_at": t.created_at,
                "intent": t.intent,
                "tools_used": t.tools_used,
            }
            for t in sess.turns
        ]

    def record_feedback(
        self,
        session_id: str,
        user_id: str,
        turn_id: str,
        rating: Literal["up", "down"],
        reason: str | None = None,
    ) -> dict[str, Any]:
        fb = ChatFeedback(
            feedback_id=str(uuid.uuid4()),
            session_id=session_id,
            user_id=user_id,
            turn_id=turn_id,
            rating=rating,
            reason=reason,
            created_at=datetime.now(UTC).isoformat(),
        )
        self._feedback.append(fb)
        return {"feedback_id": fb.feedback_id, "recorded": True}

    def get_feedback_summary(self) -> dict[str, Any]:
        up = sum(1 for f in self._feedback if f.rating == "up")
        down = sum(1 for f in self._feedback if f.rating == "down")
        return {"total": len(self._feedback), "up": up, "down": down}

    async def chat(
        self,
        message: str,
        user_id: str = "guest",
        session_id: str | None = None,
        locale: Literal["bn", "en"] | None = None,
    ) -> dict[str, Any]:
        lang_det = detect_language(message)
        eff_locale: Literal["bn", "en"] = locale or (
            "en" if lang_det.language == "en" else "bn"
        )
        session = self._get_or_create_session(session_id, user_id, eff_locale)
        now_iso = datetime.now(UTC).isoformat()

        # Redact PII before writing user message to session memory (Rule R9)
        redacted_user_msg, pii_found = redact_pii_text(message)
        user_turn = ChatTurn(
            turn_id=str(uuid.uuid4()),
            role="user",
            text=redacted_user_msg,
            created_at=now_iso,
        )
        session.turns.append(user_turn)

        disclaimer = (
            "স্বাধীন প্ল্যাটফর্ম — এটি কোনো সরকারি অফিসিয়াল সেবা নয়।"
            if eff_locale == "bn"
            else "Independent platform — not an official government service."
        )

        # 1. Moderation & R8 Emergency Pre-Gate
        mod = moderate_text(message)
        intent_res = classify_intent(message)
        entities = extract_entities(message)
        entity_dicts = [
            {
                "type": e.type,
                "text": e.text,
                "normalized": e.normalized,
                "code": e.code,
            }
            for e in entities
        ]

        if mod.emergency_or_self_harm or intent_res.intent == "emergency":
            reply_text = (
                "তাৎক্ষণিক বিপদে এখনই **999** নম্বরে কল করুন (পুলিশ, ফায়ার সার্ভিস ও অ্যাম্বুলেন্স)। "
                "সরকারি তথ্য ও সহায়তার জন্য **333** এবং স্বাস্থ্য পরামর্শের জন্য **16263** নম্বরে কল করুন।"
                if eff_locale == "bn"
                else "In immediate danger, call **999** right now "
                "(Police, Fire Service & Ambulance). "
                "For government assistance call **333** or **16263** for 24/7 health advice."
            )
            em_cards: list[dict[str, Any]] = [
                {
                    "type": "emergency_call",
                    "label": (
                        "999 — জাতীয় জরুরি সেবা"
                        if eff_locale == "bn"
                        else "999 — National Emergency"
                    ),
                    "phone": "999",
                    "tap_to_call_url": "tel:999",
                    "trust_label": "OFFICIAL_SOURCE",
                },
                {
                    "type": "emergency_call",
                    "label": (
                        "16263 — স্বাস্থ্য বাতায়ন"
                        if eff_locale == "bn"
                        else "16263 — Health Helpline"
                    ),
                    "phone": "16263",
                    "tap_to_call_url": "tel:16263",
                    "trust_label": "OFFICIAL_SOURCE",
                },
            ]
            return self._finalize(
                session=session,
                reply=reply_text,
                locale=eff_locale,
                intent="emergency",
                tools_used=["emergency_r8_fast_path"],
                action_cards=em_cards,
                citations=[],
                entities=entity_dicts,
                emergency_bypass=True,
                disclaimer=disclaimer,
                pii_redacted=len(pii_found) > 0,
            )

        # 2. Prompt injection / R2 / R4 guardrail refusal
        if mod.flagged:
            reply_text = (
                "দুঃখিত, জনসেবা AI স্বয়ংক্রিয়ভাবে টিকিট বুক করতে, ক্যাপচা বাইপাস করতে "
                "বা অফিসিয়াল সিস্টেমের নিয়ম ভঙ্গ করতে পারে না। আপনি অফিসিয়াল পোর্টালে "
                "নিজে আবেদন বা বুকিং সম্পন্ন করতে পারেন।"
                if eff_locale == "bn"
                else "Sorry, Jonoshheba AI cannot auto-book tickets, bypass CAPTCHA/queues, "
                "or violate provider terms. Complete bookings on the official portal."
            )
            return self._finalize(
                session=session,
                reply=reply_text,
                locale=eff_locale,
                intent=intent_res.intent,
                tools_used=["moderation_guardrail"],
                action_cards=[],
                citations=[],
                entities=entity_dicts,
                emergency_bypass=False,
                disclaimer=disclaimer,
                pii_redacted=len(pii_found) > 0,
                guardrail_blocked=True,
            )

        # 3. Rule R7: No medical diagnosis guard
        low_msg = message.lower()
        if any(term in low_msg for term in _MEDICAL_DIAGNOSIS_TERMS):
            reply_text = (
                "জনসেবা AI কোনো চিকিৎসা নির্ণয় বা ওষুধের প্রেসক্রিপশন দিতে পারে না। "
                "তাৎক্ষণিক জরুরি অবস্থায় **999** অথবা ২৪/৭ সরকারি চিকিৎসকের পরামর্শের জন্য "
                "**16263** (স্বাস্থ্য বাতায়ন) নম্বরে কল করুন এবং নিকটস্থ সরকারি হাসপাতালে যোগাযোগ করুন।"
                if eff_locale == "bn"
                else "Jonoshheba AI cannot provide medical diagnoses or prescriptions. "
                "For urgent symptoms call **999**, or call **16263** (Shastho Batayon) for 24/7 "
                "licensed public-health advice and visit a nearby government hospital."
            )
            return self._finalize(
                session=session,
                reply=reply_text,
                locale=eff_locale,
                intent="health",
                tools_used=["health_no_diagnosis_guard_r7"],
                action_cards=[
                    {
                        "type": "emergency_call",
                        "label": "16263 — স্বাস্থ্য বাতায়ন",
                        "phone": "16263",
                        "tap_to_call_url": "tel:16263",
                        "trust_label": "OFFICIAL_SOURCE",
                    }
                ],
                citations=[],
                entities=entity_dicts,
                emergency_bypass=False,
                disclaimer=disclaimer,
                pii_redacted=len(pii_found) > 0,
            )

        # 4. Tool dispatch + Grounded RAG
        tools_used: list[str] = []
        action_cards: list[dict[str, Any]] = []

        if intent_res.intent == "transport":
            tools_used.append("transport_discovery_tool")
            stations = [e.normalized for e in entities if e.type == "station"]
            dates = [e.normalized for e in entities if e.type == "date"]
            origin = stations[0] if len(stations) >= 1 else "Dhaka"
            dest = stations[1] if len(stations) >= 2 else "Chattogram"
            travel_date = dates[0] if dates else "selected date"
            action_cards.append(
                {
                    "type": "transport_handoff",
                    "origin": origin,
                    "destination": dest,
                    "date": travel_date,
                    "not_reserved": True,
                    "integration_type": "MOCK",
                    "cta_label": (
                        "অফিশিয়াল চ্যানেলে এগিয়ে যান (সংরক্ষিত নয়)"
                        if eff_locale == "bn"
                        else "Continue to Official Channel (Not Reserved)"
                    ),
                    "official_url": "https://eticket.railway.gov.bd",
                    "watch_cta": "/transport",
                }
            )
        elif intent_res.intent == "benefit":
            tools_used.append("deterministic_eligibility_wizard_cta")
            action_cards.append(
                {
                    "type": "eligibility_wizard",
                    "possible_match_only": True,
                    "cta_label": (
                        "সম্ভাব্য যোগ্যতা যাচাই করুন (অফিসিয়াল সিদ্ধান্ত নয়)"
                        if eff_locale == "bn"
                        else "Check Possible Match (Not Final Decision)"
                    ),
                    "route": "/benefits",
                }
            )
        elif intent_res.intent == "complaint":
            tools_used.append("grs_draft_handoff_cta")
            action_cards.append(
                {
                    "type": "complaint_draft",
                    "cta_label": (
                        "অভিযোগের খসড়া তৈরি করুন ও GRS-এ যান"
                        if eff_locale == "bn"
                        else "Draft Complaint & Continue to Official GRS"
                    ),
                    "official_url": "https://www.grs.gov.bd",
                    "route": "/complaints",
                }
            )

        tools_used.append("rag_grounded_answer")
        rag_ans = await self._rag.answer(message, locale=eff_locale)
        rag_payload = serialize_answer(rag_ans)

        return self._finalize(
            session=session,
            reply=str(rag_payload["answer"]),
            locale=eff_locale,
            intent=intent_res.intent,
            tools_used=tools_used,
            action_cards=action_cards,
            citations=list(rag_payload["citations"]),
            entities=entity_dicts,
            emergency_bypass=bool(rag_payload["emergency_bypass"]),
            disclaimer=disclaimer,
            pii_redacted=len(pii_found) > 0,
            grounded=bool(rag_payload["grounded"]),
            refused=bool(rag_payload["refused"]),
            confidence=float(rag_payload["confidence"]),
        )

    def _finalize(
        self,
        *,
        session: ChatSession,
        reply: str,
        locale: Literal["bn", "en"],
        intent: str,
        tools_used: list[str],
        action_cards: list[dict[str, Any]],
        citations: list[dict[str, Any]],
        entities: list[dict[str, Any]],
        emergency_bypass: bool,
        disclaimer: str,
        pii_redacted: bool,
        guardrail_blocked: bool = False,
        grounded: bool = True,
        refused: bool = False,
        confidence: float = 0.95,
    ) -> dict[str, Any]:
        turn = ChatTurn(
            turn_id=str(uuid.uuid4()),
            role="assistant",
            text=reply,
            created_at=datetime.now(UTC).isoformat(),
            intent=intent,
            tools_used=tools_used,
        )
        session.turns.append(turn)
        return {
            "session_id": session.session_id,
            "turn_id": turn.turn_id,
            "reply": reply,
            "locale": locale,
            "intent": intent,
            "tools_used": tools_used,
            "entities": entities,
            "action_cards": action_cards,
            "citations": citations,
            "emergency_bypass": emergency_bypass,
            "guardrail_blocked": guardrail_blocked,
            "grounded": grounded,
            "refused": refused,
            "confidence": confidence,
            "pii_redacted": pii_redacted,
            "disclaimer": disclaimer,
        }


jono_agent = JonoAgent()
