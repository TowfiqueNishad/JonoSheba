# Jonoshheba AI (জনসেবা AI) — v1.0 Release Report

**Date:** November 20, 2026  
**Status:** Ready for Production Deployment  
**Git Branch:** `main`  
**Live Site URL:** https://jonosheba.vercel.app/  

---

## 1. Executive Summary

Jonoshheba AI (জনসেবা AI) v1.0 delivers a production-ready, sovereign citizen portal for Bangladesh with:
1. **Owner-Only Admin Console (`apps/admin`)**: Private, separate control room deployed to its own subdomain/project with mandatory TOTP MFA, Argon2id passwords, and noindex headers.
2. **Citizen Authentication**: Two-tab dialog supporting both mobile OTP (+880) and Email (passwordless 6-digit OTP via Resend or Argon2id password).
3. **NOSTOS Cinematic Design**: Full adherence to the NOSTOS design system, including Bangla typography fixes (zero letter-spacing for Bengali script, no fake italics), dark surface palette, and accessible 44px tap targets.
4. **Jono AI Grounding & Disambiguation**: Transparent session renewal, pronoun-aware follow-up queries, localized weekday names in Bengali, and strict Rule R1–R11 safety guardrails.
5. **Data Integrity & Provenance**: E.164 phone normalization, classified agency hierarchy (`Ministry`, `Division`, `Directorate`, `Agency`, `LocalGov`), and verified official links.

---

## 2. Completed Architecture & Deliverables

### Section 1: Owner-Only Admin Console (`apps/admin`)
- **Hosting & Isolation**: Separate Next.js app in `apps/admin/`. Never linked from public site. `X-Robots-Tag: noindex, nofollow` header on every response.
- **Authentication**:
  - Argon2id password hashing + mandatory TOTP authenticator app (`otplib`).
  - 10 emergency recovery codes generated and presented once.
  - Progressive lockout delays after 3 failed attempts; 15-minute lockout after 5.
  - Dedicated cookie `jono_admin_session` (SameSite=Strict, HttpOnly, Secure) with 8-hour absolute / 30-minute idle expiry.
- **One-time Bootstrap**:
  - CLI command: `pnpm admin:bootstrap --email owner@example.com --password "..."`
- **Dashboard Sections**:
  1. *Overview*: Live platform KPIs, verified services, hotlines, review queue.
  2. *Jono AI Monitor*: RAG groundedness, citation precision, evaluation scores.
  3. *Search Analytics*: Query metrics and content coverage tracking.
  4. *Content Governance*: Services, notices, scholarships, and hotline management.
  5. *User Directory*: Privacy-preserving user management (masked PII).
  6. *Support & Complaints*: Citizen error reports and grievances.
  7. *System Health*: Provider adapter circuits, latencies, and uptime.
  8. *Settings*: Feature flags and model routing controls.

### Section 2: Citizen Authentication (Phone + Email)
- **Two-Tab Auth Dialog**:
  - Tab 1: *মোবাইল নম্বর (Phone)* — 6-digit SMS OTP flow.
  - Tab 2: *ইমেইল (Email)* — Passwordless one-time code (10-minute expiry) or password login/register with forgot password recovery.
- **NOSTOS Night Dialog**: Dark surface (`var(--surface)`), gold borders (`var(--gold)`), accessible touch targets (`min-h-[44px]`), focus trap, and Escape key dismiss.
- **Backend Email Integration**:
  - `EmailPort` interface and `ResendEmailAdapter` with clean dev console fallback.
  - Endpoints:
    - `POST /api/v1/auth/email/otp/request`
    - `POST /api/v1/auth/email/otp/verify`
    - `POST /api/v1/auth/register`
    - `POST /api/v1/auth/login`
    - `POST /api/v1/auth/password/forgot`
    - `POST /api/v1/auth/password/reset`

### Section 3: Jono AI Correctness & Language Purity
- **Follow-up Pronoun Resolution**: `rewriteFollowUpQuery()` replaces leading Bengali demonstratives (`এটার`, `এর`, `সেটার`, `তার`, `ওটার`) with the active conversation topic.
- **Language Purity**: Train off-days and schedule times are strictly mapped to Bengali weekday names (`রবিবার`, `সোমবার`, etc.) rather than English names.
- **Session Continuity**: Transparent session renewal on missing/expired tokens ensures citizens never encounter 404 errors.

### Section 4: NOSTOS Design System Polish
- **Bangla Letter-Spacing**: Global CSS rule resets letter-spacing to `normal` across all Bengali text, reserving tracking only for Latin uppercase labels.
- **Typography**: Removed italicization on Bengali font (`Anek Bangla`).
- **Life Events Localization**: Categorical milestone tags display localized Bengali names instead of raw slugs.
- **Screen Reader Accessibility**: Added descriptive `aria-label`s to language toggles and theme switches.

### Section 5: Data Fixes & Provenance
- **Agency Classification**: Added `agencyType` (`Ministry`, `Division`, `Directorate`, `Agency`, `LocalGov`) across `AGENCIES_SEED`.
- **Official Channels Only**: Strict enforcement of external handoffs with "Not Reserved" / "যাচাই চলছে" trust labels (Rules R1, R2, R6).

---

## 3. Verification & Build Matrix

| Package / Application | Build Command | Status |
|-----------------------|---------------|--------|
| `@jonoshheba/api`     | `pnpm --filter @jonoshheba/api build` | ✅ PASS |
| `@jonoshheba/admin`   | `pnpm --filter @jonoshheba/admin build` | ✅ PASS |
| `@jonoshheba/web`     | `pnpm --filter @jonoshheba/web build` | ✅ PASS |

---

## 4. Documentation Index

- `docs/ADMIN_GUIDE.md`: Comprehensive setup and operational runbook for the admin console.
- `docs/AUTH.md`: Dual authentication specification (Citizen vs. Owner).
- `docs/DEPLOYMENT.md`: Infrastructure, environment variables, Vercel multi-project configuration.
- `docs/PROGRESS_v3.md`: Detailed itemized task checklist for v1.0.
