# Decisions Log (One-Shot Master Prompt run, 2026-11-20)

Each entry: ID — decision — reason — rule(s).

- **D-001** — `data/imports/` did not exist at the start of the run (no rail PDFs, BANBEIS/UGC lists, ministry officer pages or crisis-line list). All importers, APIs and screens are built; affected datasets are shown as "যাচাই চলছে / Verification pending" and listed in `docs/DATA_NEEDED.md`. No records are generated from model memory. — C1, R5.
- **D-002** — No network crawling was performed during this run (sandboxed, and crawling official sites needs per-site robots review). Crawlers ship with a domain allowlist + robots.txt check + contact User-Agent and run only when an admin triggers them. — R2, C7.
- **D-003** — Crisis replies only show hotlines that are already verified in `data/coverage/orgs-hotlines-calendar.json` (999, 109, 1098, 16263). Dedicated mental-health lines stay "pending" until a verified list is imported into `data/imports/crisis-lines/`. — R8, C1.
