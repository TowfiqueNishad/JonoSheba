# Shared brief for all workers (One-Shot Master Prompt run)

Repo: `d:\Jonosheba` (Windows, PowerShell 5.1 — no `&&`; use `; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }`).
Read `AGENTS.md` (R1–R11, C1–C8) and the user's master prompt rules (R1–R11, C1–C5) — they override everything.
The full master prompt text is in the coordinator's conversation; your section text is pasted into your brief.

## Hard rules
- NEVER invent data (stations, trains, buses, ministries, officials, phone numbers, EIINs, fees, dates, coordinates, URLs). Only use records already in `data/coverage/*.json`, `apps/api/src/seed-data/*`, `data/sources/registry.json`, or files under `data/imports/` (currently ABSENT). For anything missing: build the importer + API + UI, show "যাচাই চলছে / Verification pending", and append a row to `docs/DATA_NEEDED.md`.
- Every fact shown carries trust label + source URL + agency + lastVerifiedAt (real verification events only, never seed/import time).
- Bangla default, English full peer. No English words on Bangla UI except allowlisted acronyms/URLs; no internal codes (C01, Rule R1, MOCK, LINK_ONLY…) in citizen UI.
- Record ambiguous choices in `docs/DECISIONS.md` (append `D-0xx` lines; use your worker name prefix, e.g. `D-JONO-01`).
- Update ONLY your own section lines in `docs/PROGRESS.md` (☐ → ☑ / ◐ with files + test names). Use narrow `edit_file` targets (one line).

## Shared workspace etiquette (6 workers edit the same tree concurrently)
- Stay inside the files you own. If you must touch a shared file (`apps/api/src/app.module.ts`, `packages/shared/src/i18n/{bn,en}.json`, `packages/sdk/src/client.ts`, `apps/web/src/components/AppShell.tsx`, `tests/authz-matrix.yaml`), use the smallest possible `edit_file` with a unique target and re-read just before editing.
- i18n: prefer adding a NEW top-level namespace for your feature in BOTH bn.json and en.json (keep 100% key parity; `node scripts/check-i18n.mjs` must pass). Inline `locale === 'bn' ? … : …` is also acceptable for page-local copy.
- DO NOT run `pnpm build`, `next build`, `turbo` full runs, or start servers on ports 3000/3001/4000 (they are in use). Verify with: `pnpm --filter @jonoshheba/<pkg> exec vitest run <your test files>`, `pnpm --filter @jonoshheba/<pkg> exec tsc --noEmit`, `pnpm --filter @jonoshheba/<pkg> exec eslint <your files>`. If tsc errors appear in files owned by others, ignore them and mention them in your report.
- Python (apps/ai): `uv run ruff check .`, `uv run mypy app`, `uv run pytest -q <files>` (pytest with TestClient may need BypassSandbox on Windows; try sandboxed first).
- No network access is available. Don't add new npm/pip dependencies (none can be installed); implement with what exists (Node 22 stdlib, existing deps).
- Never weaken existing security (admin default-deny + MFA guard, chat ownership, webhook HMAC, rate limits, CSP).
- Keep existing tests passing; add new tests for your work (Vitest in `apps/api/test/` or next to modules; web tests in `apps/web/e2e/*.spec.ts` run by Vitest).

## When done
Reply to the coordinator with: files changed, new endpoints/routes, tests added + pass counts, metrics, data gaps added to DATA_NEEDED.md, and anything another worker must wire up.
