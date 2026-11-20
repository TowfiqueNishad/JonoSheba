"""Internal FastAPI routes for Jonoshheba AI (Phase 09 Foundation & Model Gateway)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from app.agents.jono import jono_agent
from app.core.auth import require_service_auth
from app.core.gateway import (
    BgeM3LocalHashEmbedding,
    LLMRequest,
    LocalCrossLingualReranker,
    ModelGateway,
    TaskTier,
)
from app.core.prompts import prompt_registry
from app.core.telemetry import metrics_registry
from app.eval.rag_eval import run_rag_evaluation
from app.guardrails.moderation import moderate_text
from app.ml.mlflow_tracker import mlflow_tracker
from app.ml.models import (
    RegionalMetricBucket,
    detect_regional_anomalies,
    predict_sellout_risk,
    recommend_life_events,
    recommend_watch_interval,
    route_complaint,
)
from app.nlp.bangla import detect_language, normalize_bangla, transliterate_text
from app.nlp.ner_intent import classify_intent, extract_entities
from app.ocr.service import ocr_service
from app.rag.corpus import SourceDocument, TrustLabel
from app.rag.national_scale import answer_localized, run_national_dialect_eval
from app.rag.pipeline import rag_pipeline, serialize_answer
from app.speech.service import speech_service

internal_router = APIRouter(dependencies=[Depends(require_service_auth)])
observability_router = APIRouter()

_gateway = ModelGateway()
_embedder = BgeM3LocalHashEmbedding()
_reranker = LocalCrossLingualReranker()


# --- Schemas ---


class TextRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=16000)


class TransliterateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)
    direction: Literal["auto", "banglish_to_bn", "bn_to_latin"] = "auto"


class NerRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)
    reference_time_utc: datetime | None = None


class EmbedRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=64)


class RerankRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4000)
    passages: list[str] = Field(..., min_length=1, max_length=100)
    top_k: int = Field(default=8, ge=1, le=50)


class GatewayCompleteRequest(BaseModel):
    prompt_id: str = Field(..., min_length=1, max_length=128)
    prompt_version: str | None = None
    variables: dict[str, str] = Field(default_factory=dict)
    task_tier: TaskTier = "fast"
    max_tokens: int = Field(default=512, ge=16, le=4096)
    cache_key: str | None = None


class TranscribeRequest(BaseModel):
    audio_b64: str = Field(..., min_length=4)
    sample_rate_hz: int = Field(default=16000, ge=8000, le=48000)
    language_hint: Literal["bn", "en"] = "bn"
    transcript_hint: str | None = None


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    locale: Literal["bn", "en"] = "bn"


class OcrExtractRequest(BaseModel):
    image_b64: str | None = None
    raw_text_hint: str | None = None
    lang: str = "ben+eng"


# --- NLP Endpoints ---


@internal_router.post("/nlp/detect-language", tags=["NLP"])
def nlp_detect_language(body: TextRequest) -> dict[str, Any]:
    metrics_registry.record_request("/nlp/detect-language")
    res = detect_language(body.text)
    return {
        "language": res.language,
        "confidence": res.confidence,
        "bn_char_ratio": res.bn_char_ratio,
        "latin_char_ratio": res.latin_char_ratio,
        "banglish_token_hits": res.banglish_token_hits,
    }


@internal_router.post("/nlp/normalize", tags=["NLP"])
def nlp_normalize(body: TextRequest) -> dict[str, str]:
    metrics_registry.record_request("/nlp/normalize")
    return {"original": body.text, "normalized": normalize_bangla(body.text)}


@internal_router.post("/nlp/transliterate", tags=["NLP"])
def nlp_transliterate(body: TransliterateRequest) -> dict[str, str]:
    metrics_registry.record_request("/nlp/transliterate")
    out, direction_used = transliterate_text(body.text, direction=body.direction)
    return {"original": body.text, "transliterated": out, "direction": direction_used}


@internal_router.post("/nlp/intent", tags=["NLP"])
def nlp_intent(body: TextRequest) -> dict[str, Any]:
    metrics_registry.record_request("/nlp/intent")
    res = classify_intent(body.text)
    return {
        "intent": res.intent,
        "confidence": res.confidence,
        "matched_signals": res.matched_signals,
    }


@internal_router.post("/nlp/ner", tags=["NLP"])
def nlp_ner(body: NerRequest) -> dict[str, Any]:
    metrics_registry.record_request("/nlp/ner")
    entities = extract_entities(body.text, now_utc=body.reference_time_utc)
    return {
        "timezone": "Asia/Dhaka",
        "entities": [
            {
                "type": e.type,
                "text": e.text,
                "normalized": e.normalized,
                "code": e.code,
            }
            for e in entities
        ],
    }


@internal_router.post("/nlp/embed", tags=["NLP"])
def nlp_embed(body: EmbedRequest) -> dict[str, Any]:
    metrics_registry.record_request("/nlp/embed")
    dense, sparse = _embedder.embed(body.texts)
    return {
        "model": _embedder.model_name,
        "dimension": _embedder.dimension,
        "dense": dense,
        "sparse": sparse,
    }


@internal_router.post("/nlp/rerank", tags=["NLP"])
def nlp_rerank(body: RerankRequest) -> dict[str, Any]:
    metrics_registry.record_request("/nlp/rerank")
    ranked = _reranker.rerank(body.query, body.passages, top_k=body.top_k)
    return {
        "model": _reranker.model_name,
        "results": [
            {"index": idx, "score": score, "passage": body.passages[idx]}
            for idx, score in ranked
        ],
    }


# --- Moderation & Guardrails ---


@internal_router.post("/moderation", tags=["Guardrails"])
def moderation_check(body: TextRequest) -> dict[str, Any]:
    metrics_registry.record_request("/moderation")
    res = moderate_text(body.text)
    return {
        "flagged": res.flagged,
        "abuse_detected": res.abuse_detected,
        "pii_detected": res.pii_detected,
        "pii_types": res.pii_types,
        "redacted_text": res.redacted_text,
        "prompt_injection_score": res.prompt_injection_score,
        "injection_signals": res.injection_signals,
        "emergency_or_self_harm": res.emergency_or_self_harm,
        "recommended_hotline": res.recommended_hotline,
    }


# --- Speech & OCR ---


@internal_router.post("/speech/transcribe", tags=["Speech"])
def speech_transcribe(body: TranscribeRequest) -> dict[str, Any]:
    metrics_registry.record_request("/speech/transcribe")
    res = speech_service.transcribe(
        audio_b64=body.audio_b64,
        sample_rate_hz=body.sample_rate_hz,
        language_hint=body.language_hint,
        transcript_hint=body.transcript_hint,
    )
    return {
        "text": res.text,
        "language": res.language,
        "confidence": res.confidence,
        "duration_sec": res.duration_sec,
        "input_sample_rate_hz": res.input_sample_rate_hz,
        "resampled_to_16khz": res.resampled_to_16khz,
        "engine": res.engine,
    }


@internal_router.post("/speech/synthesize", tags=["Speech"])
def speech_synthesize(body: SynthesizeRequest) -> dict[str, Any]:
    metrics_registry.record_request("/speech/synthesize")
    res = speech_service.synthesize(text=body.text, locale=body.locale)
    return {
        "audio_b64": res.audio_b64,
        "mime_type": res.mime_type,
        "locale": res.locale,
        "cache_key": res.cache_key,
        "cached": res.cached,
        "engine": res.engine,
    }


@internal_router.post("/ocr/extract", tags=["OCR"])
def ocr_extract(body: OcrExtractRequest) -> dict[str, Any]:
    metrics_registry.record_request("/ocr/extract")
    res = ocr_service.extract(
        image_b64=body.image_b64,
        raw_text_hint=body.raw_text_hint,
        lang=body.lang,
    )
    return {
        "full_text": res.full_text,
        "language": res.language,
        "engine": res.engine,
        "quality_score": res.quality_score,
        "blur_warning": res.blur_warning,
        "extracted_fields": res.extracted_fields,
        "blocks": [
            {
                "index": b.index,
                "text": b.text,
                "confidence": b.confidence,
                "bbox": b.bbox,
            }
            for b in res.blocks
        ],
    }


# --- Model Gateway & Prompts ---


@internal_router.get("/prompts", tags=["Gateway"])
def list_prompts() -> dict[str, Any]:
    metrics_registry.record_request("/prompts")
    return {"prompts": prompt_registry.list_prompts()}


@internal_router.post("/gateway/complete", tags=["Gateway"])
async def gateway_complete(body: GatewayCompleteRequest) -> dict[str, Any]:
    metrics_registry.record_request("/gateway/complete")
    spec = prompt_registry.get(body.prompt_id, version=body.prompt_version)
    rendered = spec.render(body.variables)
    resp = await _gateway.complete(
        LLMRequest(
            prompt_id=spec.id,
            prompt_version=spec.version,
            prompt_text=rendered,
            task_tier=body.task_tier,
            max_tokens=body.max_tokens,
            cache_key=body.cache_key,
        )
    )
    return {
        "text": resp.text,
        "model": resp.model,
        "provider": resp.provider,
        "prompt_id": resp.prompt_id,
        "prompt_version": resp.prompt_version,
        "tokens_in": resp.tokens_in,
        "tokens_out": resp.tokens_out,
        "latency_ms": resp.latency_ms,
        "cost_usd": resp.cost_usd,
        "cache_hit": resp.cache_hit,
    }


# --- Phase 10: RAG Endpoints ---


class RagIngestRequest(BaseModel):
    doc_id: str = Field(..., min_length=2, max_length=128)
    title: str = Field(..., min_length=2, max_length=300)
    content: str = Field(..., min_length=10, max_length=60000)
    source_url: str = Field(..., min_length=8, max_length=500)
    agency: str = Field(..., min_length=2, max_length=200)
    trust_label: TrustLabel = "OFFICIAL_SOURCE"
    last_verified_at: str
    locale: Literal["bn", "en"] = "bn"
    category: str = "service"
    effective_from: str | None = None
    effective_to: str | None = None


class RagRetrieveRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4000)
    top_k: int = Field(default=5, ge=1, le=20)
    category: str | None = None
    trust_labels: list[TrustLabel] | None = None


class RagAnswerRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4000)
    locale: Literal["bn", "en"] = "bn"
    category: str | None = None
    db_facts: str = ""


@internal_router.post("/rag/ingest", tags=["RAG"])
def rag_ingest(body: RagIngestRequest) -> dict[str, Any]:
    metrics_registry.record_request("/rag/ingest")
    doc = SourceDocument(
        doc_id=body.doc_id,
        title=body.title,
        content=body.content,
        source_url=body.source_url,
        agency=body.agency,
        trust_label=body.trust_label,
        last_verified_at=body.last_verified_at,
        locale=body.locale,
        category=body.category,
        effective_from=body.effective_from,
        effective_to=body.effective_to,
    )
    stats = rag_pipeline.ingest_document(doc)
    return {**stats, "total_chunks": rag_pipeline.chunk_count}


@internal_router.post("/rag/retrieve", tags=["RAG"])
def rag_retrieve(body: RagRetrieveRequest) -> dict[str, Any]:
    metrics_registry.record_request("/rag/retrieve")
    hits = rag_pipeline.retrieve(
        query=body.query,
        top_k=body.top_k,
        category=body.category,
        trust_labels=body.trust_labels,
    )
    return {
        "results": [
            {
                "chunk_id": r.chunk.chunk_id,
                "doc_id": r.chunk.doc_id,
                "title": r.chunk.title,
                "agency": r.chunk.agency,
                "source_url": r.chunk.source_url,
                "trust_label": r.effective_trust_label,
                "last_verified_at": r.chunk.last_verified_at,
                "stale": r.stale,
                "rrf_score": r.rrf_score,
                "rerank_score": r.rerank_score,
                "final_score": r.final_score,
                "text": r.chunk.text,
            }
            for r in hits
        ]
    }


@internal_router.post("/rag/answer", tags=["RAG"])
async def rag_answer(body: RagAnswerRequest) -> dict[str, Any]:
    metrics_registry.record_request("/rag/answer")
    ans = await rag_pipeline.answer(
        query=body.query,
        locale=body.locale,
        category=body.category,
        db_facts=body.db_facts,
    )
    return serialize_answer(ans)


@internal_router.post("/rag/eval", tags=["RAG"])
async def rag_eval() -> dict[str, Any]:
    metrics_registry.record_request("/rag/eval")
    return await run_rag_evaluation(rag_pipeline)


class RagLocalizedRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4000)
    district: str | None = None
    locale: Literal["bn", "en"] = "bn"
    category: str | None = None


@internal_router.post("/rag/answer-local", tags=["RAG"])
async def rag_answer_local(body: RagLocalizedRequest) -> dict[str, Any]:
    metrics_registry.record_request("/rag/answer-local")
    return await answer_localized(
        query=body.query,
        district=body.district,
        locale=body.locale,
        category=body.category,
    )


@internal_router.post("/rag/eval-national", tags=["RAG"])
async def rag_eval_national() -> dict[str, Any]:
    metrics_registry.record_request("/rag/eval-national")
    return await run_national_dialect_eval(rag_pipeline)


# --- Phase 11: Jono Agentic Chatbot Endpoints ---


class JonoChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    user_id: str = Field(default="guest", min_length=1, max_length=128)
    session_id: str | None = None
    locale: Literal["bn", "en"] | None = None


class JonoFeedbackRequest(BaseModel):
    session_id: str
    user_id: str = "guest"
    turn_id: str
    rating: Literal["up", "down"]
    reason: str | None = None


@internal_router.post("/jono/chat", tags=["Jono"])
async def jono_chat(body: JonoChatRequest) -> dict[str, Any]:
    metrics_registry.record_request("/jono/chat")
    return await jono_agent.chat(
        message=body.message,
        user_id=body.user_id,
        session_id=body.session_id,
        locale=body.locale,
    )


@internal_router.get("/jono/sessions/{session_id}", tags=["Jono"])
def jono_session_history(session_id: str, user_id: str = "guest") -> dict[str, Any]:
    metrics_registry.record_request("/jono/sessions")
    return {
        "session_id": session_id,
        "turns": jono_agent.get_session_history(session_id=session_id, user_id=user_id),
    }


@internal_router.post("/jono/feedback", tags=["Jono"])
def jono_feedback(body: JonoFeedbackRequest) -> dict[str, Any]:
    metrics_registry.record_request("/jono/feedback")
    return jono_agent.record_feedback(
        session_id=body.session_id,
        user_id=body.user_id,
        turn_id=body.turn_id,
        rating=body.rating,
        reason=body.reason,
    )


# --- Phase 12: ML Models & MLflow Registry ---


class SelloutRiskRequest(BaseModel):
    origin_code: str = Field(..., min_length=2, max_length=16)
    destination_code: str = Field(..., min_length=2, max_length=16)
    days_before_departure: int = Field(..., ge=0, le=30)
    day_of_week: int = Field(..., ge=0, le=6)
    seat_class: str = "S_CHAIR"
    is_eid_or_holiday: bool = False


class WatchIntervalRequest(BaseModel):
    hours_to_departure: float = Field(..., ge=0.0)
    sellout_probability: float = Field(..., ge=0.0, le=1.0)
    active_watchers_on_route: int = Field(default=1, ge=1)
    provider_error_rate: float = Field(default=0.0, ge=0.0, le=1.0)


class LifeEventRecommendRequest(BaseModel):
    life_stage: Literal[
        "student", "parent", "senior", "job_seeker", "traveler", "general"
    ] = "general"
    district_code: str | None = None


class AnomalyBucketPayload(BaseModel):
    region_code: str
    category: str
    current_count: int = Field(..., ge=0)
    baseline_mean: float = Field(..., ge=0.0)
    baseline_std: float = Field(default=5.0, ge=0.0)


class AnomalyDetectRequest(BaseModel):
    buckets: list[AnomalyBucketPayload]
    k_anonymity_min: int = Field(default=10, ge=1)
    z_threshold: float = Field(default=2.5, ge=1.0)


@internal_router.post("/ml/sellout-risk", tags=["ML"])
def ml_sellout_risk(body: SelloutRiskRequest) -> dict[str, Any]:
    metrics_registry.record_request("/ml/sellout-risk")
    return predict_sellout_risk(
        origin_code=body.origin_code,
        destination_code=body.destination_code,
        days_before_departure=body.days_before_departure,
        day_of_week=body.day_of_week,
        seat_class=body.seat_class,
        is_eid_or_holiday=body.is_eid_or_holiday,
    )


@internal_router.post("/ml/watch-interval", tags=["ML"])
def ml_watch_interval(body: WatchIntervalRequest) -> dict[str, Any]:
    metrics_registry.record_request("/ml/watch-interval")
    return recommend_watch_interval(
        hours_to_departure=body.hours_to_departure,
        sellout_probability=body.sellout_probability,
        active_watchers_on_route=body.active_watchers_on_route,
        provider_error_rate=body.provider_error_rate,
    )


@internal_router.post("/ml/route-complaint", tags=["ML"])
def ml_route_complaint(body: TextRequest) -> dict[str, Any]:
    metrics_registry.record_request("/ml/route-complaint")
    return route_complaint(body.text)


@internal_router.post("/ml/recommend-life-events", tags=["ML"])
def ml_recommend_life_events(body: LifeEventRecommendRequest) -> dict[str, Any]:
    metrics_registry.record_request("/ml/recommend-life-events")
    return recommend_life_events(
        life_stage=body.life_stage,
        district_code=body.district_code,
    )


@internal_router.post("/ml/anomalies", tags=["ML"])
def ml_anomalies(body: AnomalyDetectRequest) -> dict[str, Any]:
    metrics_registry.record_request("/ml/anomalies")
    buckets = [
        RegionalMetricBucket(
            region_code=b.region_code,
            category=b.category,
            current_count=b.current_count,
            baseline_mean=b.baseline_mean,
            baseline_std=b.baseline_std,
        )
        for b in body.buckets
    ]
    return detect_regional_anomalies(
        buckets=buckets,
        k_anonymity_min=body.k_anonymity_min,
        z_threshold=body.z_threshold,
    )


@internal_router.get("/ml/registry", tags=["ML"])
def ml_registry() -> dict[str, Any]:
    metrics_registry.record_request("/ml/registry")
    return {
        "models": mlflow_tracker.list_models(),
        "jono_feedback": jono_agent.get_feedback_summary(),
    }


# --- Observability ---


@observability_router.get("/metrics", response_class=PlainTextResponse, tags=["Observability"])
def prometheus_metrics() -> str:
    return metrics_registry.render_prometheus()
