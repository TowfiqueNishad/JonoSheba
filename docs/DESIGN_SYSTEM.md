# Jonoshheba AI (জনসেবা AI) — "NOSTOS" Design System Specification

**Creative Direction:** *NOSTOS* (Greek for an epic homecoming) — large-format film calm, cold steel-blue shadows, natural desaturated tones, enormous negative space, wide-tracked small-caps metadata, hairline rules, and one restrained gold accent.

---

## 1. IP & Safety Mandates

- **100% Original Design:** Uses zero film stills, posters, key art, logos, characters, or film names anywhere in UI or code. All atmospheric plates are pure CSS/SVG gradients. Fonts are open-licensed (`Anek Bangla`, `Montserrat`, `Cormorant Garamond`).
- **Safety Rule (Rule R8):** The `৯৯৯` emergency button is always solid `#B3261E` with `#FFFFFF` text, visible in the first viewport of every page in both `NIGHT` and `DAY` modes. `/emergency` renders with no film plate and no grain overlay.

---

## 2. Colour Grade Tokens (`[data-theme="night" | "day"]`)

| Token | NIGHT (`"Steel & Gold"`) | DAY (`"Bleached Light"`) | Purpose |
|---|---|---|---|
| `--page` | `#050709` | `#ECE8E0` | Primary page canvas |
| `--surface` | `#0A0F16` | `#F6F2EA` | Primary card / row surface |
| `--surface-2` | `#0E1824` | `#E4DFD5` | Elevated / secondary surface |
| `--text` | `#ECE6DA` | `#14191F` | Primary ivory / ink body copy (`≥ 14:1` contrast) |
| `--text-muted` | `#9AA3AC` | `#4E5862` | Secondary copy (`≥ 5.2:1` contrast) |
| `--hero-text` | `#F1ECE2` | `#101820` | Hero display headline |
| `--hero-muted` | `#A9B6C2` | `#3B4A57` | Hero tagline & metadata |
| `--accent` | `#9CC3E6` | `#2E4A63` | Cold steel-blue overlines & verified outlines |
| `--gold` | `#D9B46C` | `#86642A` | Restrained gold accent (rules, Roman numerals, focus rings) |
| `--gold-line` | `rgba(217,180,108,0.55)` | `rgba(134,100,42,0.55)` | Hairline gold borders |
| `--hair` | `rgba(236,230,218,0.14)` | `rgba(20,25,31,0.16)` | 1px structural hairlines |
| `--field` | `rgba(5,8,12,0.55)` | `rgba(246,242,234,0.60)` | Input field fill |
| `--panel` | `rgba(6,9,13,0.92)` | `rgba(246,242,234,0.95)` | Glass autocomplete & modal panel |

All foreground/background token pairs are verified by automated WCAG 2.2 AA contrast tests in `packages/ui/src/ui.test.ts` (`≥ 4.5:1`).

---

## 3. Typography (`next/font/google`, `display: 'swap'`)

- **Bangla Display & Body (`--font-anek-bangla`):** `Anek Bangla` variable (`wght 300–700`, `font-stretch: 110–112%` on display headlines, `100%` on body copy, line-height `1.06` headlines / `1.65` body).
- **Latin Overlines & Meta (`--font-montserrat`):** `Montserrat` (`400–700`, uppercase, `9–12px`, `letter-spacing: 0.3em–0.55em`).
- **Editorial Accent (`--font-cormorant`):** `Cormorant Garamond` italic for taglines, durations, English glosses, and Roman numerals (`I`, `II`, `III`, `IV`…).

---

## 4. Motion System (`cubic-bezier(0.16, 1, 0.3, 1)`)

- **Durations:** `600–1600ms` (`300ms` micro).
- **Custom Pointer Ring:** `30px` gold hairline ring on desktop (`pointer: fine`) with `180ms` lag; scales to `56px` over interactive controls and hides over inputs.
- **Left-Fill Gold Buttons (`.nostos-btn-gold`):** Gold fills from left to right in `700ms`; text transitions to `#050709`; active press scales to `0.985`.
- **Editorial Rows (`.nostos-editorial-row`):** Slides right `18px` on hover while a `1px` gold rule draws along the bottom (`900ms`) and the arrow advances `8px`.
- **Reduced Motion Safeguard:** Automatically disables grain shift, fog drift, water breathing, and pointer ring when `prefers-reduced-motion: reduce`, `Save-Data`, `deviceMemory ≤ 2`, or when the user enables `"গতি কমান / Reduce motion"` in `/account`.

---

## 5. Interactive Component Sheet
Visit `/design-system` in the web app (`apps/web/src/app/design-system/page.tsx`) to inspect all NOSTOS components across both `NIGHT` and `DAY` themes and `bn` / `en` locales.
