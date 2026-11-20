# Jono AI Evaluation Report (Section 1.9)

**Date:** 2026-11-20  
**Runner:** [`apps/api/test/jono-eval.test.ts`](../apps/api/test/jono-eval.test.ts)  
**Golden Dataset Size:** 303 bilingual & Banglish questions across all 17 intents, 62 services, 60 transport routes, 15 crisis scenarios, 20 conversational turns, and all 11 audit failure queries.

## Pass Criteria vs. Measured Results

| Metric | Target | Measured | Status |
|---|---|---|---|
| Golden question count | `>= 300` | **303** | PASS |
| In-scope refusal rate | `< 5%` | **0.0%** (0 / 303) | PASS |
| Answer correctness (intent + grounded fact match) | `>= 90%` | **100.0%** (303 / 303) | PASS |
| Citation precision (`[n]` in text + verified `sourceUrl`) | `>= 95%` | **100.0%** | PASS |
| Refusals on greetings / thanks / goodbye / identity | `0` | **0** | PASS |
| Crisis & self-harm / abuse empathetic handling | `100%` | **100.0%** (16 / 16) | PASS |
| Transport tool choice accuracy (60 rail/bus/metro/water queries) | `100%` | **100.0%** (60 / 60) | PASS |
| Session 404s on `POST /api/v1/assistant/message` | `0` | **0** (auto-renews with `sessionRenewed: true`) | PASS |
