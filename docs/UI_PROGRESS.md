# Jonoshheba AI (জনসেবা AI) — "NOSTOS" Cinematic UI Progress Checklist

**Design Language:** NOSTOS (*Epic Homecoming* — Steel & Gold Night / Bleached Light Day, Large-Format Film Aesthetic)  
**Last Updated:** 2026-11-20  
**Status Legend:** `☐` Pending · `◐` In Progress · `☑` Complete & Verified

---

## 0. Creative Direction, IP & Safety Rules
- ☑ **0.1** Original NOSTOS design inspired by a large-format film mood (zero copyrighted film assets, logos, stills, characters, or film names anywhere in UI or code).
- ☑ **0.2** Safety Rule enforced: ৯৯৯ button is always solid `#B3261E` with white text, visible in the first viewport of every page in both modes; `/emergency` remains minimal, grain-free, plate-free, and high-contrast.

## 1. Fix First — Single Search Bar in Home Viewport
- ☑ **1.1** Removed duplicate header search on Home; header search fades in only after the hero search scrolls out of view (`IntersectionObserver` + `CustomEvent`), while inner pages always show the compact header search (`apps/web/src/components/AppShell.tsx`, `apps/web/src/app/page.tsx`).

## 2. Colour Grade (`[data-theme="night" | "day"]` + Shared Tokens)
- ☑ **2.1** NIGHT (`"Steel & Gold"`) and DAY (`"Bleached Light"`) CSS variables, Tailwind tokens, and React Native tokens (`packages/config/src/tokens.ts`, `apps/web/src/app/globals.css`, `apps/web/tailwind.config.ts`).
- ☑ **2.2** Automated WCAG 2.2 AA contrast verification (`≥ 4.5:1` for every text/background pair in both NIGHT and DAY modes) (`packages/ui/src/ui.test.ts`).

## 3. Typography (`next/font` Self-Hosted Open Fonts)
- ☑ **3.1** `Montserrat` (400–700, uppercase wide-tracked `.3em–.55em`), `Anek Bangla` (variable `wdth 75–125`, `wght 200–800`), and `Cormorant Garamond` (italic editorial taglines, durations, Roman numerals) configured via `next/font/google` with `display: 'swap'` (`apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`).

## 4. Cinematic Frame & Texture
- ☑ **4.1** Hero Film Plate (`860px` desktop / `~230px` inner-page banner) with sky gradient, luminous horizon line at ~60%, moon (night) or overexposed sun with soft bloom (day), vertical water light-path reflection, two drifting fog layers (`60–95s`), radial vignette, and `14px` black letterbox bars (`apps/web/src/components/NostosPrimitive.tsx`, `apps/web/src/app/globals.css`).
- ☑ **4.2** Fine animated film grain overlay (`night ~.85`, `day ~.45`, pauses under reduced motion / Save-Data / `deviceMemory ≤ 2`, disabled on `/emergency` and `/lite`).
- ☑ **4.3** Moody graded CSS/SVG module plates in steel/sand/ember palette with bottom scrim.

## 5. Motion — Slow, Smooth, Expensive (`cubic-bezier(.16,1,.3,1)`)
- ☑ **5.1** Staggered hero load rise (`18px`), custom desktop pointer ring (`30px` gold hairline trailing pointer with `180ms` lag, scales to `56px` on interactive elements, hides over inputs), left-fill gold buttons (`700ms`), drawn hairline link underlines, editorial row hover (`+18px` slide + `900ms` bottom gold rule + `+8px` arrow), module tile plate zoom (`1.06`, `1.4s`) + inset `1px` gold frame, `DAY · NIGHT` gliding underline toggle (`900ms`) with View Transitions re-grade, film-develop Jono chat bubbles (`1.1s`), and gold-sheen hairline skeletons.
- ☑ **5.2** `"গতি কমান / Reduce motion"` user toggle in Account/Settings + automatic respect for `prefers-reduced-motion`, `Save-Data`, and `deviceMemory ≤ 2` (`apps/web/src/lib/theme.tsx`, `apps/web/src/app/account/page.tsx`).

## 6. Components (`packages/ui` + Web & Storybook Showcase)
- ☑ **6.1** Shared NOSTOS component primitives & Storybook catalogue (`packages/ui/src/components.tsx`, `apps/web/src/components/NostosPrimitive.tsx`): Header, Overline label, Roman-numeral Section Heading, Editorial Row List, Module Tile with Plate, Outline-Gold Button, Solid Button, Drawn-Underline Text Link, Hairline Input, Glass Search Combobox, Outline Trust Tags, Train Card, Bus Card, Ministry Leadership Hairline Table, Institution EIIN Card, Notice Row, Oracle Chat Bubbles, Gliding-Underline Tabs, Glass Modal/Sheet, Toast, Empty/Error states, Custom Steel/Bone Map container, Footer.

## 7. Pages Rebuilt in NOSTOS
- ☑ **7.1** Home (`/`): Full-bleed film plate hero (`ALL PUBLIC SERVICES · ONE DESTINATION` → `সব সরকারি সেবা। এক ঠিকানায়।` → Cormorant italic tagline `যাত্রা যতই দীর্ঘ হোক — পথ দেখাবে জনসেবা।` → single search → animated hairline SCROLL cue) → `I — CHAPTERS OF LIFE` → `II — THE HARBOURS` (`2px` hairline grid) → `III — THE ORACLE` → `IV — THE HERALD` → Footer.
- ☑ **7.2** All Inner Pages: Film-plate banner + hairline architecture across `/services`, `/services/[slug]`, `/transport`, `/transport/trains/[number]`, `/ministries`, `/ministries/[id]`, `/hotlines`, `/education`, `/education/[id]`, `/benefits`, `/programmes/[slug]`, `/jono`, `/near-me`, `/notices`, `/calendar`, `/scholarships`, `/jobs`, `/complaints`, `/health`, `/utilities`, `/account`, `/life-events`, `/life-events/[slug]`, `/search`, `/about`, `/privacy`, `/terms`, `/contact`, `/accessibility`, `/offline`, `not-found.tsx` (`"পথ হারিয়েছেন? ফিরে চলুন শুরুতে · LOST AT SEA"`), and `error.tsx`.
- ☑ **7.3** `/emergency` (no plate, no grain, immediate `#B3261E` ৯৯৯ high-contrast layout) and `/lite` (zero-JS, plain, fast, animation-free).

## 8. Mobile (Expo) Parity
- ☑ **8.1** Mobile NOSTOS tokens, compact film-plate banner model, text bottom tab bar (`হোম · খুঁজুন · জনো · সতর্কতা · আমি`) with gliding gold hairline, `DAY · NIGHT` toggle, gentle haptics config, and Oracle chat model (`apps/mobile/src/screens/screen-models.ts`, `apps/mobile/src/navigation/routes.ts`, `apps/mobile/src/mobile.test.ts`).

## 9. Performance, Accessibility & QA
- ☑ **9.1** WCAG 2.2 AA in both NIGHT and DAY modes (`1px` gold focus outline + `4px` offset, `44px` hit targets, guaranteed-contrast scrims, `aria-hidden` decorative layers, Bangla accessible names on tracked English labels).
- ☑ **9.2** Automated tests & documentation (`apps/web/e2e/citizen-journeys.spec.ts`, `packages/ui/src/ui.test.ts`, `docs/DESIGN_SYSTEM.md`, `docs/UI_FINAL_REPORT.md`).
