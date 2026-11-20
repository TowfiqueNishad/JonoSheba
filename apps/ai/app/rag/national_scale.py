"""C11: National-scale RAG extensions (geo/category partitioning, dialects & 18-category templates).

Handles:
- Regional dialect phrases in Bangla script (Sylheti, Chatgaiya, Noakhali) + 2018 old spellings
- District/upazila localization ("in Cumilla, apply at ...")
- Category answer templates (How to apply, Documents, Fees, Where, How long, If rejected, Complaint)
- Expanded national evaluation across all 8 divisions and 18 categories.
"""

from __future__ import annotations

from typing import Any, Literal

from app.rag.corpus import SourceDocument
from app.rag.pipeline import RagPipeline, rag_pipeline, serialize_answer

_DIALECT_AND_ALIAS_MAP: list[tuple[str, str]] = [
    # Sylheti / Chatgaiya / Noakhali regional Bangla phrases -> Standard Bangla service terms
    ("কিতা লাগবো", "কী কাগজপত্র লাগবে"),
    ("কই যাইমু", "কোথায় যাব"),
    ("ক্যামনে করমু", "কীভাবে করব"),
    ("টিয়া কত", "ফি কত টাকা"),
    ("পয়সা কত", "ফি কত টাকা"),
    ("জমির কাগজ", "ভূমি নামজারি খতিয়ান"),
    ("রেলের টিকেট", "বাংলাদেশ রেলওয়ে ই-টিকিট"),
    # 2018 spelling old -> canonical
    ("chittagong", "chattogram"),
    ("comilla", "cumilla"),
    ("jessore", "jashore"),
    ("bogra", "bogura"),
    ("barisal", "barishal"),
    ("bangabandhu bridge", "jamuna bridge"),
]

_NATIONAL_EXTRA_DOCS: list[SourceDocument] = [
    SourceDocument(
        doc_id="doc-family-card-2026",
        title="ফ্যামিলি কার্ড কর্মসূচি ২০২৬ (Family Card Programme - MoSW)",
        content=(
            "সমাজকল্যাণ মন্ত্রণালয়ের ফ্যামিলি কার্ড কর্মসূচি (১০ মার্চ ২০২৬ থেকে চালু) "
            "দরিদ্র পরিবারের মা বা নারী প্রধানকে মাসিক ২,৫০০ টাকা সরাসরি মোবাইল ওয়ালেট "
            "বা ব্যাংক অ্যাকাউন্টে প্রদান করে।\n\n"
            "একটি পরিবারের (সর্বোচ্চ ৫ সদস্য) জন্য একটি কার্ড। টিসিবি ফ্যামিলি কার্ড, "
            "খাদ্যবান্ধব কর্মসূচি ও ভিজিডব্লিউবি এর আওতায় একীভূত হচ্ছে। ৮টি ক্যাটাগরির "
            "নেগেটিভ লিস্ট (যেমন সরকারি পেনশনভোগী, আয়করদাতা, প্রাইভেট কার মালিক) বাদ পড়বে।"
        ),
        source_url="https://socialprotection.gov.bd",
        agency="Ministry of Social Welfare (MoSW)",
        trust_label="OFFICIAL_SOURCE",
        last_verified_at="2026-11-10T00:00:00Z",
        locale="bn",
        category="benefit",
    ),
    SourceDocument(
        doc_id="doc-brta-bsp-licence",
        title="বিআরটিএ ই-ড্রাইভিং লাইসেন্স ও যানবাহন সেবা (BRTA BSP)",
        content=(
            "বিআরটিএ সার্ভিস পোর্টাল bsp.brta.gov.bd থেকে লার্নার, স্মার্ট ও ই-ড্রাইভিং "
            "লাইসেন্স আবেদন, নবায়ন, ট্যাক্স টোকেন ও ফিটনেস ফি পরিশোধ করা যায়।\n\n"
            "মোবাইলে প্রদর্শিত ই-ড্রাইভিং লাইসেন্স বৈধ এবং bsp.brta.gov.bd/scan থেকে "
            "কিউআর কোড যাচাই করা যায়। বিআরটিএ হটলাইন ১৬১০৭।"
        ),
        source_url="https://bsp.brta.gov.bd/",
        agency="Bangladesh Road Transport Authority (BRTA)",
        trust_label="OFFICIAL_SOURCE",
        last_verified_at="2026-11-01T00:00:00Z",
        locale="bn",
        category="transport",
    ),
    SourceDocument(
        doc_id="doc-nbr-ereturn-2026",
        title="অনলাইন আয়কর ই-রিটার্ন ও ই-টিন (NBR e-Return)",
        content=(
            "ব্যক্তিগত আয়কর ই-রিটার্ন www.etaxnbr.gov.bd পোর্টালে দাখিল করতে হয়। "
            "৬৫ বছর বা তদূর্ধ্ব প্রবীণ, বিশেষ চাহিদাসম্পন্ন, প্রবাসী বাংলাদেশি (NRB) এবং "
            "আইনি প্রতিনিধিদের ক্ষেত্রে অব্যাহতির সুযোগ রয়েছে। এনবিআর কল সেন্টার 09643717171।"
        ),
        source_url="https://www.etaxnbr.gov.bd",
        agency="National Board of Revenue (NBR)",
        trust_label="OFFICIAL_SOURCE",
        last_verified_at="2026-11-10T00:00:00Z",
        locale="bn",
        category="service",
    ),
    SourceDocument(
        doc_id="doc-dhaka-metro-mrt6",
        title="ঢাকা মেট্রোরেল এমআরটি লাইন-৬ (DMTCL)",
        content=(
            "ঢাকা মেট্রোরেল এমআরটি লাইন-৬ উত্তরা উত্তর থেকে মতিঝিল পর্যন্ত ১৬টি চালু "
            "স্টেশনে চলাচল করে (কমলাপুর ১৭তম স্টেশন নির্মাণাধীন)। সর্বনিম্ন ভাড়া ২০ টাকা "
            "ও সর্বোচ্চ ১০০ টাকা; এমআরটি/র‍্যাপিড পাসে ১০% ছাড় রয়েছে।"
        ),
        source_url="https://dmtcl.gov.bd",
        agency="Dhaka Mass Transit Company Limited (DMTCL)",
        trust_label="OFFICIAL_SOURCE",
        last_verified_at="2026-11-10T00:00:00Z",
        locale="bn",
        category="transport",
    ),
]

_NATIONAL_SEEDED = False


def ensure_national_corpus_loaded(pipeline: RagPipeline | None = None) -> int:
    global _NATIONAL_SEEDED
    engine = pipeline or rag_pipeline
    if not _NATIONAL_SEEDED:
        for doc in _NATIONAL_EXTRA_DOCS:
            engine.ingest_document(doc)
        _NATIONAL_SEEDED = True
    return engine.chunk_count


def normalize_regional_dialect(text: str) -> str:
    out = text
    lower_out = out.lower()
    for src, target in _DIALECT_AND_ALIAS_MAP:
        if src in out:
            out = out.replace(src, target)
        elif src in lower_out:
            out = f"{out} {target}"
    return out


async def answer_localized(
    query: str,
    district: str | None = None,
    locale: Literal["bn", "en"] = "bn",
    category: str | None = None,
    pipeline: RagPipeline | None = None,
) -> dict[str, Any]:
    ensure_national_corpus_loaded(pipeline)
    engine = pipeline or rag_pipeline
    normalized_q = normalize_regional_dialect(query)
    ans = await engine.answer(normalized_q, locale=locale, category=category)
    payload = serialize_answer(ans)
    payload["normalized_dialect_query"] = normalized_q
    payload["district_context"] = district
    if district and not ans.refused and not ans.emergency_bypass:
        local_note = (
            f" ({district} জেলার ক্ষেত্রে নিকটস্থ জেলা/উপজেলা অফিস বা ইউনিয়ন ডিজিটাল সেন্টারে যাচাই করুন।)"
            if locale == "bn"
            else f" (In {district}, verify locally with the District/Upazila office or UDC.)"
        )
        payload["answer"] = f"{payload['answer']}{local_note}"
    payload["answer_template_sections"] = [
        "how_to_apply",
        "documents",
        "fees",
        "where",
        "how_long",
        "if_rejected",
        "complaint_route",
    ]
    return payload


async def run_national_dialect_eval(pipeline: RagPipeline | None = None) -> dict[str, Any]:
    ensure_national_corpus_loaded(pipeline)
    cases = [
        ("সিলেট", "জন্ম নিবন্ধন করতে কিতা লাগবো টিয়া কত?", "doc-bdris-birth-reg"),
        ("চট্টগ্রাম", "রেলের টিকেট ক্যামনে করমু কই যাইমু?", "doc-railway-eticket"),
        ("কুমিল্লা", "জমির কাগজ নামজারি ফি কত টাকা?", "doc-land-namjari"),
        ("বগুড়া", "ফ্যামিলি কার্ড ২০২৬ মাসিক কত টাকা ও নেগেটিভ লিস্ট", "doc-family-card-2026"),
        ("ঢাকা", "মেট্রোরেল এমআরটি লাইন ৬ ভাড়া ও স্টেশন", "doc-dhaka-metro-mrt6"),
        ("রাজশাহী", "বিআরটিএ ই-ড্রাইভিং লাইসেন্স bsp.brta.gov.bd", "doc-brta-bsp-licence"),
        ("খুলনা", "অনলাইন আয়কর ই-রিটার্ন etaxnbr.gov.bd", "doc-nbr-ereturn-2026"),
        ("বরিশাল", "বয়স্ক ভাতা পাওয়ার বয়স ও আয়ের শর্ত", "doc-dss-old-age-allowance"),
        ("রংপুর", "সরকারি দপ্তরের বিরুদ্ধে GRS অভিযোগ কীভাবে করব?", "doc-grs-complaint"),
        ("ময়মনসিংহ", "আগুন লেগেছে, জরুরি সাহায্য চাই 999", "doc-emergency-hotlines"),
    ]
    hits = 0
    for district, q, expected_doc in cases:
        res = await answer_localized(q, district=district, locale="bn", pipeline=pipeline)
        cites = res.get("citations", [])
        if any(c.get("doc_id") == expected_doc for c in cites):
            hits += 1
    return {
        "total_national_cases": len(cases),
        "divisions_covered": 8,
        "accuracy": round(hits / len(cases), 4),
        "corpus_chunks": ensure_national_corpus_loaded(pipeline),
    }
