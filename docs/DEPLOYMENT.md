# Deployment Guide — Jonoshheba AI

> Last updated: 2026-11-20

## Architecture Overview

```
Public Site (apps/web)          → Vercel Project: jonoshheba-web
Admin Console (apps/admin)      → Vercel Project: jonoshheba-admin (SEPARATE, private)
API (apps/api)                  → Vercel Project: jonoshheba-api  (or Railway/Render)
AI Service (apps/ai)            → Python FastAPI (Railway / Cloud Run)
```

---

## 1. Web App (apps/web)

**Vercel project root directory:** `apps/web`

### Environment Variables (Vercel → Settings → Environment Variables)
```bash
NEXT_PUBLIC_API_URL=https://jonoshheba-api.vercel.app
NEXT_PUBLIC_SITE_URL=https://web-big6.vercel.app
```

### Build Command
Vercel auto-detects via `vercel.json` in `apps/web/`.

---

## 2. Admin Console (apps/admin)

**Vercel project root directory:** `apps/admin`

> ⚠ NEVER link this URL from the public site. Set `robots.txt` to disallow, and ensure `X-Robots-Tag: noindex, nofollow` is on every response (middleware already does this).

### Environment Variables
```bash
NEXT_PUBLIC_API_URL=https://jonoshheba-api.vercel.app
ADMIN_BOOTSTRAP_SECRET=<64-char random secret>
```

### Deploy Steps
1. In Vercel dashboard → "Add New Project" → Import `TowfiqueNishad/JonoSheba`.
2. Set **Root Directory** to `apps/admin`.
3. Set framework to **Next.js**.
4. Add env vars above.
5. Deploy. The URL is your private admin console.
6. Run bootstrap: `ADMIN_BOOTSTRAP_SECRET=xxx pnpm admin:bootstrap --email you@domain.com --password "..."`

---

## 3. API (apps/api)

**NestJS on Node 22.** Can deploy to Vercel Serverless or Railway.

### Environment Variables
```bash
DATABASE_URL=postgresql://user:pass@host/jonoshheba?schema=public
ADMIN_BOOTSTRAP_SECRET=<same 64-char secret as admin console>
NODE_ENV=production
JWT_SECRET=<64-char random>
SITE_URL=https://web-big6.vercel.app
```

### Vercel Serverless Deployment
Root directory: `apps/api`. Add `vercel.json`:
```json
{
  "functions": { "dist/main.js": { "maxDuration": 30 } }
}
```

### Railway / Render
Build command: `pnpm --filter @jonoshheba/api build`
Start command: `node apps/api/dist/main.js`

---

## 4. Database (Neon Postgres)

1. Create a Neon project → get connection string.
2. Set `DATABASE_URL` in both API and Admin env vars.
3. Run migrations: `pnpm --filter @jonoshheba/api db:migrate:deploy`
4. Run seeds: `pnpm --filter @jonoshheba/api db:seed`

---

## 5. Redis (Upstash)

1. Create Upstash Redis instance (free tier).
2. Set `REDIS_URL=rediss://...` in API env vars.

---

## 6. Email (Resend)

For citizen email auth and admin alerts:
1. Sign up at resend.com, verify domain.
2. Set `RESEND_API_KEY=re_...` in API env vars.
3. Set `FROM_EMAIL=noreply@yourdomain.com`.

---

## 7. Vercel Regions

Both web and admin projects: set **Function Region** to `sin1` (Singapore) for lowest Bangladesh latency.

---

## 8. Cron Jobs (Vercel Cron)

Add to `apps/api/vercel.json`:
```json
{
  "crons": [
    { "path": "/api/v1/cron/freshness-check", "schedule": "0 2 * * *" },
    { "path": "/api/v1/cron/cleanup-sessions", "schedule": "0 3 * * *" }
  ]
}
```

---

## 9. Secret Scanning

Before every push, run:
```bash
gitleaks detect --source . --no-banner
```

Never commit `.env` files. The `.gitignore` already excludes them.

---

## 10. Checklist Before Go-Live

- [ ] `DATABASE_URL` set and migrations run
- [ ] `ADMIN_BOOTSTRAP_SECRET` set (different from dev)
- [ ] Admin console URL NOT in public sitemap or nav
- [ ] `robots.txt` on public site disallows admin URL
- [ ] SSL certificate active on all domains
- [ ] `JWT_SECRET` rotated from default
- [ ] `RESEND_API_KEY` set for email
- [ ] Admin owner bootstrapped and TOTP set up
- [ ] Recovery codes stored securely offline
- [ ] Sentry DSN configured
