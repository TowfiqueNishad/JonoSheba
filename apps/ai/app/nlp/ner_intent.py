"""Bangla/English/Banglish intent classifier & Bangladesh-aware NER.

Handles:
- 11 citizen intents (emergency checked FIRST per Rule R8)
- Bangladesh districts/stations → geo/station codes
- Relative Bangla & English dates resolved in Asia/Dhaka (UTC+06:00), e.g., "আগামী শুক্রবার"
- Official document names and complaint/application reference IDs.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone
from typing import Literal

from app.nlp.bangla import normalize_bangla

IntentLabel = Literal[
    "transport",
    "service",
    "benefit",
    "scholarship",
    "job",
    "complaint",
    "emergency",
    "health",
    "utility",
    "chitchat",
    "out_of_scope",
]

DHAKA_TZ = timezone(timedelta(hours=6))

# Rule R8: Emergency signals take absolute top priority.
_INTENT_KEYWORDS: list[tuple[IntentLabel, tuple[str, ...]]] = [
    (
        "emergency",
        (
            "999",
            "জরুরি",
            "আগুন",
            "অ্যাম্বুলেন্স",
            "পুলিশ",
            "সাহায্য",
            "বাঁচান",
            "দুর্ঘটনা",
            "আত্মহত্যা",
            "বুক ব্যথা",
            "শ্বাসকষ্ট",
            "emergency",
            "fire",
            "ambulance",
            "police",
            "accident",
            "chest pain",
            "suicide",
            "joruri",
        ),
    ),
    (
        "transport",
        (
            "ট্রেন",
            "বাস",
            "টিকিট",
            "রেল",
            "স্টেশন",
            "আসন",
            "সিট",
            "যাত্রা",
            "ঈদ যাত্রা",
            "train",
            "bus",
            "ticket",
            "rail",
            "station",
            "seat",
            "journey",
            "shohoz",
        ),
    ),
    (
        "scholarship",
        (
            "বৃত্তি",
            "উপবৃত্তি",
            "স্কলারশিপ",
            "শিক্ষাবৃত্তি",
            "বিশ্ববিদ্যালয়",
            "ভর্তি",
            "scholarship",
            "stipend",
            "upobriti",
            "upobritti",
            "britti",
        ),
    ),
    (
        "job",
        (
            "চাকরি",
            "নিয়োগ",
            "বিসিএস",
            "বিজ্ঞপ্তি",
            "সার্কুলার",
            "আবেদন ফরম",
            "job",
            "recruitment",
            "circular",
            "bcs",
            "vacancy",
            "chakri",
        ),
    ),
    (
        "benefit",
        (
            "ভাতা",
            "বয়স্ক ভাতা",
            "বিধবা ভাতা",
            "প্রতিবন্ধী ভাতা",
            "মাতৃত্বকালীন",
            "টিসিবি",
            "ফ্যামিলি কার্ড",
            "অনুদান",
            "যোগ্যতা",
            "allowance",
            "benefit",
            "eligible",
            "eligibility",
            "bhata",
            "boyosko",
            "bidhoba",
            "tcb",
        ),
    ),
    (
        "complaint",
        (
            "অভিযোগ",
            "জিআরএস",
            "প্রতিকার",
            "দুর্নীতি",
            "হয়রানি",
            "ভোক্তা",
            "complaint",
            "grievance",
            "grs",
            "ovijog",
            "obhijog",
            "report broken",
        ),
    ),
    (
        "health",
        (
            "হাসপাতাল",
            "চিকিৎসা",
            "ডাক্তার",
            "টিকা",
            "ডেঙ্গু",
            "স্বাস্থ্য",
            "ক্লিনিক",
            "রক্ত",
            "hospital",
            "health",
            "clinic",
            "vaccine",
            "dengue",
            "doctor",
            "chikitsha",
            "haspatal",
        ),
    ),
    (
        "utility",
        (
            "বিদ্যুৎ",
            "গ্যাস",
            "পানি",
            "ডেসকো",
            "ডিপিডিসি",
            "তিতাস",
            "ওয়াসা",
            "বিল",
            "লোডশেডিং",
            "electricity",
            "desco",
            "dpdc",
            "titas",
            "wasa",
            "outage",
            "utility",
            "biddut",
        ),
    ),
    (
        "service",
        (
            "জন্ম নিবন্ধন",
            "পাসপোর্ট",
            "জাতীয় পরিচয়পত্র",
            "এনআইডি",
            "নামজারি",
            "খতিয়ান",
            "ট্রেড লাইসেন্স",
            "ড্রাইভিং লাইসেন্স",
            "টিন",
            "পুলিশ ক্লিয়ারেন্স",
            "সার্টিফিকেট",
            "সেবা",
            "birth certificate",
            "passport",
            "nid",
            "namjari",
            "mutation",
            "license",
            "tin",
            "jonmo",
            "nibondhon",
        ),
    ),
    (
        "chitchat",
        (
            "হ্যালো",
            "হাই",
            "সালাম",
            "আসসালামু আলাইকুম",
            "ধন্যবাদ",
            "কেমন আছেন",
            "hello",
            "hi",
            "thanks",
            "thank you",
            "salam",
        ),
    ),
]


@dataclass(frozen=True)
class IntentResult:
    intent: IntentLabel
    confidence: float
    matched_signals: list[str]


def classify_intent(text: str) -> IntentResult:
    norm = normalize_bangla(text)
    if not norm:
        return IntentResult("out_of_scope", 0.5, [])

    best_intent: IntentLabel = "out_of_scope"
    best_hits: list[str] = []

    for intent, keywords in _INTENT_KEYWORDS:
        hits = [kw for kw in keywords if normalize_bangla(kw) in norm]
        if intent == "emergency" and hits:
            return IntentResult("emergency", 0.98, hits)
        if len(hits) > len(best_hits):
            best_intent = intent
            best_hits = hits

    if not best_hits:
        return IntentResult("out_of_scope", 0.55, [])
    conf = min(0.97, round(0.76 + 0.07 * len(best_hits), 3))
    return IntentResult(best_intent, conf, best_hits)


@dataclass(frozen=True)
class ExtractedEntity:
    type: Literal["place", "station", "date", "document", "reference_id"]
    text: str
    normalized: str
    code: str | None = None


_PLACES: list[tuple[str, str, str, str]] = [
    ("ঢাকা", "Dhaka", "BD-C-DHAKA", "DA"),
    ("dhaka", "Dhaka", "BD-C-DHAKA", "DA"),
    ("চট্টগ্রাম", "Chattogram", "BD-B-CHATTOGRAM", "CTG"),
    ("chattogram", "Chattogram", "BD-B-CHATTOGRAM", "CTG"),
    ("chittagong", "Chattogram", "BD-B-CHATTOGRAM", "CTG"),
    ("সিলেট", "Sylhet", "BD-G-SYLHET", "SYL"),
    ("sylhet", "Sylhet", "BD-G-SYLHET", "SYL"),
    ("রাজশাহী", "Rajshahi", "BD-E-RAJSHAHI", "RAJ"),
    ("rajshahi", "Rajshahi", "BD-E-RAJSHAHI", "RAJ"),
    ("খুলনা", "Khulna", "BD-D-KHULNA", "KLN"),
    ("khulna", "Khulna", "BD-D-KHULNA", "KLN"),
    ("বরিশাল", "Barishal", "BD-A-BARISHAL", "BSL"),
    ("barishal", "Barishal", "BD-A-BARISHAL", "BSL"),
    ("রংপুর", "Rangpur", "BD-F-RANGPUR", "RGP"),
    ("rangpur", "Rangpur", "BD-F-RANGPUR", "RGP"),
    ("ময়মনসিংহ", "Mymensingh", "BD-H-MYMENSINGH", "MYN"),
    ("mymensingh", "Mymensingh", "BD-H-MYMENSINGH", "MYN"),
    ("কক্সবাজার", "Cox's Bazar", "BD-B-COXSBAZAR", "CXB"),
    ("cox's bazar", "Cox's Bazar", "BD-B-COXSBAZAR", "CXB"),
    ("coxsbazar", "Cox's Bazar", "BD-B-COXSBAZAR", "CXB"),
    ("কমলাপুর", "Dhaka Kamalapur", "BD-C-DHAKA", "DA"),
    ("kamalapur", "Dhaka Kamalapur", "BD-C-DHAKA", "DA"),
    ("বিমানবন্দর", "Dhaka Airport", "BD-C-DHAKA", "DA_B"),
    ("কুমিল্লা", "Cumilla", "BD-B-CUMILLA", "CML"),
    ("cumilla", "Cumilla", "BD-B-CUMILLA", "CML"),
    ("যশোর", "Jashore", "BD-D-JASHORE", "JSR"),
    ("jashore", "Jashore", "BD-D-JASHORE", "JSR"),
]

_DOCUMENTS: list[tuple[str, str, str]] = [
    ("জন্ম নিবন্ধন", "Birth Registration Certificate", "DOC_BRN"),
    ("jonmo nibondhon", "Birth Registration Certificate", "DOC_BRN"),
    ("birth certificate", "Birth Registration Certificate", "DOC_BRN"),
    ("জাতীয় পরিচয়পত্র", "National ID (NID)", "DOC_NID"),
    ("এনআইডি", "National ID (NID)", "DOC_NID"),
    ("nid", "National ID (NID)", "DOC_NID"),
    ("পাসপোর্ট", "e-Passport", "DOC_PASSPORT"),
    ("passport", "e-Passport", "DOC_PASSPORT"),
    ("নামজারি", "Land Mutation (Namjari)", "DOC_NAMJARI"),
    ("namjari", "Land Mutation (Namjari)", "DOC_NAMJARI"),
    ("ই-টিন", "e-TIN Certificate", "DOC_ETIN"),
    ("e-tin", "e-TIN Certificate", "DOC_ETIN"),
    ("ড্রাইভিং লাইসেন্স", "Driving License", "DOC_DL"),
    ("driving license", "Driving License", "DOC_DL"),
]

# Python weekday(): Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
_WEEKDAYS: list[tuple[str, int]] = [
    ("সোমবার", 0),
    ("sombar", 0),
    ("monday", 0),
    ("মঙ্গলবার", 1),
    ("mongolbar", 1),
    ("tuesday", 1),
    ("বুধবার", 2),
    ("budhbar", 2),
    ("wednesday", 2),
    ("বৃহস্পতিবার", 3),
    ("brihospotibar", 3),
    ("thursday", 3),
    ("শুক্রবার", 4),
    ("shukrobar", 4),
    ("friday", 4),
    ("শনিবার", 5),
    ("shonibar", 5),
    ("saturday", 5),
    ("রবিবার", 6),
    ("robibar", 6),
    ("sunday", 6),
]

_ISO_DATE_RE = re.compile(r"\b(20\d{2}-\d{2}-\d{2})\b")
_REF_ID_RE = re.compile(r"\b(?:GRS|JONO|CASE|APP|TKT)-[A-Z0-9-]{4,24}\b", re.IGNORECASE)


def _next_weekday(base_dhaka: datetime, target_weekday: int, force_next: bool) -> datetime:
    days_ahead = (target_weekday - base_dhaka.weekday()) % 7
    if days_ahead == 0 and force_next:
        days_ahead = 7
    elif days_ahead == 0:
        days_ahead = 7
    return base_dhaka + timedelta(days=days_ahead)


def extract_entities(text: str, now_utc: datetime | None = None) -> list[ExtractedEntity]:
    """Extracts places, stations, relative/absolute dates (in Asia/Dhaka), docs, and ref IDs."""
    entities: list[ExtractedEntity] = []
    norm = normalize_bangla(text)
    now_dhaka = (now_utc or datetime.now(UTC)).astimezone(DHAKA_TZ)

    seen_places: set[str] = set()
    for surface, canonical, geo_code, station_code in _PLACES:
        if normalize_bangla(surface) in norm and canonical not in seen_places:
            seen_places.add(canonical)
            entities.append(
                ExtractedEntity(type="place", text=surface, normalized=canonical, code=geo_code)
            )
            entities.append(
                ExtractedEntity(
                    type="station", text=surface, normalized=canonical, code=station_code
                )
            )

    seen_docs: set[str] = set()
    for surface, canonical, doc_code in _DOCUMENTS:
        if normalize_bangla(surface) in norm and doc_code not in seen_docs:
            seen_docs.add(doc_code)
            entities.append(
                ExtractedEntity(type="document", text=surface, normalized=canonical, code=doc_code)
            )

    # Explicit ISO dates
    for match in _ISO_DATE_RE.finditer(norm):
        iso = match.group(1)
        entities.append(ExtractedEntity(type="date", text=iso, normalized=iso, code="ASIA_DHAKA"))

    # Relative dates: আজ / আগামীকাল / পরশু / আগামী <weekday>
    if any(tok in norm for tok in ("আজকে", "আজ", "today", "ajke")):
        iso = now_dhaka.date().isoformat()
        entities.append(
            ExtractedEntity(type="date", text="today", normalized=iso, code="ASIA_DHAKA")
        )

    if any(tok in norm for tok in ("আগামীকাল", "tomorrow", "agami kal")):
        iso = (now_dhaka + timedelta(days=1)).date().isoformat()
        entities.append(
            ExtractedEntity(type="date", text="tomorrow", normalized=iso, code="ASIA_DHAKA")
        )

    if any(tok in norm for tok in ("পরশু", "day after tomorrow")):
        iso = (now_dhaka + timedelta(days=2)).date().isoformat()
        entities.append(
            ExtractedEntity(
                type="date", text="day_after_tomorrow", normalized=iso, code="ASIA_DHAKA"
            )
        )

    has_next_prefix = any(tok in norm for tok in ("আগামী", "next", "agami"))
    for surface, wd in _WEEKDAYS:
        if normalize_bangla(surface) in norm:
            resolved = _next_weekday(now_dhaka, wd, force_next=has_next_prefix)
            label = f"আগামী {surface}" if "আগামী" in text else surface
            entities.append(
                ExtractedEntity(
                    type="date",
                    text=label,
                    normalized=resolved.date().isoformat(),
                    code="ASIA_DHAKA",
                )
            )
            break

    # Reference IDs
    for match in _REF_ID_RE.finditer(text):
        ref = match.group(0).upper()
        entities.append(ExtractedEntity(type="reference_id", text=match.group(0), normalized=ref))

    return entities
