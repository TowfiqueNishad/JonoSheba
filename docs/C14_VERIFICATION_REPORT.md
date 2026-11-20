# PROMPT C14 — Bangladesh Full-Coverage QA & PM Verification Report

*Generated: 2026-11-20 (Asia/Dhaka) • Rules Audited: R1–R11 + Coverage Rules C1–C8*

---

## 1. Coverage Report (Loaded Counts vs. Reference Data — Rule C2 & C4)

All reference counts are loaded dynamically from `data/coverage/reference-counts.json` (never hard-coded in logic or tests).

| Entity Type | Loaded Now | Reference Target (Nov 2026) | Status & Gap Path |
| --- | ---: | ---: | --- |
| Divisions | 8 | 8 | Complete (`SRC_HDX_COD_AB_BGD`) |
| Districts | 64 | 64 | Complete w/ real BBS codes, centroids & 2018 spelling aliases |
| Upazilas | 495 | 495 baseline / 500 May 2026 | Complete baseline; May 2026 NICAR +5 tracked in `/api/v1/geo/changelog` |
| Unions / Wards / Thanas / Postcodes | 64 each (district anchors) | ~4,571 unions / ~640 thanas | Open Gap queued (`gap-geo-unions-hdx`) → run `scripts/ingest/geo/ingest-hdx-cod-ab.ts` |
| Bangladesh Railway Stations | 17 verified seed stations | ~483 stations | Open Gap queued (`gap-rail-stations-full`) → upload East/West Zone PDFs via Import Studio |
| Dhaka Metro MRT-6 Operational Stations | 16 operational (+1 Kamalapur ext.) | 16 operational | Complete (`SRC_DMTCL_OFFICIAL`) |
| Service Taxonomy Categories | 18 | 18 | Complete (`data/coverage/taxonomy-18.json`) |
| Citizen Life-Event Bundles | 42 | ≥ 40 | Complete (`data/coverage/taxonomy-18.json`) |
| Social Protection Programmes | 6 detailed (incl. Family Card 2026) | 90 (FY2026-27) | Remaining 84 programmes importable via `/api/v1/admin/import/csv` from Finance Division budget PDF |
| Verified National & Utility Hotlines | 18 | 18 core short codes | Complete (all `verifyBeforeRelease: true`, 30-day SLA enforced) |

---

## 2. Audit Results Summary (All 5 C14 Checks)

| Audit | Scope | Result | Notes |
| --- | --- | --- | --- |
| **1. Coverage Report** | Dynamic comparison vs `reference-counts.json` | **PASS** | Gaps honestly surfaced in `/api/v1/admin/coverage/gaps`; never claimed 100% where data awaits PDF/HDX upload (C2). |
| **2. Record Integrity & Freshness** | `sourceId`, `lastVerifiedAt`, Bangla text (C8), BD bounding box `[20.5..26.7, 88.0..92.7]`, phone format, 30d/90d/180d SLAs (C5) | **PASS (0 issues)** | Verified by `CoverageOpsService.runQualityAudit()` & `evaluateFreshness()` unit tests. |
| **3. Search & Name History** | Bangla, English, Banglish, 2018 old spellings (`Chittagong`, `Comilla`, `Jessore`, `Bogra`, `Barisal`, `Kamalapur`, `Bangabandhu Bridge`), Sylheti/Chatgaiya dialects | **PASS** | Matches canonical + old names (`name_history`) across Geo, Rail, Tolls, Orgs & C11 National RAG. |
| **4. Rail Timetable & Honesty** | Any-stop-to-any-stop (`BMB→CML`, `DA→JSR`), `Asia/Dhaka` off-day check (`702` Mon), zero stale `SOLD_OUT` | **PASS** | Every rail result sets `notReserved: true`, `UNKNOWN_STALE` when no live official API, and attaches Rule C6 fraud warning. |
| **5. Safety & Licensing (C1–C8)** | Official channels only (C6), fraud warning on ticketing/payment, OSM ODbL attribution (C7), deterministic hotline helper (C10), zero hard-coded counts in coverage engine (C4) | **PASS** | `© OpenStreetMap contributors (ODbL)` visible in API responses & Web UI; Import Studio enforces `PENDING_REVIEW`. |

---

## 3. Issues Found & Fixed During C14 Audit

| Issue | Severity | File / Record | Fix Applied |
| --- | --- | --- | --- |
| Part 2 `GeoGazetteerService` initially referenced old `BD_GEOGRAPHY` symbol instead of real `DIVISIONS_SEED` / `DISTRICTS_SEED` with real BBS codes & centroids | High | `apps/api/src/modules/coverage/geo.service.ts` | Switched to `DIVISIONS_SEED` + `DISTRICTS_SEED` using real BBS codes and coordinates across all 64 districts. |
| `apps/mobile/src/offline/store.ts` had non-type `TrustLabel` import warning | Low | `apps/mobile/src/offline/store.ts` | Converted to `import type { TrustLabel }` (0 ESLint warnings monorepo-wide). |
| Missing `OFFICIAL_HANDOFF_FRAUD_WARNING` & `OSM_ODBL_ATTRIBUTION` on Web Transport page | High | `apps/web/src/app/transport/page.tsx` | Added visible Rule C6 fraud warning banner and Rule C7 ODbL attribution footer. |
