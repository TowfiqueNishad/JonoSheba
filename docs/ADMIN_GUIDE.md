# Admin Guide — Jonoshheba Control Room

> **IMPORTANT:** This is an internal document. The admin console is never linked from the public site. Keep this guide confidential.

## 1. Initial Setup (Bootstrap)

### 1.1 Set Environment Variables

Before deploying, set these env vars in your Vercel admin project (or `.env`):

```bash
ADMIN_BOOTSTRAP_SECRET=<random-64-char-string>  # generate with: openssl rand -hex 32
NEXT_PUBLIC_API_URL=https://your-api-url.vercel.app
```

### 1.2 Run the Bootstrap Script

```bash
# From the monorepo root:
ADMIN_BOOTSTRAP_SECRET=your-secret pnpm admin:bootstrap \
  --email owner@yourdomain.com \
  --password "YourStr0ng12charPw!"
```

This creates the owner account with status `setup_pending`. It will fail if an owner already exists.

### 1.3 Complete TOTP Setup

1. Open the Admin Console URL (separate Vercel project).
2. Log in with your email and password.
3. The first login presents a TOTP setup screen.
4. Open **Google Authenticator**, **Authy**, or any TOTP app → scan the QR code.
5. Enter the 6-digit code to confirm setup.
6. **Copy and store your 10 recovery codes** (shown only once!). Store offline.

---

## 2. Daily Login Flow

1. Open Admin Console URL.
2. Enter **email + password** → click Continue.
3. Enter the **6-digit TOTP code** from your authenticator app.
4. Session lasts **8 hours absolute / 30 minutes idle**.

### 2.1 Lockout & Recovery

- After **3 failed attempts**: Cloudflare Turnstile CAPTCHA activates.
- After **5 failed attempts**: Account locked for 15 minutes.
- If you lose your TOTP device: use one of your 10 recovery codes on the TOTP screen.
- Recovery codes are one-time use. After using one, generate new codes from Settings.

---

## 3. Dashboard Sections

### 📊 Overview
Live KPIs: verified services, hotlines, pending reviews, provider health, RAG eval scores.

### 🤖 Jono AI Monitor
- Volume by intent, tool usage, top questions.
- Review queue of redacted answers (PII stripped; crisis messages never stored — R8).
- Mark answers correct/incorrect; corrections become golden test cases.
- Prompt versions and model routing (requires re-auth).

### 🔍 Search Analytics
Top queries, zero-result queries → "create content" action.

### 📋 Content Management
Services, notices, scholarships, jobs, hotlines, ministries, institutions.
- List → Edit → Review → Publish / Archive.
- Hotline edits require two-person confirmation + re-auth.
- Version history on every record.

### 👤 Users
- Citizen counts and growth graphs.
- Search by masked phone/email (never shows raw PII to admin without consent ticket).
- Block/unblock abusive accounts.
- Process data export and deletion requests (R9).

### 🎫 Support & Complaints
Incoming support tickets and content error reports.

### ⚙ System Health
API, Postgres, Redis, queue workers, provider integrations, Sentry errors, rate-limit hits, failed logins.

### 🚩 Settings
Feature flags, model routing, prompt versions, AI configuration.
**Sensitive changes require re-authentication (password + TOTP).**

---

## 4. Security Rules

| Rule | Detail |
|------|--------|
| **No public sign-up** | Only bootstrapped owner + invitations |
| **Mandatory MFA** | TOTP required on every login |
| **Session limits** | 8h absolute / 30min idle |
| **Re-auth** | Required before: delete content, change hotlines, change roles, export data, change AI settings |
| **Audit log** | Every action logged: who, what, when, IP-hash, before/after diff |
| **Append-only audit** | Audit log cannot be modified or deleted |
| **IP allowlist** | Optional: set `ADMIN_IP_ALLOWLIST` env var (comma-separated CIDRs) |
| **Citizen isolation** | Admin cannot read citizen saved items or chats without a consent ticket (R10) |

---

## 5. Invite Additional Staff

> Coming in v1.1. For v1.0, only the owner account exists.

Staff roles planned: `editor`, `reviewer`, `support` — each with mandatory MFA.

---

## 6. Disclaimers

- Never use this console on a shared or public device.
- Always log out after each session.
- The admin console URL must never appear on the public site, in sitemaps, or in any public link.
- Footer disclaimer: "Independent platform — not an official government service"
