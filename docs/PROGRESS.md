# Jonoshheba AI (জনসেবা AI) — Master Implementation Progress Checklist

**Last Updated:** 2026-11-20  
**Status Legend:** `☐` Pending · `◐` In Progress / Built with Verification Pending for External File · `☑` Complete & Verified

---

## Section 0 — Non-Negotiable Rules & Governance
- ☑ **0.1** Rules R1–R11 and Coverage Rules C1–C8 enforced across API, AI, Web, Mobile, Admin (`AGENTS.md`, `tests/authz-matrix.yaml`, `apps/api/test/f01-security-authz.test.ts`, `apps/api/test/f02-f04-f06-audit.test.ts`).
- ☑ **0.2** Decisions log maintained (`docs/DECISIONS.md`) and external raw dataset inventory documented (`docs/DATA_NEEDED.md`).

---

## Section 1 — Jono AI: Always Reply, Correctly and Kindly (Critical)
- ☑ **1.1** Never return 404 or dead sessions (`apps/api/src/modules/jono/jono.service.ts`, `apps/web/src/app/jono/page.tsx`, `packages/sdk/src/client.ts` — `jono-eval.test.ts`).
- ☑ **1.2** Conversational router (17 intents) & small talk with 4 suggestion chips (`apps/api/src/modules/jono/jono-intent-router.ts` — `jono-eval.test.ts`).
- ☑ **1.3** Multi-turn context (rolling summary + last 6 turns + follow-up rewriter) (`apps/api/src/modules/jono/jono.service.ts` — `citizen-acceptance-100.test.ts`).
- ☑ **1.4** Crisis, self-harm, domestic violence, child abuse & emergency safety (`apps/api/src/modules/jono/jono-crisis.ts` — `jono-eval.test.ts`).
- ☑ **1.5** Typed tools first (`get_service`, `search_services`, `rail_trains`, `rail_station`, `bus_routes`, `bus_operators`, `metro_fare`, `journeys_plan`, `org_directory`, `hotline_lookup`, `institution_lookup`, `programme_eligibility`, `notices`) (`apps/api/src/modules/jono/jono.service.ts` — `jono-eval.test.ts`).
- ☑ **1.6** Expanded knowledge base & hybrid retrieval with Bangla/English/Banglish synonyms (`apps/api/src/modules/jono/jono.service.ts` — `jono-eval.test.ts`).
- ☑ **1.7** No dead ends — low-confidence queries offer closest verified cards + 333 + clickable chips (`apps/api/src/modules/jono/jono.service.ts` — `jono-eval.test.ts`).
- ☑ **1.8** Answer quality & number grounding validator (`apps/api/src/modules/jono/jono-answer-validator.ts` — `jono-eval.test.ts`).
- ☑ **1.9** Chat UX polish & 300+ golden evaluation gate (`apps/web/src/app/jono/page.tsx`, `apps/api/test/jono-eval.test.ts`, `docs/JONO_EVAL.md`).

---

## Section 2 — Google-Style Search Suggestions (Autocomplete Everywhere)
- ☑ **2.1** Fast suggest endpoint `GET /api/v1/search/suggest?q=<prefix>&lang=bn|en&limit=8` (`p95 < 80 ms`, prefix + alias + transliteration + EIIN + train routes) (`apps/api/src/modules/catalogue/adapters/hybrid-rrf-search.adapter.ts` — `search-suggest.test.ts`).
- ☑ **2.2** Accessible ARIA 1.2 combobox UI (`SearchCombobox.tsx`) mounted on Home, Header, and Services (`apps/web/src/components/SearchCombobox.tsx` — `search-suggest.test.ts`).
- ☑ **2.3** Dedicated `/search?q=` results page + zero-result content-gap logger (`apps/web/src/app/search/page.tsx`, `apps/api/src/modules/catalogue/application/catalogue.service.ts` — `search-suggest.test.ts`).
- ☑ **2.4** 100-query search suggestion test suite (`apps/api/test/search-suggest.test.ts`).

---

## Section 3 — Ministries, Divisions, Departments & Officials ("প্রধানগণ")
- ☑ **3.1** Data model & API (`/api/v1/orgs`, `/api/v1/orgs/:id`, `/api/v1/orgs/:id/children`, `/api/v1/orgs/:id/services`, `/api/v1/hotlines`) with Rule C4 enforcement (`apps/api/src/modules/coverage/orgs-catalog-hotlines.service.ts` — `citizen-acceptance-100.test.ts`).
- ☑ **3.2** Ministries & Government Directory UI (`/ministries` & `/ministries/[id]`) with sector groups, `"প্রধানগণ"` table, GRS/RTI contacts, OSM attribution (`apps/web/src/app/ministries/page.tsx`, `apps/web/src/app/ministries/[id]/page.tsx`).
- ☑ **3.3** Dedicated `/hotlines` directory UI with instant filter, category pills, and deterministic situation helper (`apps/web/src/app/hotlines/page.tsx`).
- ◐ **3.4** Ministry officers importer & verification workflow (`scripts/ingest/orgs/import-ministries.ts`, `data/imports/ministries/README.md` — importer & C4 redaction built; full live officer snapshots marked `"যাচাই চলছে / Verification pending"` per `docs/DATA_NEEDED.md`).

---

## Section 4 — Transport: Real Nationwide Trains and Buses
- ◐ **4.1** Rail importer (`scripts/ingest/rail/import-rail-timetable.ts`, `data/imports/rail/README.md` — importer & 24 curated intercity trains active; full BR WTT PDF drop listed in `docs/DATA_NEEDED.md`).
- ☑ **4.2** Rail search & train detail page (`/transport` + `/transport/trains/[number]`) with default date = today, sort by departure/duration/fare, class filter, `+১ দিন / +1 day` overnight badge, off-day greying (`apps/web/src/app/transport/page.tsx`, `apps/web/src/app/transport/trains/[number]/page.tsx` — `citizen-acceptance-100.test.ts`).
- ☑ **4.3** Bus directory, operators, corridors & BRTA official fare estimator (`apps/api/src/modules/coverage/rail-mobility.service.ts` — `citizen-acceptance-100.test.ts`).
- ☑ **4.4** Nationwide 64-district transport coverage endpoint `GET /api/v1/bus/coverage` (`apps/api/src/modules/coverage/rail-mobility.controller.ts` — `citizen-acceptance-100.test.ts`).

---

## Section 5 — Education Hub: Every Institution with EIIN
- ☑ **5.1** Education data model & separate code types (`eiin`, `ugcId`, `nuCollegeCode`, `btebCode`, `boardCode`; UGC universities have `eiin: null`) (`apps/api/src/modules/education/education.service.ts` — `citizen-acceptance-100.test.ts`).
- ◐ **5.2** Education endpoints (`/api/v1/education/institutions`, `/institutions/:id`, `/universities`, `/boards`, `/stats`) & BANBEIS/UGC importer (`scripts/ingest/education/import-education.ts` — importer & verified seed active; full ~38k BANBEIS CSV drop marked `"যাচাই চলছে / Verification pending"` in `docs/DATA_NEEDED.md`).
- ☑ **5.3** Education Hub UI (`/education` & `/education/[id]`) with EIIN lookup, Universities tab, and 11 Education Boards tab (`apps/web/src/app/education/page.tsx`, `apps/web/src/app/education/[id]/page.tsx`).

---

## Section 6 — Data Accuracy & Honesty Fixes
- ☑ **6.1** Markdown links `[text](url)` rendered and sanitized in `SafeMarkdown` (`apps/web/src/components/UiStates.tsx`).
- ☑ **6.2** Zero English leaks on `/bn` pages and zero Bangla leaks on `/en` pages (`scripts/check-bn-latin.mjs`, `packages/shared/src/i18n/bn.json`).
- ☑ **6.3** Synthetic placeholder deadlines removed (`deadlineAt: null` → `"ঘোষণা অনুযায়ী / As announced"`) (`apps/api/src/modules/opportunities/adapters/seeded-opportunities.repository.ts`, `apps/web/src/app/scholarships/page.tsx`, `apps/web/src/app/jobs/page.tsx`).
- ☑ **6.4** e-Passport FAQ updated with sourced Feb 2025 police-verification policy (`apps/api/src/modules/catalogue/adapters/seeded-catalogue.repository.ts`).
- ☑ **6.5** Near Me places directory with ODbL attribution and facility counts (`apps/web/src/app/near-me/page.tsx`).
- ☑ **6.6** Hotlines verified against official sources with explicit provenance (`apps/api/src/modules/coverage/orgs-catalog-hotlines.service.ts`).

---

## Section 7 — Language & UX Polish
- ☑ **7.1** Bangla default, English peer (`বাং | EN` toggle keeps current route) (`apps/web/src/components/AppShell.tsx`).
- ☑ **7.2** Fluid hero typography `clamp(1.65rem, 3.2vw, 2.6rem)` with `line-height: 1.3` (`apps/web/src/app/page.tsx`).
- ☑ **7.3** Header navigation collapses cleanly below `xl` (`1280px`) into `"আরও / More"` drawer; brand uses `whitespace-nowrap` (`apps/web/src/components/AppShell.tsx`).
- ☑ **7.4** Service detail page `"আমার এলাকায় কোথায় যাব?"` district office resolver (`apps/web/src/app/services/[slug]/page.tsx`).
- ☑ **7.5** Unified inline SVG icons across navigation and cards (no raw emoji icons) (`apps/web/src/components/AppShell.tsx`, `apps/web/src/app/services/[slug]/page.tsx`, `apps/web/src/app/near-me/page.tsx`).

---

## Section 8 — Security & Reliability
- ☑ **8.1** AuthZ matrix & security tests (`tests/authz-matrix.yaml`, `apps/api/test/f01-security-authz.test.ts`).
- ☑ **8.2** Rate limits (`chat` 20/min per session/IP, `search` 60/min, `eligibility` 30/min, `auth-otp` 5/min) (`apps/api/src/common/rate-limit.middleware.ts`).
- ☑ **8.3** Importer security guardrails (domain allowlist `*.gov.bd`, max file size, malware/EICAR scan) (`apps/api/src/common/importer-security.ts`).
- ☑ **8.4** Backup/restore runbook & staging Caddy basic auth (`docs/runbooks/backup-restore.md`, `infra/staging/Caddyfile`).

---

## Section 9 — Admin Tools
- ☑ **9.1** Admin Portal (`apps/admin/src/app/page.tsx`): Import Studio (`parse → diff → review → publish`), Two-Person Review Queue, Coverage Heatmap, RAG Playground, and Zero-Result Search Report.

---

## Section 10 — Mobile App Parity
- ☑ **10.1** Expo Mobile Models & Shared SDK (`apps/mobile/src/screens/screen-models.ts`, `apps/mobile/src/mobile.test.ts`, `packages/sdk/src/client.ts`): Jono session auto-recovery, search autocomplete, ministries, education EIIN/UGC, near-me offline packs, and push notifications.

---

## Section 11 — Citizen Acceptance Test (100 Scenarios)
- ☑ **11.1** 100 real Bangladeshi citizen scenarios in Bangla, English, and Banglish (`apps/api/test/citizen-acceptance-100.test.ts` — 100/100 passing).

---

## Section 12 — Definition of Done & Final Report
- ☑ **12.1** Final report with metrics, test results, remaining external data gaps, and bilingual release notes (`docs/FINAL_REPORT.md`).
