'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROMAN_NUMERALS } from '@jonoshheba/ui';
import { useLocale } from '../lib/i18n';
import { useTheme } from '../lib/theme';

export function toRoman(n: number): string {
  return ROMAN_NUMERALS[n - 1] ?? String(n);
}

/**
 * Custom decorative cursor ring (desktop pointer:fine only):
 * - 30px hairline gold ring trailing the pointer with 180ms lag
 * - Scales to 56px and fills faintly over links/buttons
 * - Hides over text inputs
 * - Native cursor preserved for accessibility
 */
export function CustomCursorRing() {
  const { reducedMotion } = useTheme();
  const ringRef = useRef<HTMLDivElement | null>(null);
  const [finePointer, setFinePointer] = useState(false);

  useEffect(() => {
    if (reducedMotion || typeof window === 'undefined') {
      setFinePointer(false);
      return;
    }
    const mq = window.matchMedia('(pointer: fine)');
    setFinePointer(mq.matches);
    if (!mq.matches) return;

    const ring = ringRef.current;
    if (!ring) return;

    function onMove(e: MouseEvent) {
      if (!ring) return;
      const target = e.target as HTMLElement | null;
      const isInput = Boolean(target?.closest('input, textarea, select, [contenteditable="true"]'));
      const isInteractive = Boolean(target?.closest('a, button, [role="button"], [role="option"]'));

      ring.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%) scale(${
        isInput ? 0.2 : isInteractive ? 1.86 : 1
      })`;
      ring.style.opacity = isInput ? '0' : '1';
      ring.style.backgroundColor = isInteractive ? 'rgba(217,180,108,0.10)' : 'transparent';
    }

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [reducedMotion]);

  if (!finePointer || reducedMotion) return null;

  return (
    <div
      ref={ringRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-50 h-[30px] w-[30px] rounded-full border border-[var(--gold-line)] opacity-0 transition-[transform,opacity,background-color] duration-[180ms] ease-[cubic-bezier(.16,1,.3,1)]"
    />
  );
}

/**
 * Global fine animated film grain overlay:
 * - Night ~0.85, Day ~0.45 opacity
 * - Pauses under reduced motion
 * - Disabled completely on /emergency and /lite (Safety Rule)
 */
export function FilmGrainOverlay() {
  const pathname = usePathname() ?? '/';
  const { reducedMotion } = useTheme();
  const stripped = pathname.replace(/^\/(bn|en)(?=\/|$)/, '') || '/';

  if (stripped === '/emergency' || stripped.startsWith('/lite')) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={`nostos-film-grain pointer-events-none fixed inset-0 z-30 ${
        reducedMotion ? 'nostos-grain-paused' : ''
      }`}
    />
  );
}

/**
 * Inner-page shorter NOSTOS Film-Plate Banner (~230px):
 * - Sky + sea gradient, luminous horizon line, moon/sun bloom, 14px letterbox bars
 * - Overline (tracked caps) + Breadcrumb + Wide Anek Bangla H1 + Cormorant italic subtitle
 */
export function FilmPlateBanner({
  overline,
  title,
  subtitle,
  breadcrumb,
  actions,
}: {
  overline: string;
  title: string;
  subtitle?: string;
  breadcrumb?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
}) {
  const { localePath } = useLocale();
  return (
    <section className="nostos-film-plate relative overflow-hidden border-b border-[var(--hair)]">
      {/* Top 14px letterbox bar */}
      <div aria-hidden="true" className="h-[14px] w-full bg-[#020304]" />

      {/* Atmospheric layers (sky, horizon line, water path, fog, vignette — no sun/moon orb behind text) */}
      <div aria-hidden="true" className="nostos-plate-backdrop pointer-events-none absolute inset-0">
        <div className="nostos-horizon-line" />
        <div className="nostos-water-path" />
        <div className="nostos-fog-layer-1" />
        <div className="nostos-vignette" />
      </div>

      {/* Content Scrim */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--hero-muted)]"
          >
            {breadcrumb.map((b, i) => (
              <span key={`${b.label}-${i}`} className="inline-flex items-center gap-2">
                {i > 0 && <span aria-hidden="true">/</span>}
                {b.href ? (
                  <Link href={localePath(b.href)} className="nostos-link hover:text-[var(--gold)]">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-[var(--gold)]">{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        <p className="nostos-overline text-[var(--accent)]">{overline}</p>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="nostos-display-h1 text-[clamp(2rem,4.2vw,3.4rem)] text-[var(--hero-text)]">
              {title}
            </h1>
            {subtitle && (
              <p className="nostos-editorial-italic mt-2 text-lg text-[var(--hero-muted)]">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
      </div>

      {/* Bottom 14px letterbox bar */}
      <div aria-hidden="true" className="h-[14px] w-full bg-[#020304]" />
    </section>
  );
}

/**
 * Editorial Section Chapter Header:
 * Roman numeral (I, II, III, IV...) + wide-tracked English label + Bangla/English title
 */
export function ChapterHeading({
  roman,
  overline,
  title,
  subtitle,
  action,
}: {
  roman: string;
  overline: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--hair)] pb-4">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="nostos-editorial-italic text-base tracking-[0.14em] text-[var(--gold)]">
            {roman}
          </span>
          <span aria-hidden="true" className="text-[var(--hair)]">
            —
          </span>
          <span className="nostos-overline text-[var(--accent)]">{overline}</span>
        </div>
        <h2 className="nostos-display-h2 mt-2 text-[clamp(1.75rem,3.2vw,2.75rem)] text-[var(--text)]">
          {title}
        </h2>
        {subtitle && (
          <p className="nostos-editorial-italic mt-1 text-base text-[var(--text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
