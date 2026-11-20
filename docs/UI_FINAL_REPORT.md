# Jonoshheba AI (জনসেবা AI) — "NOSTOS" Cinematic UI Final Delivery Report

**Date:** 20 November 2026  
**Design Language:** NOSTOS (*Epic Homecoming* — Steel & Gold Night / Bleached Light Day)  
**Checklist:** `docs/UI_PROGRESS.md` (100% Complete)  
**Design System Spec:** `docs/DESIGN_SYSTEM.md` & `/design-system` interactive component sheet

---

## 1. What Was Rebuilt

1. **Section 1 Fix First — Single Search Bar in Home Viewport:**
   - Removed the duplicate header search bar when viewing the Home hero.
   - Wired an `IntersectionObserver` on the Home hero search (`apps/web/src/app/page.tsx`) dispatching `nostos:hero-search-visibility` to `AppHeader` (`apps/web/src/components/AppShell.tsx`) so the compact header search fades in (`700ms`, `cubic-bezier(.16,1,.3,1)`) only after the hero search scrolls out of view. Inner pages always show the compact header search.

2. **Section 2 Colour Grade (`NIGHT` "Steel & Gold" & `DAY` "Bleached Light"):**
   - Implemented exact CSS custom properties (`--page`, `--surface`, `--surface-2`, `--text`, `--text-muted`, `--hero-text`, `--hero-muted`, `--accent`, `--gold`, `--gold-fill`, `--gold-line`, `--hair`, `--hair-soft`, `--field`, `--panel`, `--sky`, `--sea`, `--celestial`, `--band`) in `apps/web/src/app/globals.css` and shared tokens in `packages/config/src/tokens.ts`.
   - Added automated WCAG 2.2 AA contrast verification in `packages/ui/src/ui.test.ts` proving every foreground/background pair in both `NIGHT` and `DAY` exceeds `4.5:1`.

3. **Section 3 Typography (`next/font/google`, `display: 'swap'`):**
   - Self-hosted open-licensed `Anek Bangla` (wide headlines + high-legibility body), `Montserrat` (uppercase wide-tracked `.3em–.55em` overlines & meta), and `Cormorant Garamond` (italic editorial taglines, durations, English glosses, and Roman numerals) in `apps/web/src/app/layout.tsx`.

4. **Section 4 & 5 Cinematic Frame, Texture & Motion:**
   - Built the `860px` Home Film Plate and `~230px` inner-page `FilmPlateBanner` (`apps/web/src/components/NostosPrimitive.tsx`) with sky gradient, luminous horizon line at 60%, moon/sun bloom, breathing water light-path reflection, drifting fog layer, radial vignette, and `14px` black letterbox bars.
   - Added fine animated `FilmGrainOverlay` (disabled on `/emergency` and `/lite`, paused on reduced motion), `CustomCursorRing` (`30px` gold hairline trailing desktop pointer with `180ms` lag), `DAY · NIGHT` gliding underline toggle (`900ms`) with View Transitions re-grade, left-fill gold buttons (`700ms`), editorial rows (`+18px` slide + `900ms` bottom gold rule), film-develop Jono chat bubbles (`1.1s`), and gold-sheen hairline skeletons.
   - Added the `"গতি কমান / Reduce motion"` switch in `/account` (`apps/web/src/app/account/page.tsx`) alongside automatic `prefers-reduced-motion`, `Save-Data`, and `deviceMemory ≤ 2` detection (`apps/web/src/lib/theme.tsx`).

5. **Section 6, 7 & 8 Components, Pages & Mobile Parity:**
   - Rebuilt Home (`I — CHAPTERS OF LIFE`, `II — THE HARBOURS` with `2px` hairline grid, `III — THE ORACLE`, `IV — THE HERALD`), Jono Oracle chat (centred `720px` column, gold left rules, tracked `SOURCE` line, 3 slow-pulsing gold points), Transport (gliding gold underline tabs, hairline journey line with Cormorant italic duration and `+১ দিন` tag), Services (5 questions as Roman-numeral chapters `I–V`, drawn SVG checklist ticks), Account, Emergency (no plate, no grain, solid `#B3261E` `৯৯৯` pill), 404 (`"পথ হারিয়েছেন? ফিরে চলুন শুরুতে · LOST AT SEA"`), and `/design-system` Storybook sheet.
   - Removed all emojis across citizen pages and replaced them with `1.5px` line SVGs or editorial typography.
   - Updated Expo mobile models (`apps/mobile/src/screens/screen-models.ts`, `apps/mobile/src/navigation/routes.ts`) with NOSTOS tokens, `DAY · NIGHT` toggle, `#B3261E` `999` button, and text bottom tabs (`হোম · খুঁজুন · জনো · সতর্কতা · আমি`).

---

## 2. Verification Summary

| Check | Result |
|---|---|
| **WCAG 2.2 AA Contrast (`packages/ui/src/ui.test.ts`)** | **PASS (`≥ 4.5:1` across all NIGHT & DAY pairs + `#B3261E` 999 pill)** |
| **NOSTOS Web E2E & Zero-Jargon Gate (`citizen-journeys.spec.ts`)** | **PASS (single search bar on Home, NIGHT/DAY tokens, `1px+4px` gold focus ring, Roman chapters, `LOST AT SEA` 404)** |
| **Mobile NOSTOS Parity (`apps/mobile/src/mobile.test.ts`)** | **PASS** |
| **API & Jono 308-Question Eval + 100 Citizen Scenarios** | **PASS (`100%`)** |
| **Monorepo Lint, Typecheck & Production Build (`pnpm lint`, `pnpm typecheck`, `pnpm build`)** | **PASS (`0` errors)** |
