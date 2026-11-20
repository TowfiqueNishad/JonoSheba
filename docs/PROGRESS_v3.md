# Jonoshheba v1.0 Progress Checklist

> Live checklist for the v1.0 release. All items completed and verified.

## Section 1 — Owner-Only Admin Console

- [x] 1.1 `apps/admin` app with NOSTOS night theme CSS variables
- [x] 1.2 `apps/admin/src/middleware.ts` — X-Robots-Tag noindex, auth guard redirect to /login
- [x] 1.3 `apps/admin/src/app/layout.tsx` — noindex meta, NOSTOS dark body, data-theme=night
- [x] 1.4 `apps/admin/src/app/login/page.tsx` — two-step login (email+pw -> TOTP), recovery codes shown once
- [x] 1.5 `apps/admin/src/app/page.tsx` — full NOSTOS dashboard (8 tabs: Overview, Jono, Search, Content, Users, Support, System, Settings)
- [x] 1.6 `apps/api/prisma/schema.prisma` — AdminUser, AdminSession, AdminAuditLog models added
- [x] 1.7 `apps/api/src/modules/admin/admin-auth.service.ts` — argon2id+TOTP auth, lockout, audit log
- [x] 1.8 `apps/api/src/modules/admin/admin-auth.controller.ts` — bootstrap, login, totp, me, logout endpoints
- [x] 1.9 `apps/api/src/modules/admin/admin.module.ts` — AdminAuthService + AdminAuthController registered
- [x] 1.10 `apps/admin/vercel.json` — separate Vercel project config with X-Robots-Tag header
- [x] 1.11 `scripts/admin-bootstrap.ts` — CLI bootstrap script
- [x] Prisma client regenerated (otplib + new models)
- [x] Admin build: ✅ PASS (5 pages static)

## Section 2 — Citizen Email Sign-In

- [x] 2.1 `EmailPort` interface + `ResendEmailAdapter` with HTML templates & dev console fallback
- [x] 2.2 `requestEmailOtp` and `verifyEmailOtp` in `AuthService`
- [x] 2.3 Email OTP routes in `AuthController` (`POST /api/v1/auth/email/otp/request` & `/verify`)
- [x] 2.4 Complete two-tab `AuthProvider` modal in `apps/web/src/lib/auth.tsx`
  - Tab 1: Phone OTP (+880)
  - Tab 2: Email (Passwordless OTP / Password login / Registration / Password recovery)
  - NOSTOS dark styling (`var(--surface)`, `var(--gold)`), Esc dismiss, focus trap, min 44px tap targets

## Section 3 — Jono AI Fixes

- [x] 3.1 Transparent session renewal on missing/expired tokens (zero 404s for citizens)
- [x] 3.2 Follow-up demonstrative pronoun resolution in `rewriteFollowUpQuery` (`এটার`, `এর`, `সেটার`, `তার`, `ওটার`)
- [x] 3.3 Language purity: Bengali weekday names (`রবিবার`, `সোমবার`, etc.) in train timetables
- [x] 3.4 Direct synonym & Banglish matchers across all 62 public services

## Section 4 — NOSTOS Design Fixes

- [x] 4.1 Bangla letter-spacing reset to `normal` across all Bengali typography in `globals.css`
- [x] 4.2 Non-italicized Bengali fonts (`Anek Bangla`)
- [x] 4.3 Life-event category slug localization in `apps/web/src/app/life-events/page.tsx`
- [x] 4.4 Descriptive `aria-label`s on language toggles in `AppShell.tsx`

## Section 5 — Data Fixes

- [x] 5.1 Ministry/Agency type classification: `OrgType` enum (`Ministry`, `Division`, `Directorate`, `Agency`, `LocalGov`) on `AGENCIES_SEED`
- [x] 5.2 Strict official links and R1–R11 trust labels on all handoffs

## Section 6 — Infrastructure

- [x] 6.1 `docs/DEPLOYMENT.md` — complete multi-project Vercel runbook
- [x] 6.2 `docs/AUTH.md` — full authentication specification
- [x] 6.3 `docs/ADMIN_GUIDE.md` — admin operations and bootstrap guide
- [x] 6.4 `.env.example` — updated with admin, email, and URL variables

## Section 7 — QA & Build Verification

- [x] 7.1 `@jonoshheba/api` build: ✅ PASS
- [x] 7.2 `@jonoshheba/admin` build: ✅ PASS
- [x] 7.3 `@jonoshheba/web` build: ✅ PASS

## Section 8 — Documentation

- [x] 8.1 `docs/ADMIN_GUIDE.md` ✅
- [x] 8.2 `docs/AUTH.md` ✅
- [x] 8.3 `docs/DEPLOYMENT.md` ✅
- [x] 8.4 `docs/FINAL_REPORT_v3.md` ✅

## Section 9 — Git & Release

- [x] 9.1 Branch `release/v1.0-admin-auth` active
- [x] 9.2 Secret scan: No credentials or secret keys committed
- [x] 9.3 Commit and push to origin
