"""Automated RAG evaluation harness (Recall@5, MRR, Citation Precision, Groundedness, Refusal)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from app.core.telemetry import metrics_registry
from app.rag.pipeline import RagPipeline, rag_pipeline


@dataclass(frozen=True)
class EvalCase:
    id: str
    query: str
    locale: Literal["bn", "en"]
    expected_doc_id: str | None  # None means out-of-scope / should refuse
    expect_refusal: bool = False
    expect_emergency: bool = False


GOLDEN_EVAL_SET: list[EvalCase] = [
    EvalCase("ev-01", "জন্ম নিবন্ধন ফি কত টাকা?", "bn", "doc-bdris-birth-reg"),
    EvalCase("ev-02", "jonmo nibondhon kothay korbo?", "bn", "doc-bdris-birth-reg"),
    EvalCase("ev-03", "ই-পাসপোর্ট নিয়মিত ও জরুরি ফি কত?", "bn", "doc-epassport-bd"),
    EvalCase("ev-04", "জাতীয় পরিচয়পত্র হারানো কার্ড রি-ইস্যু ফি", "bn", "doc-nid-services"),
    EvalCase("ev-05", "ভূমি ই-নামজারি সরকারি ফি কত টাকা?", "bn", "doc-land-namjari"),
    EvalCase("ev-06", "বাংলাদেশ রেলওয়ে ই-টিকিট কত দিন আগে ছাড়া হয়?", "bn", "doc-railway-eticket"),
    EvalCase("ev-07", "বয়স্ক ভাতা পাওয়ার বয়স ও আয়ের শর্ত কী?", "bn", "doc-dss-old-age-allowance"),
    EvalCase("ev-08", "সরকারি দপ্তরের বিরুদ্ধে GRS অভিযোগ কীভাবে করব?", "bn", "doc-grs-complaint"),
    EvalCase("ev-09", "শিক্ষা সহায়তা ট্রাস্ট উপবৃত্তি আবেদন কাগজপত্র", "bn", "doc-pmeat-scholarship"),
    EvalCase("ev-10", "ডেসকো বিদ্যুৎ ও তিতাস গ্যাস বিল কোথায় দেব?", "bn", "doc-utility-payments"),
    EvalCase(
        "ev-11",
        "আগুন লেগেছে, জরুরি ফায়ার সার্ভিস দরকার!",
        "bn",
        "doc-emergency-hotlines",
        expect_emergency=True,
    ),
    EvalCase(
        "ev-12",
        "২০২৩ সালের পুরনো বিশেষ আর্থিক অনুদান বিজ্ঞপ্তি",
        "bn",
        "doc-stale-covid-grant-2023",
        expect_refusal=True,
    ),
    EvalCase(
        "ev-13",
        "What is the exact price of Martian real estate on Olympus Mons?",
        "en",
        None,
        expect_refusal=True,
    ),
]


async def run_rag_evaluation(pipeline: RagPipeline | None = None) -> dict[str, Any]:
    engine = pipeline or rag_pipeline
    retrieval_cases = [c for c in GOLDEN_EVAL_SET if c.expected_doc_id is not None]
    refusal_cases = [c for c in GOLDEN_EVAL_SET if c.expect_refusal]

    hits_at_5 = 0
    mrr_sum = 0.0
    grounded_ok = 0
    citation_precision_sum = 0.0
    answered_cases = 0
    refusal_correct = 0
    emergency_correct = 0
    emergency_total = 0

    details: list[dict[str, Any]] = []

    for case in GOLDEN_EVAL_SET:
        retrieved = engine.retrieve(case.query, top_k=5)
        doc_ids = [r.chunk.doc_id for r in retrieved]

        if case.expected_doc_id is not None:
            if case.expected_doc_id in doc_ids:
                hits_at_5 += 1
                rank = doc_ids.index(case.expected_doc_id) + 1
                mrr_sum += 1.0 / rank

        ans = await engine.answer(case.query, locale=case.locale)

        if case.expect_emergency:
            emergency_total += 1
            if ans.emergency_bypass and "999" in ans.answer_text:
                emergency_correct += 1

        if case.expect_refusal:
            if ans.refused:
                refusal_correct += 1
        else:
            answered_cases += 1
            if ans.grounded and ans.verification_passed and not ans.refused:
                grounded_ok += 1
            if ans.citations:
                matching = sum(
                    1 for c in ans.citations if c.doc_id == case.expected_doc_id
                )
                citation_precision_sum += 1.0 if matching > 0 else 0.0

        details.append(
            {
                "id": case.id,
                "expected_doc_id": case.expected_doc_id,
                "top_doc_id": doc_ids[0] if doc_ids else None,
                "refused": ans.refused,
                "emergency_bypass": ans.emergency_bypass,
                "verification_passed": ans.verification_passed,
            }
        )

    recall_at_5 = round(hits_at_5 / max(1, len(retrieval_cases)), 4)
    mrr = round(mrr_sum / max(1, len(retrieval_cases)), 4)
    groundedness = round(grounded_ok / max(1, answered_cases), 4)
    citation_precision = round(citation_precision_sum / max(1, answered_cases), 4)
    refusal_accuracy = round(refusal_correct / max(1, len(refusal_cases)), 4)
    emergency_accuracy = round(emergency_correct / max(1, emergency_total), 4)

    metrics_registry.last_groundedness_score = groundedness
    metrics_registry.last_citation_precision = citation_precision

    return {
        "total_cases": len(GOLDEN_EVAL_SET),
        "recall_at_5": recall_at_5,
        "mrr": mrr,
        "groundedness": groundedness,
        "citation_precision": citation_precision,
        "refusal_accuracy": refusal_accuracy,
        "emergency_accuracy": emergency_accuracy,
        "details": details,
    }
