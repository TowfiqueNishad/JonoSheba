# Changelog — Jonoshheba AI

All notable developer changes follow Conventional Commits and `AGENTS.md` Rules R1–R11 & C1–C8.

## [0.2.0] — 2026-11-20 (Part 3 Audit Remediation: F01–F09)

### Security (F01)
- Added global default-deny `GlobalAdminGuard` across `/api/v1/admin/**` requiring valid non-revoked JWT, explicit `@Roles(...)`, eligible staff role, and `mfaVerified: true`; extended `AuditLogInterceptor` to audit admin `GET` reads.
- Eliminated chat session IDOR: `UUIDv7` session IDs, HMAC-signed `X-Session-Token` for guest sessions, 30-day guest retention, `DELETE /api/v1/assistant/sessions/:sessionId`, and consistent `404` on non-owner access.
- Added `WebhookSecurityGuard` (IP allowlist, 5-minute timestamp replay window, per-provider HMAC-SHA256, message-ID idempotency, per-sender rate limits) on `/channels/sms/inbound`, `/channels/ussd`, `/channels/ivr`, `/webhooks/sms/:provider/dlr`; gated `/channels/assisted/sessions*` to `org_member` / `platform_admin`.
- Added strict Next.js middleware security headers + per-request CSP nonces + `poweredByHeader: false` in `apps/web` and `apps/admin`.
- Added `GlobalRateLimitMiddleware` emitting IETF `RateLimit-*` headers and bilingual RFC 9457 `429` responses with `Retry-After`; enforced explicit CORS allowlist rejecting `*` with credentials.
- Added OpenAPI-driven `tests/authz-matrix.yaml` and `apps/api/test/f01-security-authz.test.ts`.

### Bilingual & Localization (F02)
- Expanded `packages/shared/src/i18n/{bn,en}.json` (218 keys, CI parity check `scripts/check-i18n.mjs`) and added `formatDigits`, `formatBdt`, `formatDuration`, `formatDhakaTime`, `formatDhakaDate`, `getSeatClassLabel`.
- Added `LocaleMiddleware`, `LocaleProjectionInterceptor`, locale-aware `ETag`, and localized RFC 9457 errors (`Content-Language`, `Vary: Accept-Language`).
- Implemented `/bn` and `/en` locale routing in `apps/web/src/middleware.ts`, `LocaleProvider`, 44 px `"বাংলা | English"` switcher, and mobile locale toggle helper.

### API Contract, Validation & Data Honesty (F03–F04)
- Enforced strict 400/404/422 validation (zero silent defaults) on `/geo/resolve`, `/metro/fare`, `/rail/trains`, `/services`, `/search`.
- Added canonical `/api/v1/assistant/*`, `/api/v1/programmes/:slug`, `/api/v1/ready`, `/api/v1/openapi.json`, `/api/v1/stats`, and `Deprecation`/`Sunset`/`Link` headers on `/api/v1/programs*` and `/api/v1/chat/*`; updated `packages/sdk`.
- Attached lightweight `sources[]` to service list items; separated `importedAt` from recorded `lastVerifiedAt`; unified verified hotline counts across `/hotlines`, `/stats`, and `/admin/overview`; hid `isDemo` records by default; added `nameHistory` for `Jamuna Bridge East` (`BBSE`).

### Frontend, Jono Chat, Accessibility, SEO & QA Gate (F05–F09)
- Removed all internal codes and hard-coded counts from citizen UI with CI enforcement.
- Built missing pages (`/services/[slug]`, `/life-events`, `/life-events/[slug]`, `/programmes/[slug]`, `/scholarships`, `/jobs`, `/notices`, `/calendar`, `/near-me`, `/account`, `/about`, `/privacy`, `/terms`, `/contact`, `/accessibility`, `/offline`, `not-found.tsx`, `error.tsx`) and true zero-JS `< 6 KB` `/lite` & `/lite/services/[slug]` Route Handlers.
- Fixed RAG truncation and citation pruning in `apps/ai/app/rag/pipeline.py` and `apps/api/src/modules/jono/jono.service.ts`; verified with 50 bilingual chat test cases (`0` truncations, citation precision `1.00`).
- Added WCAG 2.2 AA navigation, focus rings, skip link, labels, `aria-live`, reduced-motion support, `docs/accessibility.md`, favicons/OG/sitemap/robots/JSON-LD, bilingual offline SW, `infra/staging/Caddyfile`, and `scripts/qa-release-gate.mjs`.
