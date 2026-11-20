"""Classical & tabular ML models for Jonoshheba AI (Phase 12).

Models:
1. Transport sell-out risk forecaster (calibrated logistic model; explicitly tagged MOCK in dev)
2. Ticket Watch adaptive polling optimizer (contextual policy within provider budget)
3. Complaint agency router & urgency classifier (Bangla/English/Banglish -> GRS agency)
4. Privacy-preserving life-event & benefit recommender (zero sensitive PII required — Rule R9)
5. Regional demand/outage spike detector enforcing k-anonymity >= 10 (Rule R10)
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Literal

from app.nlp.bangla import normalize_bangla

# --- 1. Transport Demand & Sell-Out Risk Forecaster ---

_HIGH_DEMAND_ROUTES = {
    ("DA", "CTG"),
    ("CTG", "DA"),
    ("DA", "CXB"),
    ("CXB", "DA"),
    ("DA", "SYL"),
    ("SYL", "DA"),
    ("DA", "RAJ"),
    ("RAJ", "DA"),
    ("DA", "RGP"),
    ("RGP", "DA"),
}

_SEAT_CLASS_WEIGHT: dict[str, float] = {
    "AC_B": 0.95,
    "AC_S": 0.70,
    "SNIGDHA": 0.55,
    "S_CHAIR": 0.35,
    "SHOVAN": 0.15,
    "AC_BUS": 0.45,
    "NON_AC_BUS": 0.15,
}


def predict_sellout_risk(
    origin_code: str,
    destination_code: str,
    days_before_departure: int,
    day_of_week: int,  # 0=Mon .. 4=Fri, 5=Sat, 6=Sun
    seat_class: str = "S_CHAIR",
    is_eid_or_holiday: bool = False,
) -> dict[str, Any]:
    """Calibrated logistic sell-out risk estimator (versioned, deterministic, CPU-fast)."""
    pair = (origin_code.upper(), destination_code.upper())
    z = -1.1
    z += 0.85 if pair in _HIGH_DEMAND_ROUTES else 0.20
    # Closer to departure -> sharply higher sell-out probability
    clamped_days = max(0, min(15, days_before_departure))
    z += max(0.0, (10 - clamped_days) * 0.24)
    # Bangladesh weekend travel peaks on Thursday (3) & Friday (4)
    if day_of_week in (3, 4):
        z += 0.65
    elif day_of_week == 5:
        z += 0.30
    z += _SEAT_CLASS_WEIGHT.get(seat_class.upper(), 0.3)
    if is_eid_or_holiday:
        z += 1.75

    prob = round(1.0 / (1.0 + math.exp(-z)), 4)
    if prob >= 0.82:
        tier = "CRITICAL"
        rec_bn = "খুব দ্রুত টিকিট শেষ হওয়ার সম্ভাবনা। অফিশিয়াল পোর্টাল দেখুন এবং টিকিট ওয়াচ চালু করুন।"
        rec_en = "Very high sell-out risk. Check the official portal now and enable a Ticket Watch."
    elif prob >= 0.58:
        tier = "HIGH"
        rec_bn = "চাহিদা বেশি। অগ্রিম অফিশিয়াল পোর্টালে আসন যাচাই করুন।"
        rec_en = "High demand expected. Check official availability early."
    elif prob >= 0.32:
        tier = "MEDIUM"
        rec_bn = "মাঝারি চাহিদা। যাত্রার ১-২ দিন আগে যাচাই করলে ভালো হয়।"
        rec_en = "Moderate demand. Checking 1-2 days before departure is advised."
    else:
        tier = "LOW"
        rec_bn = "সাধারণ চাহিদা। অফিশিয়াল চ্যানেলে আসন পাওয়ার সম্ভাবনা ভালো।"
        rec_en = "Normal demand. Good chance of seats on the official channel."

    return {
        "model_name": "transport_sellout_forecaster",
        "model_version": "1.0.0",
        "data_provenance": "MOCK",
        "sellout_probability": prob,
        "risk_tier": tier,
        "recommendation_bn": rec_bn,
        "recommendation_en": rec_en,
        "disclaimer": "Probabilistic forecast only — seats are NOT reserved (Rule R1/R4).",
    }


# --- 2. Ticket Watch Adaptive Polling Optimizer ---


def recommend_watch_interval(
    hours_to_departure: float,
    sellout_probability: float,
    active_watchers_on_route: int,
    provider_error_rate: float = 0.0,
) -> dict[str, Any]:
    """Selects compliant watch polling interval (60s-900s) respecting provider rate limits (R2)."""
    if provider_error_rate >= 0.30:
        return {
            "poll_interval_seconds": 900,
            "priority_tier": "BACKOFF",
            "reason": "Elevated provider error rate; backing off to respect provider health (R2).",
        }

    # Base interval by departure urgency
    if hours_to_departure <= 6:
        interval = 90
        tier = "URGENT"
    elif hours_to_departure <= 24:
        interval = 180
        tier = "HIGH"
    elif hours_to_departure <= 72:
        interval = 300
        tier = "NORMAL"
    else:
        interval = 600
        tier = "LOW"

    # Tighten slightly when many citizens share the same fan-in route key
    if active_watchers_on_route >= 20 and sellout_probability >= 0.7:
        interval = max(60, int(interval * 0.75))

    return {
        "model_name": "watch_polling_optimizer",
        "model_version": "1.0.0",
        "poll_interval_seconds": interval,
        "priority_tier": tier,
        "fan_in_shared": active_watchers_on_route > 1,
        "reason": "Adaptive fan-in interval balancing freshness and provider rate-limit budget.",
    }


# --- 3. Complaint Agency Router & Urgency Classifier ---

_AGENCY_RULES: list[tuple[str, str, str, tuple[str, ...]]] = [
    (
        "POWER_UTILITY",
        "Power Division / DESCO / DPDC / BREB",
        "বিদ্যুৎ বিভাগ / ডেসকো / ডিপিডিসি / পল্লী বিদ্যুৎ",
        (
            "বিদ্যুৎ",
            "লোডশেডিং",
            "মিটার",
            "ডেসকো",
            "ডিপিডিসি",
            "electricity",
            "desco",
            "dpdc",
            "biddut",
            "power",
        ),
    ),
    (
        "WASA_WATER",
        "Dhaka WASA / Public Health Engineering",
        "ওয়াসা / জনস্বাস্থ্য প্রকৌশল অধিদপ্তর",
        ("পানি", "ওয়াসা", "ড্রেন", "জলাবদ্ধতা", "water", "wasa", "drain", "pani"),
    ),
    (
        "LAND_MINISTRY",
        "Ministry of Land (AC Land / e-Mutation)",
        "ভূমি মন্ত্রণালয় (এসিল্যান্ড / ই-নামজারি)",
        ("জমি", "নামজারি", "খতিয়ান", "ভূমি", "খাজনা", "land", "namjari", "mutation", "khotiyan"),
    ),
    (
        "RAILWAY",
        "Bangladesh Railway",
        "বাংলাদেশ রেলওয়ে",
        ("ট্রেন", "রেল", "স্টেশন", "টিকিট রিফান্ড", "train", "railway", "station", "refund"),
    ),
    (
        "PASSPORT_IMMIGRATION",
        "Department of Immigration & Passports (DIP)",
        "ইমিগ্রেশন ও পাসপোর্ট অধিদপ্তর",
        ("পাসপোর্ট", "পুলিশ ভেরিফিকেশন", "passport", "immigration"),
    ),
    (
        "LOCAL_GOVT",
        "Local Government Division (City Corp / Union Parishad / BDRIS)",
        "স্থানীয় সরকার বিভাগ (সিটি কর্পোরেশন / ইউনিয়ন পরিষদ / জন্ম নিবন্ধন)",
        ("জন্ম নিবন্ধন", "রাস্তা", "ময়লা", "ইউনিয়ন পরিষদ", "পৌরসভা", "road", "garbage", "birth", "jonmo"),
    ),
    (
        "HEALTH_DGHS",
        "Directorate General of Health Services (DGHS)",
        "স্বাস্থ্য অধিদপ্তর",
        ("হাসপাতাল", "ডাক্তার", "ওষুধ", "ক্লিনিক", "hospital", "clinic", "doctor", "health"),
    ),
    (
        "CONSUMER_RIGHTS",
        "Directorate of National Consumer Rights Protection (DNCRP)",
        "জাতীয় ভোক্তা অধিকার সংরক্ষণ অধিদপ্তর",
        ("ভোক্তা", "ভেজাল", "বেশি দাম", "consumer", "overcharge", "adulteration"),
    ),
]

_HIGH_URGENCY_TOKENS = (
    "বিপজ্জনক",
    "ক্ষতিগ্রস্ত",
    "ঘুষ",
    "দুর্নীতি",
    "বিচ্ছিন্ন",
    "হাসপাতাল",
    "danger",
    "bribe",
    "corruption",
    "outage",
    "broken",
    "harassment",
)


def route_complaint(text: str) -> dict[str, Any]:
    """Routes citizen complaint text to suggested GRS agency + urgency (human review required)."""
    norm = normalize_bangla(text)
    best_code = "GRS_GENERAL"
    best_en = "Cabinet Division — Central Grievance Redress System (GRS)"
    best_bn = "মন্ত্রিপরিষদ বিভাগ — কেন্দ্রীয় অভিযোগ প্রতিকার ব্যবস্থা (GRS)"
    best_hits = 0

    for code, name_en, name_bn, keywords in _AGENCY_RULES:
        hits = sum(1 for kw in keywords if normalize_bangla(kw) in norm)
        if hits > best_hits:
            best_hits = hits
            best_code = code
            best_en = name_en
            best_bn = name_bn

    urgent_hits = sum(1 for tok in _HIGH_URGENCY_TOKENS if normalize_bangla(tok) in norm)
    urgency: Literal["P1_HIGH", "P2_NORMAL", "P3_LOW"] = (
        "P1_HIGH" if urgent_hits >= 1 else ("P2_NORMAL" if best_hits >= 1 else "P3_LOW")
    )
    confidence = min(0.95, round(0.60 + 0.12 * best_hits, 3)) if best_hits > 0 else 0.52

    return {
        "model_name": "complaint_agency_router",
        "model_version": "1.0.0",
        "suggested_agency_code": best_code,
        "suggested_agency_en": best_en,
        "suggested_agency_bn": best_bn,
        "urgency": urgency,
        "confidence": confidence,
        "official_portal_url": "https://www.grs.gov.bd",
        "human_review_required": True,
    }


# --- 4. Privacy-Preserving Life-Event Recommender (Rule R9) ---


def recommend_life_events(
    life_stage: Literal[
        "student", "parent", "senior", "job_seeker", "traveler", "general"
    ] = "general",
    district_code: str | None = None,
) -> dict[str, Any]:
    """Recommends citizen journeys without requiring NID, income, or sensitive PII."""
    catalog: dict[str, list[dict[str, str]]] = {
        "student": [
            {
                "slug": "education-scholarships",
                "title_bn": "উপবৃত্তি ও শিক্ষাবৃত্তি",
                "title_en": "Scholarships & Stipends",
                "route": "/benefits",
            },
            {
                "slug": "public-jobs",
                "title_bn": "সরকারি চাকরি ও বিসিএস",
                "title_en": "Government Jobs & BCS",
                "route": "/benefits",
            },
            {
                "slug": "nid-birth-cert",
                "title_bn": "জন্ম নিবন্ধন ও এনআইডি",
                "title_en": "Birth Certificate & NID",
                "route": "/services",
            },
        ],
        "parent": [
            {
                "slug": "new-baby",
                "title_bn": "নবজাতকের জন্ম নিবন্ধন ও টিকা",
                "title_en": "Newborn Birth Reg & Vaccines",
                "route": "/services",
            },
            {
                "slug": "maternity-allowance",
                "title_bn": "মাতৃত্বকালীন ভাতা যাচাই",
                "title_en": "Maternity Allowance Check",
                "route": "/benefits",
            },
            {
                "slug": "emergency-health",
                "title_bn": "জরুরি স্বাস্থ্য ও ১৬২৬৩",
                "title_en": "Emergency Health & 16263",
                "route": "/emergency",
            },
        ],
        "senior": [
            {
                "slug": "old-age-allowance",
                "title_bn": "বয়স্ক ভাতা সম্ভাব্য যোগ্যতা",
                "title_en": "Old Age Allowance Check",
                "route": "/benefits",
            },
            {
                "slug": "public-health",
                "title_bn": "সরকারি হাসপাতাল ও স্বাস্থ্য বাতায়ন",
                "title_en": "Public Hospitals & 16263",
                "route": "/health",
            },
            {
                "slug": "land-services",
                "title_bn": "ভূমি নামজারি ও খতিয়ান",
                "title_en": "Land Mutation & Khatian",
                "route": "/services",
            },
        ],
        "job_seeker": [
            {
                "slug": "public-jobs",
                "title_bn": "সরকারি চাকরির বিজ্ঞপ্তি",
                "title_en": "Public Job Circulars",
                "route": "/benefits",
            },
            {
                "slug": "passport-pcc",
                "title_bn": "ই-পাসপোর্ট ও পুলিশ ক্লিয়ারেন্স",
                "title_en": "e-Passport & Police Clearance",
                "route": "/services",
            },
        ],
        "traveler": [
            {
                "slug": "eid-travel",
                "title_bn": "ট্রেন ও বাস সময়সূচি এবং টিকিট ওয়াচ",
                "title_en": "Train & Bus Hub + Ticket Watch",
                "route": "/transport",
            },
            {
                "slug": "emergency-travel",
                "title_bn": "ভ্রমণে জরুরি ৯৯৯ সহায়তা",
                "title_en": "Travel Emergency 999",
                "route": "/emergency",
            },
        ],
        "general": [
            {
                "slug": "eid-travel",
                "title_bn": "স্মার্ট পরিবহন হাব",
                "title_en": "Smart Transport Hub",
                "route": "/transport",
            },
            {
                "slug": "gov-services",
                "title_bn": "সরকারি সেবা ডিরেক্টরি",
                "title_en": "Government Service Directory",
                "route": "/services",
            },
            {
                "slug": "benefits-check",
                "title_bn": "সরকারি ভাতা ও বৃত্তি",
                "title_en": "Benefits & Scholarships",
                "route": "/benefits",
            },
        ],
    }
    return {
        "model_name": "life_event_recommender",
        "model_version": "1.0.0",
        "life_stage": life_stage,
        "district_code": district_code,
        "privacy_mode": "MINIMAL_NON_PII_R9",
        "recommendations": catalog.get(life_stage, catalog["general"]),
    }


# --- 5. Regional Anomaly Detector with Strict k-Anonymity >= 10 (Rule R10) ---


@dataclass(frozen=True)
class RegionalMetricBucket:
    region_code: str
    category: str
    current_count: int
    baseline_mean: float
    baseline_std: float


def detect_regional_anomalies(
    buckets: list[RegionalMetricBucket],
    k_anonymity_min: int = 10,
    z_threshold: float = 2.5,
) -> dict[str, Any]:
    """Detects regional demand/outage spikes while suppressing any bucket with count < 10 (R10)."""
    effective_k = max(10, k_anonymity_min)  # Hard floor per AGENTS.md Rule R10
    suppressed = 0
    anomalies: list[dict[str, Any]] = []

    for b in buckets:
        if b.current_count < effective_k:
            suppressed += 1
            continue
        std = max(1.0, b.baseline_std)
        z = round((b.current_count - b.baseline_mean) / std, 3)
        if z >= z_threshold:
            anomalies.append(
                {
                    "region_code": b.region_code,
                    "category": b.category,
                    "current_count": b.current_count,
                    "baseline_mean": b.baseline_mean,
                    "z_score": z,
                    "severity": "HIGH" if z >= 4.0 else "MEDIUM",
                }
            )

    anomalies.sort(key=lambda x: float(x["z_score"]), reverse=True)
    return {
        "model_name": "regional_spike_anomaly_detector",
        "model_version": "1.0.0",
        "k_anonymity_threshold": effective_k,
        "suppressed_small_buckets": suppressed,
        "anomalies": anomalies,
    }
