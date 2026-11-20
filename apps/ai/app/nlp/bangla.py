"""Bangla, English, and Banglish text normalization, language detection, and transliteration.

Carefully preserves Unicode combining marks (category M — Bangla vowel signs like া, ি, ু, ে
and hasanta ্) during normalization.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Literal

DetectedLanguage = Literal["bn", "en", "banglish", "mixed"]

_BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
_ZW_RE = re.compile(r"[\u200c\u200d\ufeff]")
_WS_RE = re.compile(r"\s+")

# Common Banglish (Romanized Bangla) citizen-service words & function words
_BANGLISH_TOKENS: frozenset[str] = frozenset(
    {
        "ami",
        "amake",
        "amar",
        "tumi",
        "apni",
        "kivabe",
        "kibhabe",
        "kemne",
        "kemon",
        "korbo",
        "korte",
        "kora",
        "hoy",
        "hobe",
        "lagbe",
        "dorkar",
        "kothay",
        "kothai",
        "kokhon",
        "koto",
        "taka",
        "jonmo",
        "janmo",
        "nibondhon",
        "nibondhan",
        "mrittu",
        "namjari",
        "khotiyan",
        "khajna",
        "bhata",
        "vata",
        "boyosko",
        "boyesko",
        "bidhoba",
        "protibondhi",
        "upobriti",
        "upobritti",
        "britti",
        "chakri",
        "sorkari",
        "shorkari",
        "sheba",
        "seba",
        "ovijog",
        "obhijog",
        "biddut",
        "bidyut",
        "pani",
        "jabo",
        "jete",
        "chai",
        "agami",
        "agamee",
        "kal",
        "ajke",
        "shukrobar",
        "brihospotibar",
        "shonibar",
        "robibar",
        "sombar",
        "mongolbar",
        "budhbar",
        "dhaka",
        "chattogram",
        "chittagong",
        "sylhet",
        "rajshahi",
        "khulna",
        "barishal",
        "rangpur",
        "mymensingh",
        "coxsbazar",
        "jashore",
        "cumilla",
        "chikitsha",
        "daktar",
        "haspatal",
        "joruri",
        "shohoj",
    }
)

_BANGLISH_PHRASES: list[tuple[str, str]] = [
    ("jonmo nibondhon", "জন্ম নিবন্ধন"),
    ("janmo nibondhon", "জন্ম নিবন্ধন"),
    ("mrittu nibondhon", "মৃত্যু নিবন্ধন"),
    ("boyosko bhata", "বয়স্ক ভাতা"),
    ("boyesko bhata", "বয়স্ক ভাতা"),
    ("bidhoba bhata", "বিধবা ভাতা"),
    ("protibondhi bhata", "প্রতিবন্ধী ভাতা"),
    ("bhumi namjari", "ভূমি নামজারি"),
    ("cox's bazar", "কক্সবাজার"),
    ("coxs bazar", "কক্সবাজার"),
    ("e passport", "ই-পাসপোর্ট"),
    ("e-passport", "ই-পাসপোর্ট"),
    ("agami shukrobar", "আগামী শুক্রবার"),
    ("agami brihospotibar", "আগামী বৃহস্পতিবার"),
    ("agami kal", "আগামীকাল"),
]

_BANGLISH_WORDS: dict[str, str] = {
    "jonmo": "জন্ম",
    "janmo": "জন্ম",
    "nibondhon": "নিবন্ধন",
    "nibondhan": "নিবন্ধন",
    "namjari": "নামজারি",
    "khotiyan": "খতিয়ান",
    "bhata": "ভাতা",
    "vata": "ভাতা",
    "boyosko": "বয়স্ক",
    "bidhoba": "বিধবা",
    "protibondhi": "প্রতিবন্ধী",
    "upobriti": "উপবৃত্তি",
    "upobritti": "উপবৃত্তি",
    "britti": "বৃত্তি",
    "chakri": "চাকরি",
    "sorkari": "সরকারি",
    "sheba": "সেবা",
    "ovijog": "অভিযোগ",
    "obhijog": "অভিযোগ",
    "biddut": "বিদ্যুৎ",
    "pani": "পানি",
    "gas": "গ্যাস",
    "passport": "পাসপোর্ট",
    "nid": "জাতীয় পরিচয়পত্র",
    "train": "ট্রেন",
    "bus": "বাস",
    "ticket": "টিকিট",
    "dhaka": "ঢাকা",
    "chattogram": "চট্টগ্রাম",
    "chittagong": "চট্টগ্রাম",
    "sylhet": "সিলেট",
    "rajshahi": "রাজশাহী",
    "khulna": "খুলনা",
    "barishal": "বরিশাল",
    "rangpur": "রংপুর",
    "mymensingh": "ময়মনসিংহ",
    "cumilla": "কুমিল্লা",
    "jashore": "যশোর",
    "bogura": "বগুড়া",
    "kivabe": "কীভাবে",
    "kibhabe": "কীভাবে",
    "korbo": "করব",
    "lagbe": "লাগবে",
    "kothay": "কোথায়",
    "taka": "টাকা",
    "haspatal": "হাসপাতাল",
    "joruri": "জরুরি",
    "agami": "আগামী",
    "shukrobar": "শুক্রবার",
    "brihospotibar": "বৃহস্পতিবার",
    "kal": "কাল",
    "ajke": "আজকে",
}

_BN_TO_LATIN: dict[str, str] = {
    "অ": "o",
    "আ": "a",
    "ই": "i",
    "ঈ": "ee",
    "উ": "u",
    "ঊ": "oo",
    "ঋ": "ri",
    "এ": "e",
    "ঐ": "oi",
    "ও": "o",
    "ঔ": "ou",
    "ক": "k",
    "খ": "kh",
    "গ": "g",
    "ঘ": "gh",
    "ঙ": "ng",
    "চ": "ch",
    "ছ": "chh",
    "জ": "j",
    "ঝ": "jh",
    "ঞ": "n",
    "ট": "t",
    "ঠ": "th",
    "ড": "d",
    "ঢ": "dh",
    "ণ": "n",
    "ত": "t",
    "থ": "th",
    "দ": "d",
    "ধ": "dh",
    "ন": "n",
    "প": "p",
    "ফ": "ph",
    "ব": "b",
    "ভ": "bh",
    "ম": "m",
    "য": "j",
    "র": "r",
    "ল": "l",
    "শ": "sh",
    "ষ": "sh",
    "স": "s",
    "হ": "h",
    "ড়": "r",
    "ঢ়": "rh",
    "য়": "y",
    "ৎ": "t",
    "ং": "ng",
    "ঃ": "h",
    "ঁ": "n",
    "া": "a",
    "ি": "i",
    "ী": "ee",
    "ু": "u",
    "ূ": "oo",
    "ৃ": "ri",
    "ে": "e",
    "ৈ": "oi",
    "ো": "o",
    "ৌ": "ou",
    "্": "",
    "০": "0",
    "১": "1",
    "২": "2",
    "৩": "3",
    "৪": "4",
    "৫": "5",
    "৬": "6",
    "৭": "7",
    "৮": "8",
    "৯": "9",
    "।": ".",
}


def normalize_bangla(text: str) -> str:
    """Normalizes Bangla/English/Banglish text while preserving Bangla combining marks."""
    if not text:
        return ""
    # 1. Unicode NFC canonicalization (unifies decomposed nuktas like ড+় -> ড়)
    out = unicodedata.normalize("NFC", text)
    # 2. Strip zero-width joiners/non-joiners and BOM
    out = _ZW_RE.sub("", out)
    # 3. Unify khanda-ta (ৎ) to ত্ for consistent lexical matching
    out = out.replace("ৎ", "ত্")
    # 4. Normalize Bangla digits to ASCII digits
    out = out.translate(_BN_DIGITS)
    # 5. Lowercase Latin characters and keep letters (L), combining marks (M), numbers (N), spaces
    cleaned_chars: list[str] = []
    for ch in out.lower():
        if ch.isspace():
            cleaned_chars.append(" ")
            continue
        cat = unicodedata.category(ch)
        if cat[0] in ("L", "M", "N"):
            cleaned_chars.append(ch)
        elif ch in ("-", "/", "+"):
            cleaned_chars.append(" ")
    return _WS_RE.sub(" ", "".join(cleaned_chars)).strip()


@dataclass(frozen=True)
class LanguageDetectionResult:
    language: DetectedLanguage
    confidence: float
    bn_char_ratio: float
    latin_char_ratio: float
    banglish_token_hits: int


def detect_language(text: str) -> LanguageDetectionResult:
    """Detects whether text is Bangla (bn), English (en), Banglish, or Mixed."""
    if not text or not text.strip():
        return LanguageDetectionResult("bn", 0.5, 0.0, 0.0, 0)

    bn_chars = 0
    latin_chars = 0
    for ch in text:
        code = ord(ch)
        if 0x0980 <= code <= 0x09FF:
            bn_chars += 1
        elif ("a" <= ch.lower() <= "z"):
            latin_chars += 1

    total_alpha = bn_chars + latin_chars
    if total_alpha == 0:
        return LanguageDetectionResult("bn", 0.5, 0.0, 0.0, 0)

    bn_ratio = bn_chars / total_alpha
    latin_ratio = latin_chars / total_alpha

    tokens = re.findall(r"[a-zA-Z]+", text.lower())
    banglish_hits = sum(1 for t in tokens if t in _BANGLISH_TOKENS)

    if bn_ratio >= 0.75:
        return LanguageDetectionResult(
            "bn",
            round(0.85 + 0.14 * bn_ratio, 3),
            round(bn_ratio, 3),
            round(latin_ratio, 3),
            banglish_hits,
        )
    if bn_ratio >= 0.15 and latin_ratio >= 0.15:
        return LanguageDetectionResult(
            "mixed", 0.9, round(bn_ratio, 3), round(latin_ratio, 3), banglish_hits
        )
    # Mostly Latin script: distinguish Banglish vs English
    if tokens and (banglish_hits >= 2 or (banglish_hits == 1 and len(tokens) <= 3)):
        conf = min(0.96, 0.72 + 0.08 * banglish_hits)
        return LanguageDetectionResult(
            "banglish", round(conf, 3), round(bn_ratio, 3), round(latin_ratio, 3), banglish_hits
        )
    return LanguageDetectionResult(
        "en",
        round(0.8 + 0.15 * latin_ratio, 3),
        round(bn_ratio, 3),
        round(latin_ratio, 3),
        banglish_hits,
    )


def transliterate_text(
    text: str,
    direction: Literal["auto", "banglish_to_bn", "bn_to_latin"] = "auto",
) -> tuple[str, str]:
    """Transliterates between Banglish (Latin) and Bangla script."""
    detected = detect_language(text)
    effective_dir = direction
    if direction == "auto":
        effective_dir = "bn_to_latin" if detected.language == "bn" else "banglish_to_bn"

    if effective_dir == "bn_to_latin":
        nfc = unicodedata.normalize("NFC", text)
        out = "".join(_BN_TO_LATIN.get(ch, ch) for ch in nfc)
        return _WS_RE.sub(" ", out).strip(), effective_dir

    # banglish_to_bn
    working = text.lower().strip()
    for phrase, bn_phrase in _BANGLISH_PHRASES:
        working = re.sub(rf"\b{re.escape(phrase)}\b", bn_phrase, working)
    tokens = working.split()
    mapped = [_BANGLISH_WORDS.get(tok.strip("?,!."), tok) for tok in tokens]
    return " ".join(mapped), effective_dir


def trigram_similarity(a: str, b: str) -> float:
    """Computes Jaccard similarity over 3-character sliding trigrams."""
    if not a or not b:
        return 0.0
    pa = f" {a} "
    pb = f" {b} "
    ta = {pa[i : i + 3] for i in range(max(0, len(pa) - 2))}
    tb = {pb[i : i + 3] for i in range(max(0, len(pb) - 2))}
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)
