# Jonoshheba v1.0 Progress Checklist

> Live checklist for the v1.0 release. Updated continuously.

## Section 1 — Owner-Only Admin Console

- [x] 1.1 `apps/admin` app with NOSTOS night theme CSS variables
- [x] 1.2 `apps/admin/src/middleware.ts` — X-Robots-Tag noindex, auth guard redirect to /login
- [x] 1.3 `apps/admin/src/app/layout.tsx` — noindex meta, NOSTOS dark body, data-theme=night
- [x] 1.4 `apps/admin/src/app/login/page.tsx` — two-step login (email+pw → TOTP), recovery codes shown once
- [x] 1.5 `apps/admin/src/app/page.tsx` — full NOSTOS dashboard (8 tabs: Overview, Jono, Search, Content, Users, Support, System, Settings)
- [x] 1.6 `apps/api/prisma/schema.prisma` — AdminUser, AdminSession, AdminAuditLog models added
- [x] 1.7 `apps/api/src/modules/admin/admin-auth.service.ts` — argon2id+TOTP auth, lockout, audit log
- [x] 1.8 `apps/api/src/modules/admin/admin-auth.controller.ts` — bootstrap, login, totp, me, logout endpoints
- [x] 1.9 `apps/api/src/modules/admin/admin.module.ts` — AdminAuthService + AdminAuthController registered
- [x] 1.10 `apps/admin/vercel.json` — separate Vercel project config with X-Robots-Tag header
- [x] 1.11 `scripts/admin-bootstrap.ts` — CLI bootstrap script
- [x] Prisma client regenerated (otplib + new models)
- [x] API build: ✅ PASS
- [ ] Admin build: running...

## Section 2 — Citizen Email Sign-In

- [ ] 2.1 EmailPort interface + Resend adapter
- [ ] 2.2 Email auth endpoints in AuthController
- [ ] 2.3 Two-tab AuthDialog in web app

## Section 3 — Jono AI Fixes

- [ ] 3.1 Persistent sessions (Prisma ai.Conversation model)
- [ ] 3.2 Follow-up pronoun resolution
- [ ] 3.3 Service disambiguation keywords

## Section 4 — NOSTOS Design Fixes

- [ ] 4.1 Bangla letter-spacing fix
- [ ] 4.2 Life-event category localized names
- [ ] 4.3 Accessible lang button aria-labels
- [ ] 4.4 Default language Bangla

## Section 5 — Data Fixes

- [ ] 5.1 Ministry orgType enum
- [ ] 5.2 E.164 phone normalization

## Section 6 — Infrastructure

- [x] 6.1 `docs/DEPLOYMENT.md` written
- [x] 6.2 `docs/AUTH.md` written
- [x] 6.3 `docs/ADMIN_GUIDE.md` written
- [ ] 6.4 `.env.example` updated

## Section 7 — QA

- [ ] 7.1 API tests
- [ ] 7.2 Web build final verification

## Section 8 — Documentation

- [x] 8.1 `docs/ADMIN_GUIDE.md` ✅
- [x] 8.2 `docs/AUTH.md` ✅
- [x] 8.3 `docs/DEPLOYMENT.md` ✅
- [ ] 8.4 `docs/FINAL_REPORT_v3.md`

## Section 9 — Git/PR

- [ ] 9.1 Commit all changes
- [ ] 9.2 Push `release/v1.0-admin-auth`
- [ ] 9.3 Open PR to `main`
- [ ] 9.4 Tag v1.0.0

---

## Build Status

| App | Status |
|-----|--------|
| `@jonoshheba/api` | ✅ PASS |
| `@jonoshheba/admin` | 🔄 Building… |
| `@jonoshheba/web` | ✅ PASS (last verified) |
