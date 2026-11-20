# Jonoshheba AI (জনসেবা AI) — Product Context

*Derived from the Jonoshheba AI Full Project Blueprint (Nov 2026).*

---

## 1. Product Vision

**Jonoshheba AI (জনসেবা AI)** is Bangladesh's unified smart citizen-service platform — Bangla-first, mobile-first, low-bandwidth, accessible, and AI-native.

Citizens do not think in government departments; they think in **life events**:
- Going home for Eid
- Registering a new baby / getting a birth certificate
- Finding a scholarship or job circular
- Reporting a broken service
- Finding emergency help immediately
- Checking eligibility for a government benefit or allowance

Jonoshheba is a **Discovery + Guidance + Notification + Tracking** layer sitting on top of official systems (myGov, Bangladesh Railway e-ticketing, GRS, 999/333, etc.). It complements official systems and never replaces or impersonates them.

**Core citizen journey:**
`Discover → Understand → Act (hand-off to official channel) → Track → Stay informed`

---

## 2. The 12 Bounded-Context Modules

Each module is an independently deployable bounded context behind a shared account, search, notification center, and audit system:

1. **Smart Transportation Hub** — train + bus search, compare, official hand-off.
2. **Ticket Availability & Alert Engine** — watches on sold-out journeys (honest availability states, fan-in polling, no auto-buy).
3. **Government Service Directory** — organized by life event and category, verified sources and trust labels.
4. **Government Benefits & Financial Assistance** — adaptive eligibility wizard backed by deterministic JSON-Logic rules engine.
5. **Citizen Complaint & Grievance Guidance** — AI-assisted drafting, GRS hand-off, external reference tracking.
6. **Emergency Assistance Center** — verified hotlines with immediate tap-to-call (offline-ready), nearby facilities, disaster notices.
7. **Healthcare & Public Health Services** — facility directory + official notices (**no medical diagnosis**).
8. **Education & Scholarship Center** — verified scholarships, deadlines, checklists.
9. **Government Jobs & Public Opportunities** — verified job circulars, PDF extraction with human-in-the-loop review, Deadline Radar.
10. **Utility & Public Service Center** — outage notices, verified payment links, office locator.
11. **Jonoshheba AI Assistant "Jono" (জনো)** — grounded Bangla/English RAG chatbot, voice (ASR/TTS), multimodal OCR, safe draft-only tool calls.
12. **Intelligence Dashboard** — privacy-safe ops and regional analytics (`k-anonymity ≥ 10`) for staff and authorized partners.

---

## 3. Non-Negotiable Rules Summary (R1–R11)

See `AGENTS.md` for canonical enforcement wording:
- **R1:** Never fabricate bookings, submissions, complaint statuses, entitlements, or emergency dispatches.
- **R2:** No CAPTCHA/queue/rate-limit/ToS bypasses or unauthorized scraping; explicit adapter `integration_type`; only `OFFICIAL_API | PARTNER_FEED | PERMITTED_FEED` labelled "live".
- **R3:** Never store third-party passwords, card numbers, mobile-banking PINs, or OTPs.
- **R4:** No auto-buying tickets, holding seats, or facilitating scalping.
- **R5:** Every citizen-facing fact carries a `TrustLabel`, source URL, agency, and `last_verified_at`.
- **R6:** Availability state machine (`AVAILABLE | LIMITED | SOLD_OUT | UNKNOWN_STALE | PROVIDER_ERROR`); stale/failed data is never shown as `SOLD_OUT`.
- **R7:** Deterministic rules decide eligibility; AI only explains/assists; never invent fees/deadlines/hotlines; no medical diagnosis or legal/benefit determinations.
- **R8:** Immediate danger → show `999` / relevant hotline first with tap-to-call; never gate behind a chatbot.
- **R9:** Data minimization: browsing requires no sensitive IDs/documents; sensitive fields require purpose + consent + encryption + retention.
- **R10:** Strict per-user isolation; aggregated analytics with `k-anonymity ≥ 10`.
- **R11:** Independent branding and disclaimer (`"Independent platform — not an official government service"`).

---

## 4. Complete API Surface Reference (`/api/v1`)

Errors use RFC 9457 (`application/problem+json`). Lists use cursor pagination. Locale via `Accept-Language: bn|en`.

```text
AUTH        POST /auth/otp/request · /auth/otp/verify · /auth/register · /auth/login
            · /auth/refresh · /auth/logout · /auth/password/forgot · /auth/password/reset
            · /auth/oauth/:provider · /auth/mfa/{setup,verify} · GET /.well-known/jwks.json
ME          GET/PATCH /me · /me/preferences · /me/profile-hints · /me/consents
            · /me/sessions · /me/devices · /me/saved · /me/reminders · /me/checklists
            · /me/deadlines(.ics) · /me/activity · POST /me/data-export · /me/delete
CATALOGUE   /categories · /life-events(/:slug) · /services(/:slug)(/versions) · /agencies
            · /notices · /facilities · /utilities/outages · /faqs · POST /content-reports
SEARCH      /search · /search/suggest
TRANSPORT   /transport/stops · POST /transport/search · /transport/providers(/health)
WATCHES     POST/GET /ticket-watches · GET/PATCH /ticket-watches/:id · POST /:id/complete
NOTIFY      /notifications · /notifications/stream (SSE) · /notifications/:id/read
            · /notifications/read-all · /notifications/:id/feedback · /notifications/test
            · /me/notification-preferences · /webhooks/sms/:provider/dlr
OPPORTUNITY /programs · /scholarships · /jobs · POST /eligibility/wizard/next
            · POST /eligibility/evaluate
CASES       POST /cases/draft · GET/PATCH /cases/:id · POST /cases/:id/handoff
            · /cases/:id/external-reference · /cases/:id/updates · /support/tickets
EMERGENCY   /emergency · /emergency/nearby · /emergency/alerts
ASSISTANT   /assistant/conversations(/:id)(/messages) (SSE) · /assistant/messages/:id/feedback
            · WS /assistant/voice · POST /assistant/upload (doc/photo → OCR explain)
SPEECH      POST /speech/transcribe · /speech/synthesize (proxied)
DOCUMENTS   POST /documents/upload-url · POST /documents/:id/readiness-check · DELETE /documents/:id
CHANNELS    POST /channels/sms/inbound · /channels/ussd · /channels/ivr (stubs)
ADMIN       /admin/{services,notices,programs,scholarships,jobs,hotlines,sources,kb,
            rules,reviews,reports,users,roles,orgs,providers,flags,analytics,
            audit-logs,ml/labels,ml/models,eval-runs,support}
SYSTEM      /health · /ready · /metrics · /status
```

---

## 5. Product Success Metrics (Prometheus Instrumented)

| Area | Metric | Target for MVP Demo |
|---|---|---|
| Discovery | Successful official-referral rate | ≥ 40% of service-page visits |
| Transport | Confirmed alert precision | ≥ 95% |
| Transport | Median detection → notification time | < 60 s |
| Notifications | Delivery success / opt-out rate | ≥ 98% / < 3% monthly |
| AI | Grounded answer rate / citation accuracy | ≥ 90% / ≥ 90% |
| Content | Active services with current verified source | ≥ 95% |
| Accessibility | Task completion on low-end mobile, 3G | ≥ 85% |
| Support | Time to first platform response | < 24 h |

---

## 6. Build Order & MVP Cut

**Full sequence (00 → 18):**
foundation (01) → data model (02) → identity (03) → catalogue & search (04) → transport & watches (05) → notifications (06) → opportunities & rules (07) → complaints, emergency, health & utilities (08) → AI service (09) → RAG (10) → Jono chatbot (11) → ML & MLOps (12) → admin portal (13) → web PWA (14) → mobile app (15) → low-connectivity channels (16) → security/perf/deployment hardening (17) → country packs (18).

**Recommended MVP cut:**
`00 → 06, 09 → 11, 14, 17` (60 real services, MOCK + LinkOnly transport adapters, push + email, RAG over ~50 curated official docs, Jono with read-only tools + watch drafts, emergency center, GRS hand-off). Add `07, 08, 12, 13, 15, 16, 18` post-demo.
