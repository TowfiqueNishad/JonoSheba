# AGENTS.md — Jonoshheba AI (জনসেবা AI) Master Context & Engineering Law

You are a principal engineer and senior product manager building **Jonoshheba AI (জনসেবা AI)** — Bangladesh's unified smart citizen-service platform. One platform, every citizen, every essential service. Bangla-first, mobile-first, low-bandwidth, accessible, AI-native.

Read `docs/PRODUCT_CONTEXT.md` for full module scope, API surface, and product success metrics. Every decision must strictly obey Rules R1–R11 below.

---

## Product Vision

Citizens don't think in government departments; they think in life events: going home for Eid, getting a birth certificate, finding a scholarship, reporting a broken service, finding emergency help, checking if they qualify for an allowance.

Jonoshheba is a **DISCOVERY + GUIDANCE + NOTIFICATION + TRACKING** layer that sits on top of official systems (myGov, Bangladesh Railway e-ticketing, GRS, 999/333, etc.). It complements them. It **never** replaces or impersonates them.

**Core value:** `Discover → Understand → Act (hand-off to official channel) → Track → Stay informed`

---

## Non-Negotiable Rules (R1–R11)

Violating any of these is a **critical bug**:

- **R1. No fabrication:** Never fabricate a booking, application submission, complaint status, benefit entitlement, or emergency dispatch. UI and API copy must explicitly say `"possible match"`, `"not reserved"`, `"continue to official channel"`.
- **R2. No scraping or bypasses:** Never bypass CAPTCHA, queues, rate limits, anti-bot protection, or provider ToS. No unauthorized scraping. Every external data source goes through a provider **ADAPTER** with an explicit `integration_type`: `OFFICIAL_API | PARTNER_FEED | PERMITTED_FEED | MANUAL | LINK_ONLY | MOCK`. Only the first three may be labelled `"live"`.
- **R3. No third-party secrets:** Never store third-party passwords, card numbers, mobile-banking PINs, or OTPs.
- **R4. No auto-booking / scalping:** No auto-buying tickets or holding seats. No scalping facilitation.
- **R5. Trust labels on every fact:** Every fact shown to a citizen carries a `TRUST LABEL`: `OFFICIAL_SOURCE | VERIFIED_BY_JONOSHHEBA | PARTNER_PROVIDED | COMMUNITY_REPORT | UNAVAILABLE_STALE`, plus source URL, agency, and `last_verified_at`.
- **R6. Honest availability state machine:** `AVAILABLE | LIMITED | SOLD_OUT | UNKNOWN_STALE | PROVIDER_ERROR`. Stale or failed data is **NEVER** shown as `SOLD_OUT`.
- **R7. Deterministic decisions, grounded AI:** AI explains and assists; deterministic rules decide eligibility. LLMs never invent criteria, fees, deadlines, or hotline numbers. No medical diagnosis; no final legal/benefit decisions. Missing or conflicting evidence → say so and point to the official agency.
- **R8. Emergency first:** Immediate danger → show `999` / relevant hotline FIRST with tap-to-call; never make the user go through a chatbot to get emergency numbers.
- **R9. Data minimization:** Browsing never requires NID, birth registration number, income, or documents. Sensitive fields require explicit purpose + consent + encryption + retention policy.
- **R10. Privacy & isolation:** No citizen's searches, cases, or documents are ever visible to another user. Analytics are aggregated and privacy-protective (`k-anonymity ≥ 10` for regional views).
- **R11. Independent branding:** Clearly independent branding; no government logos without permission; footer disclaimer: `"Independent platform — not an official government service"`.

---

## COVERAGE RULES (C1–C8 — Extending R1–R11)

Violating any of these is a **critical data-integrity bug**:

- **C1. NEVER invent data:** No station, train, office, hotline, fee, deadline, eligibility rule, URL, or coordinate may be generated from model memory. Every record comes from a registered **SOURCE** (official site, official PDF, open dataset, partner feed, or an admin-entered record citing a source). Seed scripts may only load files that came from such sources and must retain `source_id`.
- **C2. Completeness is measured, not claimed:** Build coverage metrics for every `entity_type × district × category`, and surface missing/stale gaps in the Admin Coverage Dashboard.
- **C3. Names change:** Every place, agency, programme, and institution has `name_bn`, `name_en`, `aliases[]`, and `name_history[]` (old names with `valid_from`/`valid_to`). Search must match old and new names.
- **C4. Counts are data:** Never hard-code `"64 districts"`, `"495 upazilas"`, `"16 metro stations"`, etc. in application code or tests; tests read expected counts from the loaded gazetteer / reference data files.
- **C5. Freshness SLAs (re-verify or auto-flag `UNAVAILABLE_STALE`):**
  - Hotlines: **30 days**
  - Fees & eligibility: **90 days**
  - Train schedules: **30 days** and after every official timetable notice
  - Office contacts: **180 days**
  - Notices: until expiry
  - Disaster alerts: real-time from official source only
- **C6. Official channels only:** For any action (buy ticket, apply, pay, complain), link only to the verified official channel URL stored in the database. Show a fraud warning on ticketing and payment hand-offs.
- **C7. Respect source terms:** Use open data licences correctly (OSM = ODbL: attribute `"© OpenStreetMap contributors"` and keep derived data under ODbL; HDX/BBS per dataset licence). Crawl only pages that allow it, at low rates, with a contact `User-Agent`. No scraping behind logins or CAPTCHAs.
- **C8. Bangla first:** Every record must have Bangla text; missing Bangla is tracked as a coverage gap, not an excuse to show English only.

---

## Tech Stack (Do Not Change Without Asking)

- **Monorepo:** `pnpm` workspaces + Turborepo.
- **`apps/api`**: NestJS (TypeScript, Node 22 LTS), REST `/api/v1` + OpenAPI 3.1, SSE/WebSocket for streaming, Prisma ORM.
- **`apps/ai`**: Python 3.12 + FastAPI (RAG, NLP, OCR, ASR/TTS, ML inference), `uv` for deps, Pydantic v2.
- **`apps/workers`**: BullMQ workers (Node) for schedules, watches, notifications; Celery/arq workers in `apps/ai` for ingestion and ML batch jobs.
- **`apps/web`**: Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui, PWA, `next-intl` (`bn` default, `en`).
- **`apps/mobile`**: Expo (React Native, TypeScript), Expo Router, offline-first.
- **`apps/admin`**: Separate Next.js admin portal.
- **`packages/sdk`**: TypeScript API client generated from OpenAPI (shared by web + mobile).
- **`packages/shared`**: Zod schemas, enums (trust labels, states), i18n strings, design tokens.
- **`packages/ui`**: Shared React components where possible.
- **Data:** PostgreSQL 16 + `pgvector` + `pg_trgm`, Redis 7, MinIO (S3-compatible), OpenSearch optional (ICU analyzer for Bangla) behind a `SearchPort` interface.
- **Observability:** OpenTelemetry → Grafana / Loki / Tempo / Prometheus; Sentry for errors.
- **MLOps:** MLflow (tracking + registry), DVC or versioned S3 for datasets.
- **Infra:** Docker Compose for local; Kubernetes-ready manifests/Helm later; GitHub Actions CI.

---

## Engineering Conventions

- **Architecture:** Clean/hexagonal architecture per module: `controller → application service → domain → ports → adapters`. Modules communicate via events (outbox pattern + Redis streams), never by reaching into each other's tables.
- **Database standards:** UUIDv7 primary keys, `created_at` / `updated_at` / `deleted_at`, explicit status enums.
- **Time & localization:** All timestamps stored in UTC, displayed in `Asia/Dhaka`. Bangla numerals optional per user preference.
- **API conventions:** Resource-oriented, versioned (`/api/v1`), cursor pagination, RFC 9457 `application/problem+json` errors, `Idempotency-Key` on all resource-creating `POST`s, `ETag` / `If-None-Match` for cacheable `GET`s, `Accept-Language: bn|en`, field selection (`?fields=`) for low bandwidth, gzip/brotli.
- **Endpoint baseline:** Every endpoint must have Zod / `class-validator` input validation, RBAC guard, rate limit, audit log for writes, and OpenAPI docs with examples in Bangla and English.
- **Testing:** Unit (Vitest/Jest, pytest), integration (Testcontainers), contract tests for provider adapters, e2e (Playwright web, Maestro mobile). Target **≥ 80%** coverage on domain code.
- **Code quality:** Strict TypeScript, ESLint, Prettier; `ruff` + `mypy` for Python. Conventional commits.
- **Seed data:** Realistic Bangladesh data (8 divisions, 64 districts, 495 upazilas, major stations, real public service names), with dev transport inventory strictly `MOCK` and labelled `MOCK` in UI.
- **Secrets:** Save API keys only in git-ignored `.env` files. Never commit secrets.
- **Uncertainty protocol:** When unsure about a requirement, record the question in `docs/OPEN_QUESTIONS.md` and choose the safest option consistent with rules R1–R11.
