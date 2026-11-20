# Jonoshheba AI — Staging Deployment Runbook

## Purpose
Never use anonymous temporary tunnels (`trycloudflare.com`, `localhost.run`) for shared QA or stakeholder reviews. Use a dedicated staging domain with automatic TLS and HTTP Basic Auth.

## Required Environment Variables (Staging)
- `NODE_ENV=staging`
- `STAGING_DOMAIN=staging.jonoshheba.app`
- `STAGING_BASIC_USER` / `STAGING_BASIC_HASH` (generate via `caddy hash-password`)
- `CORS_ORIGINS=https://staging.jonoshheba.app`
- Fresh 256-bit secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `AI_SERVICE_JWT_SECRET`, `CHAT_SESSION_SECRET`, `WEBHOOK_HMAC_SECRET`
- `WEBHOOK_IP_ALLOWLIST` set to staging provider egress IPs

## Pre-Release Verification Gate
Run before every staging promotion:
```bash
node scripts/check-i18n.mjs
pnpm lint && pnpm typecheck && pnpm test && pnpm build
node scripts/qa-release-gate.mjs
```
