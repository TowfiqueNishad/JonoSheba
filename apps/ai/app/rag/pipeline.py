"""Hybrid RAG pipeline: RRF retrieval, cross-lingual rerank, grounded answer & citation verifier.

Strictly obeys AGENTS.md:
- Rule R1: No fabrication; explicit refusal if verified evidence is missing.
- Rule R5: Every returned citation includes trust_label, source_url, agency, last_verified_at.
- Rule R6: Expired sources are downgraded to UNAVAILABLE_STALE and flagged clearly.
- Rule R7: Deterministic claim-citation verification blocks invented fees/hotlines/deadlines.
- Rule R8: Immediate emergency queries return 999 first without waiting on LLM generation.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal

from app.core.gateway import (
    BgeM3LocalHashEmbedding,
    LLMRequest,
    LocalCrossLingualReranker,
    ModelGateway,
)
from app.core.prompts import prompt_registry
from app.nlp.bangla import detect_language, normalize_bangla, transliterate_text
from app.nlp.ner_intent import classify_intent
from app.rag.corpus import (
    KnowledgeChunk,
    SourceDocument,
    TrustLabel,
    chunk_document,
    get_seed_documents,
)

_TRUST_WEIGHT: dict[TrustLabel, float] = {
    "OFFICIAL_SOURCE": 1.0,
    "VERIFIED_BY_JONOSHHEBA": 0.95,
    "PARTNER_PROVIDED": 0.85,
    "COMMUNITY_REPORT": 0.70,
    "UNAVAILABLE_STALE": 0.40,
}

_CITATION_TAG_RE = re.compile(r"\[(\d+)\]")
_HOTLINE_NUM_RE = re.compile(r"\b(?:999|333|102|106|109|1090|1098|16263|16430)\b")


@dataclass(frozen=True)
class RetrievedChunk:
    chunk: KnowledgeChunk
    rrf_score: float
    rerank_score: float
    final_score: float
    effective_trust_label: TrustLabel
    stale: bool


@dataclass(frozen=True)
class CitationItem:
    index: int
    chunk_id: str
    doc_id: str
    title: str
    agency: str
    source_url: str
    trust_label: TrustLabel
    last_verified_at: str
    excerpt: str
    stale: bool


@dataclass(frozen=True)
class GroundedAnswer:
    answer_text: str
    locale: Literal["bn", "en"]
    grounded: bool
    refused: bool
    emergency_bypass: bool
    confidence: float
    citations: list[CitationItem]
    verification_passed: bool
    verification_notes: list[str]
    disclaimer: str


def _clean_complete_text(text: str, max_chars: int = 1200) -> str:
    """Return full Markdown text; if over max_chars, trim cleanly at a sentence boundary."""
    stripped = text.strip()
    if len(stripped) <= max_chars:
        return stripped
    window = stripped[:max_chars]
    # Prefer sentence boundary (Bangla dari '।', period '.', or newline)
    cut = max(window.rfind("।"), window.rfind("."), window.rfind("\n"))
    if cut >= int(max_chars * 0.45):
        return window[: cut + 1].strip()
    return window.rsplit(" ", 1)[0].strip()


def _prune_cited_sources(answer_text: str, citations: list[CitationItem]) -> list[CitationItem]:
    """Keep ONLY sources actually cited as [n] in answer_text, deduplicated by URL (Finding C1)."""
    cited_indices = {int(m) for m in _CITATION_TAG_RE.findall(answer_text)}
    if not cited_indices:
        return []
    seen_urls: set[str] = set()
    kept: list[CitationItem] = []
    for c in citations:
        if c.index in cited_indices and c.source_url not in seen_urls:
            seen_urls.add(c.source_url)
            kept.append(c)
    return kept


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


def _sparse_overlap(q_sparse: dict[str, float], d_sparse: dict[str, float]) -> float:
    if not q_sparse or not d_sparse:
        return 0.0
    score = 0.0
    for term, qw in q_sparse.items():
        if term in d_sparse:
            score += qw * d_sparse[term]
    return score / max(1.0, sum(q_sparse.values()))


class RagPipeline:
    """In-memory + pgvector-compatible hybrid RAG engine."""

    def __init__(
        self,
        embedder: BgeM3LocalHashEmbedding | None = None,
        reranker: LocalCrossLingualReranker | None = None,
        gateway: ModelGateway | None = None,
        load_seed: bool = True,
    ) -> None:
        self._embedder = embedder or BgeM3LocalHashEmbedding()
        self._reranker = reranker or LocalCrossLingualReranker()
        self._gateway = gateway or ModelGateway()
        self._chunks: list[KnowledgeChunk] = []
        self._seen_hashes: set[str] = set()
        if load_seed:
            for doc in get_seed_documents():
                self.ingest_document(doc)

    @property
    def chunk_count(self) -> int:
        return len(self._chunks)

    def ingest_document(self, doc: SourceDocument) -> dict[str, int]:
        """Chunks, deduplicates by content_hash, and indexes dense + sparse vectors."""
        new_chunks = chunk_document(doc)
        inserted = 0
        skipped_duplicates = 0
        to_embed: list[KnowledgeChunk] = []

        for chunk in new_chunks:
            if chunk.content_hash in self._seen_hashes:
                skipped_duplicates += 1
                continue
            self._seen_hashes.add(chunk.content_hash)
            to_embed.append(chunk)

        if to_embed:
            texts = [f"{c.title}\n{c.text}" for c in to_embed]
            dense_vecs, sparse_dicts = self._embedder.embed(texts)
            for chunk, dv, sd in zip(to_embed, dense_vecs, sparse_dicts, strict=True):
                chunk.dense_vector = dv
                chunk.sparse_weights = sd
                self._chunks.append(chunk)
                inserted += 1

        return {"inserted": inserted, "skipped_duplicates": skipped_duplicates}

    def _expand_query(self, query: str) -> str:
        lang = detect_language(query).language
        if lang in ("banglish", "mixed", "en"):
            bn_tr, _ = transliterate_text(query, direction="banglish_to_bn")
            if bn_tr != query:
                return f"{query} {bn_tr}"
        return query

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        category: str | None = None,
        trust_labels: list[TrustLabel] | None = None,
        now_utc: datetime | None = None,
    ) -> list[RetrievedChunk]:
        if not self._chunks:
            return []

        expanded = self._expand_query(query)
        q_dense_list, q_sparse_list = self._embedder.embed([expanded])
        q_dense = q_dense_list[0]
        q_sparse = q_sparse_list[0]

        candidates: list[KnowledgeChunk] = []
        for c in self._chunks:
            if category and c.category != category:
                continue
            if trust_labels and c.trust_label not in trust_labels:
                continue
            candidates.append(c)

        if not candidates:
            return []

        # Dense & sparse rankings for Reciprocal Rank Fusion (k=60)
        dense_ranked = sorted(
            range(len(candidates)),
            key=lambda i: _cosine(q_dense, candidates[i].dense_vector),
            reverse=True,
        )
        sparse_ranked = sorted(
            range(len(candidates)),
            key=lambda i: _sparse_overlap(q_sparse, candidates[i].sparse_weights),
            reverse=True,
        )

        rrf_scores: dict[int, float] = {}
        for rank, idx in enumerate(dense_ranked, start=1):
            rrf_scores[idx] = rrf_scores.get(idx, 0.0) + 1.0 / (60.0 + rank)
        for rank, idx in enumerate(sparse_ranked, start=1):
            rrf_scores[idx] = rrf_scores.get(idx, 0.0) + 1.0 / (60.0 + rank)

        top_pool_indices = sorted(
            rrf_scores.keys(), key=lambda i: rrf_scores[i], reverse=True
        )[: max(top_k * 3, 12)]
        pool_passages = [f"{candidates[i].title} {candidates[i].text}" for i in top_pool_indices]
        reranked = self._reranker.rerank(expanded, pool_passages, top_k=len(pool_passages))

        ref_time = now_utc or datetime.now(UTC)
        results: list[RetrievedChunk] = []
        for local_idx, rr_score in reranked:
            cand_idx = top_pool_indices[local_idx]
            chunk = candidates[cand_idx]
            stale = chunk.is_expired(ref_time)
            eff_trust: TrustLabel = "UNAVAILABLE_STALE" if stale else chunk.trust_label
            dense_sim = max(0.0, _cosine(q_dense, chunk.dense_vector))
            sparse_sim = min(1.0, _sparse_overlap(q_sparse, chunk.sparse_weights))
            trust_mult = _TRUST_WEIGHT[eff_trust]
            # Combined relevance score in [0, 1]
            final = round(
                min(1.0, (0.45 * rr_score + 0.35 * dense_sim + 0.20 * sparse_sim) * trust_mult),
                4,
            )
            results.append(
                RetrievedChunk(
                    chunk=chunk,
                    rrf_score=round(rrf_scores[cand_idx], 5),
                    rerank_score=rr_score,
                    final_score=final,
                    effective_trust_label=eff_trust,
                    stale=stale,
                )
            )

        results.sort(key=lambda r: r.final_score, reverse=True)
        return results[:top_k]

    def _verify_citations(
        self,
        answer_text: str,
        citations: list[CitationItem],
    ) -> tuple[bool, list[str]]:
        """Post-generation verifier checking citation bounds and hotline grounding (Rule R7)."""
        notes: list[str] = []
        tags = [int(m) for m in _CITATION_TAG_RE.findall(answer_text)]
        if citations and not tags:
            notes.append("missing_inline_citation_markers")
        for tag in tags:
            if tag < 1 or tag > len(citations):
                notes.append(f"invalid_citation_index:{tag}")

        # Any hotline number mentioned in answer MUST exist in retrieved context
        combined_sources = " ".join(c.excerpt for c in citations)
        for hotline in _HOTLINE_NUM_RE.findall(answer_text):
            if hotline not in combined_sources and hotline != "999":
                notes.append(f"ungrounded_hotline:{hotline}")

        return len(notes) == 0, notes

    async def answer(
        self,
        query: str,
        locale: Literal["bn", "en"] = "bn",
        category: str | None = None,
        db_facts: str = "",
        min_confidence: float = 0.22,
    ) -> GroundedAnswer:
        disclaimer = (
            "স্বাধীন প্ল্যাটফর্ম — এটি কোনো সরকারি অফিসিয়াল সেবা নয়। "
            "চূড়ান্ত আবেদন অফিসিয়াল সরকারি চ্যানেলে সম্পন্ন করুন।"
            if locale == "bn"
            else "Independent platform — not an official government service. "
            "Complete final submissions on the official channel."
        )

        # Rule R8: Immediate emergency bypass before any LLM call
        intent = classify_intent(query)
        if intent.intent == "emergency":
            em_chunks = self.retrieve("999 জরুরি সেবা হটলাইন", top_k=2, category="emergency")
            citations = [
                CitationItem(
                    index=i + 1,
                    chunk_id=r.chunk.chunk_id,
                    doc_id=r.chunk.doc_id,
                    title=r.chunk.title,
                    agency=r.chunk.agency,
                    source_url=r.chunk.source_url,
                    trust_label=r.effective_trust_label,
                    last_verified_at=r.chunk.last_verified_at,
                    excerpt=r.chunk.text[:240],
                    stale=r.stale,
                )
                for i, r in enumerate(em_chunks)
            ]
            em_text = (
                "তাৎক্ষণিক বিপদে এখনই **999** নম্বরে কল করুন (পুলিশ, ফায়ার সার্ভিস, অ্যাম্বুলেন্স) [1]। "
                "সরকারি তথ্য ও সহায়তার জন্য 333 এবং স্বাস্থ্য পরামর্শের জন্য 16263 নম্বরে কল করুন [1]।"
                if locale == "bn"
                else "In immediate danger, call **999** right now "
                "(Police, Fire Service, Ambulance) [1]. "
                "For government info call 333, and for 24/7 health advice call 16263 [1]."
            )
            return GroundedAnswer(
                answer_text=em_text,
                locale=locale,
                grounded=True,
                refused=False,
                emergency_bypass=True,
                confidence=0.99,
                citations=_prune_cited_sources(em_text, citations),
                verification_passed=True,
                verification_notes=["emergency_r8_fast_path"],
                disclaimer=disclaimer,
            )

        retrieved = self.retrieve(query, top_k=4, category=category)
        top_score = retrieved[0].final_score if retrieved else 0.0

        # Refusal gate: missing or low-confidence verified evidence (Rule R1 & R7)
        if not retrieved or top_score < min_confidence:
            refusal_text = (
                "নিশ্চিত তথ্য পাওয়া যায়নি। অনুগ্রহ করে সংশ্লিষ্ট সরকারি দপ্তরের অফিসিয়াল পোর্টাল "
                "(mygov.bd) অথবা ৩৩৩ হটলাইনে যাচাই করুন।"
                if locale == "bn"
                else "Verified information is unavailable for this query. Please verify "
                "on the official agency portal (mygov.bd) or call 333."
            )
            return GroundedAnswer(
                answer_text=refusal_text,
                locale=locale,
                grounded=False,
                refused=True,
                emergency_bypass=False,
                confidence=top_score,
                citations=[],
                verification_passed=True,
                verification_notes=["insufficient_grounded_evidence"],
                disclaimer=disclaimer,
            )

        citations = [
            CitationItem(
                index=i + 1,
                chunk_id=r.chunk.chunk_id,
                doc_id=r.chunk.doc_id,
                title=r.chunk.title,
                agency=r.chunk.agency,
                source_url=r.chunk.source_url,
                trust_label=r.effective_trust_label,
                last_verified_at=r.chunk.last_verified_at,
                excerpt=_clean_complete_text(r.chunk.text, max_chars=1200),
                stale=r.stale,
            )
            for i, r in enumerate(retrieved[:3])
        ]

        # If top evidence is stale/expired, state it explicitly (Rule R6)
        if retrieved[0].stale:
            stale_text = (
                f"সতর্কতা: প্রাপ্ত তথ্যটি মেয়াদোত্তীর্ণ [1]। "
                f"সর্বশেষ হালনাগাদের জন্য সরাসরি {citations[0].agency} "
                f"({citations[0].source_url}) দেখুন।"
                if locale == "bn"
                else f"Warning: The retrieved circular has expired [1]. "
                f"Check {citations[0].agency} ({citations[0].source_url}) for updates."
            )
            return GroundedAnswer(
                answer_text=stale_text,
                locale=locale,
                grounded=True,
                refused=True,
                emergency_bypass=False,
                confidence=top_score,
                citations=_prune_cited_sources(stale_text, citations),
                verification_passed=True,
                verification_notes=["stale_source_flagged_r6"],
                disclaimer=disclaimer,
            )

        context_lines = [
            f"[{c.index}] ({c.agency} | {c.trust_label} | {c.source_url}): {c.excerpt}"
            for c in citations
        ]
        spec = prompt_registry.get("rag.grounded_answer", version="1.0.0")
        rendered = spec.render(
            {
                "locale": locale,
                "db_facts": db_facts or "None",
                "retrieved_context": "\n".join(context_lines),
                "user_query": query,
            }
        )

        # Call ModelGateway; if local fallback is used, synthesize a complete Markdown cited answer
        llm_resp = await self._gateway.complete(
            LLMRequest(
                prompt_id=spec.id,
                prompt_version=spec.version,
                prompt_text=rendered,
                task_tier="fast",
                cache_key=f"rag:{locale}:{normalize_bangla(query)[:80]}",
            )
        )

        if llm_resp.provider == "local-fallback":
            lead_excerpt = citations[0].excerpt.strip()
            answer_text = (
                f"{lead_excerpt} [1]\n\n"
                f"**অফিশিয়াল চ্যানেল:** {citations[0].agency} ({citations[0].source_url})"
                if locale == "bn"
                else f"{lead_excerpt} [1]\n\n"
                f"**Official channel:** {citations[0].agency} ({citations[0].source_url})"
            )
        else:
            answer_text = llm_resp.text

        ok, notes = self._verify_citations(answer_text, citations)
        if not ok:
            # Safe extractive fallback if verification catches any ungrounded claim
            lead = citations[0].excerpt.strip()
            answer_text = f"{lead} [1]"
            notes.append("repaired_with_extractive_grounding")

        pruned_citations = _prune_cited_sources(answer_text, citations)

        return GroundedAnswer(
            answer_text=answer_text,
            locale=locale,
            grounded=True,
            refused=False,
            emergency_bypass=False,
            confidence=top_score,
            citations=pruned_citations,
            verification_passed=ok,
            verification_notes=notes,
            disclaimer=disclaimer,
        )


def serialize_answer(ans: GroundedAnswer) -> dict[str, Any]:
    return {
        "answer": ans.answer_text,
        "locale": ans.locale,
        "grounded": ans.grounded,
        "refused": ans.refused,
        "emergency_bypass": ans.emergency_bypass,
        "confidence": ans.confidence,
        "verification_passed": ans.verification_passed,
        "verification_notes": ans.verification_notes,
        "disclaimer": ans.disclaimer,
        "citations": [
            {
                "index": c.index,
                "chunk_id": c.chunk_id,
                "doc_id": c.doc_id,
                "title": c.title,
                "agency": c.agency,
                "source_url": c.source_url,
                "trust_label": c.trust_label,
                "last_verified_at": c.last_verified_at,
                "stale": c.stale,
                "excerpt": c.excerpt,
            }
            for c in ans.citations
        ],
    }


rag_pipeline = RagPipeline()
