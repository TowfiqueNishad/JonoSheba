# Jonoshheba API Conventions (`/api/v1`)

All public API endpoints live under `/api/v1` (with `/health` and `/ready` also available at root for orchestrator probes).

- **Specification:** OpenAPI 3.1 served at `/api/docs` in development; exported to `apps/api/openapi.json` to regenerate `packages/sdk` (`pnpm sdk:generate`).
- **Errors:** RFC 9457 `application/problem+json` with `type`, `title`, `status`, `detail`, `instance`, `requestId`.
- **Pagination:** Cursor-based (`?cursor=&limit=`).
- **Localization:** `Accept-Language: bn|en` (defaults to `bn`). All timestamps stored in UTC and formatted in `Asia/Dhaka` on clients.
- **Idempotency:** All resource-creating `POST` endpoints accept `Idempotency-Key`.
- **Bandwidth efficiency:** Support `?fields=` projection, `ETag` / `If-None-Match`, and gzip/brotli compression.
- **Trust & Honesty (R1, R5, R6):** Every citizen-facing fact includes `trustLabel`, `sourceUrl`, `agency`, and `lastVerifiedAt`. Transport options strictly obey `AvailabilityState`.
