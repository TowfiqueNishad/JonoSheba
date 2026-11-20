# Local Development Runbook

## Prerequisites
- Node.js `>= 22 LTS` + `pnpm >= 9` (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- Python `>= 3.12` + `uv`
- Docker + Docker Compose v2

## Quick Start
1. Copy `.env.example` to `.env` at the repo root and inside any app you want to customize (never commit `.env`).
2. Start local infrastructure:
   ```bash
   make up
   # Or with optional OpenSearch & Ollama profiles:
   make up-full
   ```
3. Install dependencies:
   ```bash
   pnpm install
   uv sync --directory apps/ai
   ```
4. Start all applications:
   ```bash
   pnpm dev
   ```
5. Verify everything is healthy:
   ```bash
   bash scripts/doctor.sh
   # On Windows PowerShell:
   pwsh scripts/doctor.ps1
   ```

## Service Ports
- `apps/web`: `http://localhost:3000`
- `apps/admin`: `http://localhost:3001`
- `apps/api`: `http://localhost:4000` (`/health`, `/api/v1/health`, `/api/docs`)
- `apps/ai`: `http://localhost:8000` (`/health`, `/docs`)
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- MinIO API / Console: `localhost:9000` / `http://localhost:9001`
- Mailpit UI / SMTP: `http://localhost:8025` / `localhost:1025`
- MLflow: `http://localhost:5000`
- Grafana / Prometheus / Loki / Tempo: `3005` / `9090` / `3100` / `3200`
