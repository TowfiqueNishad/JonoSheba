# Jonoshheba AI — Accessibility Verification Guide (WCAG 2.2 AA)

## Automated Checks (CI)
- Verified by `apps/web/e2e/citizen-journeys.spec.ts` and `scripts/qa-release-gate.mjs`:
  - Skip-to-content link (`<a href="#main-content">`) is the 1st focusable element.
  - Landmarks present on every page: `<header>`, `<nav>`, `<main id="main-content">`, `<footer>`.
  - Exactly one `<h1>` per page; logical heading hierarchy.
  - Every interactive `<input>`, `<textarea>`, and `<select>` has an explicit `<label htmlFor>` (or `sr-only` label) — zero placeholder-only inputs.
  - High-contrast 2 px `:focus-visible` outline (`#047857`) in `apps/web/src/app/globals.css`.
  - First 3 tab stops reach: (1) Skip to content, (2) Emergency `999` tap-to-call pill, (3) `বাংলা | English` language toggle.
  - `aria-live="polite"` on search results, Jono chat transcript, form validation, and status messages; `aria-busy` on skeletons/loading containers.
  - Inline `lang="bn"` / `lang="en"` attributes on language switcher buttons and mixed-language labels.
  - `prefers-reduced-motion: reduce` disables animations/smooth scrolling.
  - Interactive touch targets meet `min-h-[44px]` (`44 × 44 px`).
  - Zero-JS `< 10 KB` `/lite` mode works cleanly on Opera Mini, 2G networks, and assistive text browsers.

## Manual Screen-Reader Checklist (NVDA on Windows & TalkBack on Android)
1. **Tab Order & Skip Link:** Press `Tab` on `/` — confirm "Skip to main content / মূল বিষয়বস্তুতে যান" announces first, followed by "Call 999" and the "বাংলা / English" switcher.
2. **Voice Switching:** Switch between Bangla and English using the toggle; verify `<html lang>` updates and NVDA/TalkBack switches speech synthesizer language cleanly.
3. **Jono Chat:** Focus the chat input (`#jono-chat-input`) — verify screen reader announces the label, empty Send button announces `disabled`, and assistant replies announce automatically via `role="log" aria-live="polite"`.
4. **Zoom 200%:** Set browser zoom to `200%` on desktop and `375 px` mobile — confirm zero horizontal overflow and all cards/buttons remain usable.
5. **Contrast Check:** Confirm text/chip contrast meets `≥ 4.5:1` (dark emerald `#065f46` / `#022c22` on `#ecfdf5` / `#ffffff`, slate-700/900 on light backgrounds).
