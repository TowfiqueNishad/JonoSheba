# Jonoshheba AI (জনসেবা AI)

> **Independent platform — not an official government service**  
> স্বাধীন প্ল্যাটফর্ম — এটি কোনো সরকারি সেবা নয়

Bangladesh's unified smart citizen-service **Discovery + Guidance + Notification + Tracking** platform — Bangla-first, mobile-first, low-bandwidth, accessible, and AI-native.

## Monorepo Structure

```text
apps/
  api/        NestJS REST /api/v1 + OpenAPI 3.1 + SSE/WS (port 4000)
  ai/         Internal FastAPI service: RAG, NLP, OCR, Speech, ML (port 8000)
  workers/    BullMQ workers: watch scheduler, notifications, outbox relay
  web/        Next.js 15 App Router PWA, Bangla default (port 3000)
  admin/      Next.js 15 Admin & Content Ops Portal (port 3001)
  mobile/     Expo React Native (Android-first + iOS)
packages/
  shared/     Enums (TrustLabel, AvailabilityState, etc.), Zod schemas, bn/en i18n
  config/     WCAG AA design tokens & Bangla-first typography
  ui/         Shared compliance React components (EmergencyStrip, TrustBadge, etc.)
  sdk/        Typed API client generated from OpenAPI
  eslint-config/  Shared ESLint flat config
  tsconfig/       Shared strict TypeScript configs
infra/        Docker configs (Postgres/pgvector, OTel, Prometheus, Loki, Tempo, Grafana, Nginx) & K8s
docs/         Product context, ADRs, API docs, runbooks, open questions
data/         Bangladesh seed datasets & country-pack definitions
scripts/      Health dashboard (doctor.sh / doctor.ps1)
```

## Quick Start

See [docs/runbooks/local-dev.md](docs/runbooks/local-dev.md) and [docs/adr/0001-architecture.md](docs/adr/0001-architecture.md).

```bash
make up          # Start Postgres (+pgvector), Redis, MinIO, Mailpit, MLflow, Grafana stack
pnpm install     # Install JS/TS workspace dependencies
uv sync --directory apps/ai
pnpm dev         # Start all apps
bash scripts/doctor.sh
```
