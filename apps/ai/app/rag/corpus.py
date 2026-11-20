"""Structure-aware chunker and verified Bangladesh citizen-service seed corpus for RAG."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

TrustLabel = Literal[
    "OFFICIAL_SOURCE",
    "VERIFIED_BY_JONOSHHEBA",
    "PARTNER_PROVIDED",
    "COMMUNITY_REPORT",
    "UNAVAILABLE_STALE",
]


@dataclass(frozen=True)
class SourceDocument:
    doc_id: str
    title: str
    content: str
    source_url: str
    agency: str
    trust_label: TrustLabel
    last_verified_at: str
    locale: Literal["bn", "en"]
    category: str
    effective_from: str | None = None
    effective_to: str | None = None


@dataclass
class KnowledgeChunk:
    chunk_id: str
    doc_id: str
    title: str
    text: str
    content_hash: str
    source_url: str
    agency: str
    trust_label: TrustLabel
    last_verified_at: str
    locale: Literal["bn", "en"]
    category: str
    effective_from: str | None = None
    effective_to: str | None = None
    dense_vector: list[float] = field(default_factory=list)
    sparse_weights: dict[str, float] = field(default_factory=dict)

    def is_expired(self, now_utc: datetime | None = None) -> bool:
        if not self.effective_to:
            return False
        ref = now_utc or datetime.now(UTC)
        try:
            exp = datetime.fromisoformat(self.effective_to.replace("Z", "+00:00"))
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=UTC)
            return ref > exp
        except ValueError:
            return False


def chunk_document(
    doc: SourceDocument,
    target_words: int = 120,
    overlap_words: int = 24,
) -> list[KnowledgeChunk]:
    """Structure-aware chunker preserving Markdown headings, lists, and tables."""
    paragraphs = [p.strip() for p in doc.content.split("\n\n") if p.strip()]
    chunks: list[KnowledgeChunk] = []
    current_parts: list[str] = []
    current_words = 0

    def flush(idx: int) -> None:
        if not current_parts:
            return
        body = "\n\n".join(current_parts).strip()
        digest = hashlib.sha256(f"{doc.doc_id}:{body}".encode()).hexdigest()[:24]
        chunks.append(
            KnowledgeChunk(
                chunk_id=f"{doc.doc_id}#c{idx}",
                doc_id=doc.doc_id,
                title=doc.title,
                text=body,
                content_hash=digest,
                source_url=doc.source_url,
                agency=doc.agency,
                trust_label=doc.trust_label,
                last_verified_at=doc.last_verified_at,
                locale=doc.locale,
                category=doc.category,
                effective_from=doc.effective_from,
                effective_to=doc.effective_to,
            )
        )

    for para in paragraphs:
        words = para.split()
        is_table_or_list = para.startswith(("|", "-", "*", "1."))
        if current_words + len(words) > target_words and current_parts and not is_table_or_list:
            flush(len(chunks))
            # Retain trailing overlap words from previous chunk
            tail = " ".join(" ".join(current_parts).split()[-overlap_words:])
            current_parts = [tail, para] if tail else [para]
            current_words = len(" ".join(current_parts).split())
        else:
            current_parts.append(para)
            current_words += len(words)

    if current_parts:
        flush(len(chunks))
    return chunks


def get_seed_documents() -> list[SourceDocument]:
    """Verified Bangladesh public-service corpus used for RAG retrieval & evaluation."""
    return [
        SourceDocument(
            doc_id="doc-bdris-birth-reg",
            title="জন্ম নিবন্ধন আবেদন ও ফি (Birth Registration BDRIS)",
            content=(
                "অনলাইনে জন্ম নিবন্ধনের জন্য অফিসিয়াল পোর্টাল bdris.gov.bd ব্যবহার করতে হয়।\n\n"
                "সরকারি ফি:\n"
                "- শিশুর জন্মের ০ থেকে ৪৫ দিনের মধ্যে জন্ম নিবন্ধন সম্পূর্ণ বিনামূল্যে (০ টাকা)।\n"
                "- ৪৬ দিন থেকে ৫ বছর পর্যন্ত ফি ২৫ টাকা।\n"
                "- ৫ বছরের বেশি বয়সের ক্ষেত্রে ফি ৫০ টাকা।\n\n"
                "প্রয়োজনীয় কাগজপত্র: হাসপাতালের ছাড়পত্র বা টিকা কার্ড, পিতা-মাতার এনআইডি "
                "বা জন্ম নিবন্ধন সনদ এবং স্থায়ী ঠিকানার প্রমাণপত্র। ইউনিয়ন পরিষদ, পৌরসভা বা "
                "সিটি কর্পোরেশন অফিসে কাগজপত্র যাচাই করতে হয়।"
            ),
            source_url="https://bdris.gov.bd",
            agency="Office of the Registrar General, Birth & Death Registration (BDRIS)",
            trust_label="OFFICIAL_SOURCE",
            last_verified_at="2026-11-01T00:00:00Z",
            locale="bn",
            category="service",
        ),
        SourceDocument(
            doc_id="doc-epassport-bd",
            title="ই-পাসপোর্ট আবেদন প্রক্রিয়া ও ফি (Bangladesh e-Passport)",
            content=(
                "বাংলাদেশ ই-পাসপোর্ট অনলাইন আবেদন অফিসিয়াল ওয়েবসাইট epassport.gov.bd থেকে করতে হয়।\n\n"
                "৪৮ পৃষ্ঠার ৫ বছর মেয়াদি নিয়মিত (Regular) ই-পাসপোর্ট ফি ৪,০২৫ টাকা (ভ্যাটসহ), "
                "জরুরি (Express) ফি ৬,৩২৫ টাকা এবং অতি জরুরি (Super Express) ফি ৮,৬২৫ টাকা।\n\n"
                "আবেদনের জন্য জাতীয় পরিচয়পত্র (NID) অথবা ১৮ বছরের কম হলে অনলাইন জন্ম নিবন্ধন সনদ "
                "লাগে। অনলাইনে ফরম পূরণের পর নির্ধারিত আঞ্চলিক পাসপোর্ট অফিসে বায়োমেট্রিক দিতে হয়।"
            ),
            source_url="https://www.epassport.gov.bd",
            agency="Department of Immigration & Passports (DIP)",
            trust_label="OFFICIAL_SOURCE",
            last_verified_at="2026-11-01T00:00:00Z",
            locale="bn",
            category="service",
        ),
        SourceDocument(
            doc_id="doc-nid-services",
            title="জাতীয় পরিচয়পত্র (NID) সংশোধন ও রি-ইস্যু",
            content=(
                "জাতীয় পরিচয়পত্র (NID) নতুন নিবন্ধন, তথ্য সংশোধন বা হারানো কার্ড রি-ইস্যুর জন্য "
                "অফিশিয়াল পোর্টাল services.nidw.gov.bd ব্যবহার করতে হয়।\n\n"
                "সাধারণ রি-ইস্যু ফি ২৩০ টাকা এবং জরুরি রি-ইস্যু ফি ৩৪৫ টাকা (ভ্যাটসহ) যা অনুমোদিত "
                "মোবাইল ব্যাংকিং বা ব্যাংকের মাধ্যমে পরিশোধযোগ্য। হারানো কার্ডের ক্ষেত্রে নিকটস্থ "
                "থানার জিডি কপি আপলোড করতে হয়।"
            ),
            source_url="https://services.nidw.gov.bd",
            agency="Bangladesh Election Commission (NID Wing)",
            trust_label="OFFICIAL_SOURCE",
            last_verified_at="2026-11-01T00:00:00Z",
            locale="bn",
            category="service",
        ),
        SourceDocument(
            doc_id="doc-land-namjari",
            title="ই-নামজারি (Land Mutation) অনলাইন আবেদন",
            content=(
                "ভূমি ই-নামজারি (Land Mutation) আবেদন অফিসিয়াল land.gov.bd পোর্টালের মাধ্যমে করতে হয়।\n\n"
                "মোট সরকারি ফি ১,১৭০ টাকা (আবেদন ও কোর্ট ফি ৭০ টাকা + "
                "অনুমোদনের পর ডিসিআর ফি ১,১০০ টাকা)।\n\n"
                "প্রয়োজনীয় দলিল: মূল দলিলের কপি, সর্বশেষ খতিয়ান, ভূমি উন্নয়ন কর পরিশোধের দাখিলা "
                "এবং আবেদনকারীর জাতীয় পরিচয়পত্র। নিষ্পত্তির নির্ধারিত সময় সাধারণত ২৮ কার্যদিবস।"
            ),
            source_url="https://mutation.land.gov.bd",
            agency="Ministry of Land, Bangladesh",
            trust_label="OFFICIAL_SOURCE",
            last_verified_at="2026-11-01T00:00:00Z",
            locale="bn",
            category="service",
        ),
        SourceDocument(
            doc_id="doc-railway-eticket",
            title="বাংলাদেশ রেলওয়ে ই-টিকিট নির্দেশিকা (Bangladesh Railway e-Ticketing)",
            content=(
                "বাংলাদেশ রেলওয়ের অফিসিয়াল টিকিট শুধুমাত্র eticket.railway.gov.bd অথবা রেল সেবা "
                "অ্যাপ থেকে ক্রয় করা যায়। জনসেবা AI কোনো টিকিট বুক বা সিট সংরক্ষণ করে না; "
                "শুধুমাত্র সময়সূচি ও অফিশিয়াল চ্যানেলে যাওয়ার নির্দেশনা দেয়।\n\n"
                "যাত্রার তারিখ থেকে সর্বোচ্চ ১০ দিন পূর্বে অগ্রিম টিকিট ছাড়া হয়। একটি এনআইডি দিয়ে "
                "সর্বোচ্চ ৪টি আসন ক্রয় করা যায় এবং ভ্রমণের সময় এনআইডি বা জন্ম সনদের কপি সাথে রাখতে হয়।"
            ),
            source_url="https://eticket.railway.gov.bd",
            agency="Bangladesh Railway",
            trust_label="OFFICIAL_SOURCE",
            last_verified_at="2026-11-01T00:00:00Z",
            locale="bn",
            category="transport",
        ),
        SourceDocument(
            doc_id="doc-dss-old-age-allowance",
            title="বয়স্ক ভাতা কর্মসূচি (Old Age Allowance - DSS)",
            content=(
                "সমাজসেবা অধিদপ্তরের বয়স্ক ভাতা কর্মসূচিতে আবেদন করতে হলে পুরুষের বয়স ন্যূনতম "
                "৬৫ বছর এবং নারীর বয়স ন্যূনতম ৬২ বছর হতে হয়।\n\n"
                "প্রার্থীর বার্ষিক গড় আয় ১০,০০০ টাকার নিচে হতে হবে এবং সরকারি পেনশনভোগী হলে "
                "যোগ্য হিসেবে বিবেচিত হবেন না। মাসিক ভাতার পরিমাণ সরকারি প্রজ্ঞাপন অনুযায়ী "
                "মোবাইল ফিন্যান্সিয়াল সার্ভিসে (নগদ/বিকাশ) সরাসরি পাঠানো হয়। "
                "আবেদন অফিসিয়াল পোর্টাল mis.bhata.gov.bd এ করতে হয়।"
            ),
            source_url="https://mis.bhata.gov.bd",
            agency="Department of Social Services (DSS)",
            trust_label="OFFICIAL_SOURCE",
            last_verified_at="2026-11-01T00:00:00Z",
            locale="bn",
            category="benefit",
        ),
        SourceDocument(
            doc_id="doc-grs-complaint",
            title="অভিযোগ প্রতিকার ব্যবস্থা (GRS - Grievance Redress System)",
            content=(
                "সরকারি দপ্তরের সেবা না পাওয়া বা হয়রানির বিষয়ে নাগরিকরা কেন্দ্রীয় অভিযোগ প্রতিকার "
                "ব্যবস্থা grs.gov.bd এর মাধ্যমে অভিযোগ দাখিল করতে পারেন।\n\n"
                "অভিযোগ দাখিলের পর একটি ট্র্যাকিং নম্বর পাওয়া যায় যা দিয়ে অফিশিয়াল পোর্টালে "
                "অগ্রগতি দেখা যায়। জনসেবা AI অভিযোগের খসড়া তৈরি করতে সহায়তা করে, তবে চূড়ান্ত "
                "দাখিল নাগরিককে নিজেই অফিসিয়াল GRS পোর্টালে সম্পন্ন করতে হয়।"
            ),
            source_url="https://www.grs.gov.bd",
            agency="Cabinet Division (GRS)",
            trust_label="OFFICIAL_SOURCE",
            last_verified_at="2026-11-01T00:00:00Z",
            locale="bn",
            category="complaint",
        ),
        SourceDocument(
            doc_id="doc-emergency-hotlines",
            title="বাংলাদেশের জরুরি হটলাইন নম্বরসমূহ (Emergency Hotlines Bangladesh)",
            content=(
                "তাৎক্ষণিক বিপদে নিচের অফিসিয়াল সরকারি হটলাইনগুলোতে বিনামূল্যে কল করুন:\n"
                "- 999: জাতীয় জরুরি সেবা (পুলিশ, ফায়ার সার্ভিস, অ্যাম্বুলেন্স)।\n"
                "- 333: সরকারি তথ্য ও সেবা হটলাইন।\n"
                "- 16263: স্বাস্থ্য বাতায়ন (২৪/৭ সরকারি স্বাস্থ্য পরামর্শ)।\n"
                "- 109: নারী ও শিশু নির্যাতন প্রতিরোধ ন্যাশনাল হেল্পলাইন।\n"
                "- 1098: শিশু সহায়তা হেল্পলাইন।\n"
                "- 106: দুর্নীতি দমন কমিশন (দুদক) হটলাইন।"
            ),
            source_url="https://nhd.gov.bd",
            agency="Bangladesh Police / ICT Division / DGHS",
            trust_label="OFFICIAL_SOURCE",
            last_verified_at="2026-11-01T00:00:00Z",
            locale="bn",
            category="emergency",
        ),
        SourceDocument(
            doc_id="doc-pmeat-scholarship",
            title="শিক্ষা সহায়তা ট্রাস্ট উপবৃত্তি (PMEAT Stipend & Scholarship)",
            content=(
                "প্রধানমন্ত্রীর শিক্ষা সহায়তা ট্রাস্ট (pmeat.gov.bd) থেকে স্নাতক ও সমমান পর্যায়ে "
                "দরিদ্র ও মেধাবী শিক্ষার্থীদের উপবৃত্তি এবং ভর্তি সহায়তা প্রদান করা হয়।\n\n"
                "আবেদনের জন্য শিক্ষাপ্রতিষ্ঠানের প্রত্যয়নপত্র, শিক্ষার্থীর জন্ম নিবন্ধন বা এনআইডি, "
                "এবং অভিভাবকের আয়ের সনদ প্রয়োজন হয়।"
            ),
            source_url="https://www.pmeat.gov.bd",
            agency="Prime Minister's Education Assistance Trust (PMEAT)",
            trust_label="OFFICIAL_SOURCE",
            last_verified_at="2026-11-01T00:00:00Z",
            locale="bn",
            category="scholarship",
        ),
        SourceDocument(
            doc_id="doc-utility-payments",
            title="বিদ্যুৎ, গ্যাস ও পানি বিল পরিশোধের অফিসিয়াল চ্যানেল",
            content=(
                "ঢাকা ও সারাদেশের ইউটিলিটি বিল শুধুমাত্র অনুমোদিত অফিসিয়াল চ্যানেলে পরিশোধ করুন:\n"
                "- বিদ্যুৎ: DESCO (desco.gov.bd), DPDC (dpdc.gov.bd), BREB (reb.gov.bd)।\n"
                "- গ্যাস: Titas Gas (titasgas.org.bd)।\n"
                "- পানি: Dhaka WASA (dwasa.org.bd)।\n"
                "কখনও অচেনা লিংকে পিন বা ওটিপি শেয়ার করবেন না।"
            ),
            source_url="https://powerdivision.gov.bd",
            agency="Power Division / Petrobangla / WASA",
            trust_label="OFFICIAL_SOURCE",
            last_verified_at="2026-11-01T00:00:00Z",
            locale="bn",
            category="utility",
        ),
        SourceDocument(
            doc_id="doc-stale-covid-grant-2023",
            title="পুরনো ২০২৩ সালের বিশেষ অনুদান বিজ্ঞপ্তি (Expired Circular)",
            content=(
                "২০২৩ সালের বিশেষ আর্থিক সহায়তা কর্মসূচির আবেদন ৩১ ডিসেম্বর ২০২৩ তারিখে "
                "শেষ হয়েছে। নতুন কোনো প্রজ্ঞাপন প্রকাশিত হয়নি।"
            ),
            source_url="https://mof.gov.bd/archive/2023-grant",
            agency="Ministry of Finance (Archived)",
            trust_label="OFFICIAL_SOURCE",
            last_verified_at="2023-12-01T00:00:00Z",
            locale="bn",
            category="benefit",
            effective_from="2023-01-01T00:00:00Z",
            effective_to="2023-12-31T23:59:59Z",
        ),
    ]
