# Security Hardening & Privacy Compliance Checklist (OWASP + Rules R1–R11)

## 1. Transport & HTTP Hardening
- TLS 1.3 enforced at Ingress; HSTS (`max-age=31536000; includeSubDomains`), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and strict CORS allowlist enabled in `apps/api/src/main.ts`.
- Internal `apps/ai` service enforces HS256 service-to-service JWT (`app/core/auth.py`) AND Kubernetes `NetworkPolicy` isolation (`infra/k8s/networkpolicy-ai-isolation.yaml`).

## 2. Authentication, RBAC & Two-Person Controls
- Ed25519 (EdDSA) JWT access tokens + `kid` rotation (`/.well-known/jwks.json`).
- Rotating refresh tokens with token-family reuse revocation.
- Argon2id password hashing; HMAC-SHA256 hashed 6-digit OTPs with 5-attempt `423` lockout.
- Mandatory TOTP MFA for staff/partner roles; two-person approval (`reviewerId !== authorId`) enforced on emergency hotlines and public-service content edits.

## 3. Data Minimization, Privacy & Isolation (Rules R3, R9, R10)
- Zero third-party passwords, card numbers, mobile-banking PINs, or OTPs stored anywhere.
- PostgreSQL Row-Level Security (RLS) active across all 17 user-owned tables.
- PII redaction (`redactFreeTextPii` in TS & `redact_pii_text` in Python) strips BD phone numbers, emails, and NID/BRN IDs before logs and chat history persistence.
- Regional analytics and anomaly detection enforce a hard `k-anonymity >= 10` suppression floor.

## 4. AI & Guardrail Safety (Rules R1, R2, R4, R5, R6, R7, R8)
- Rule R8 emergency fast-path triggers before LLM execution and surfaces `999` immediately.
- Prompt-injection detector blocks auto-booking (R4), CAPTCHA/queue bypass (R2), and system-prompt exfiltration.
- Claim-citation verifier checks all `[n]` references and hotline numbers; missing/stale evidence triggers honest refusal or `UNAVAILABLE_STALE` warning.
