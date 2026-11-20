# Authentication Guide — Jonoshheba AI

## Overview

Jonoshheba has **two completely separate auth systems**:

| | Citizen Auth | Admin Auth |
|---|---|---|
| **Cookie name** | `jono_session` | `jono_admin_session` |
| **Domain** | Public site | Admin console only |
| **MFA** | Optional (phone OTP = 2FA already) | **Mandatory TOTP** |
| **Session** | 30 days | 8h absolute / 30min idle |
| **Sign-up** | Phone OTP or Email | Invitation only (owner: bootstrap CLI) |

---

## Citizen Authentication

### Methods
1. **Phone OTP** (primary): Enter `+88 01XXXXXXXXX` → receive 6-digit OTP via SMS → verify.
2. **Email (passwordless)**: Enter email → receive 6-digit code → verify.
3. **Email (password)**: Register with email + password (argon2id, 12+ chars) → login.

### Session
- JWT access token (15 min) + refresh token in `jono_session` cookie (30 days).
- `SameSite=Lax`, `HttpOnly`, `Secure` in production.
- Revocable via logout.

### Password Reset
`POST /api/v1/auth/email/forgot-password` → email link → `POST /api/v1/auth/email/reset-password`

---

## Admin Authentication (Owner Only)

### Bootstrap
```bash
ADMIN_BOOTSTRAP_SECRET=xxx pnpm admin:bootstrap \
  --email owner@domain.com --password "12charMin!Pw"
```

### Login Flow
```
POST /api/v1/admin/auth/login
  { email, password }
  → { requiresTotp: true, pendingToken: "...", totpSetupRequired?: true }

POST /api/v1/admin/auth/totp
  { pendingToken: "...", code: "123456" }
  → Sets jono_admin_session cookie (HttpOnly, Secure, SameSite=Strict)
```

### TOTP Setup (first login)
```
POST /api/v1/admin/auth/totp/setup
  → { secret, otpAuthUrl }

POST /api/v1/admin/auth/totp/confirm
  { secret, code }
  → { recoveryCodes: ["XXXX-XXXX", ...] }  ← shown ONCE, save them!
```

### Session Validation
```
GET /api/v1/admin/auth/me
  Cookie: jono_admin_session=...
  → { id, email, role, status, totpEnabled, lastLoginAt }
```

### Logout
```
DELETE /api/v1/admin/auth/logout
  → clears jono_admin_session cookie
```

---

## Security Implementation Details

### Password Hashing
- Algorithm: **argon2id** (via `hash-wasm`)
- Params: m=65536, t=3, p=1, 32-byte hash

### Token Storage
- Session tokens: cryptographically random 32 bytes (64 hex chars)
- Stored as argon2id hash in DB (token is never stored plaintext)

### IP Pseudonymisation
- IP addresses are stored as a one-way hash (not reversible)
- Used only for lockout and audit log correlation

### Lockout Policy
| Attempt | Delay |
|---------|-------|
| 1–2 | No delay |
| 3 | Turnstile CAPTCHA |
| 4 | Progressive delay |
| 5+ | 15-minute hard lock |

### Re-authentication
Sensitive actions require password + TOTP re-verification within 5 minutes:
- Delete content
- Change hotlines
- Change staff roles
- Export data
- Change AI/model settings
