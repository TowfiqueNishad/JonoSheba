import type { CSSProperties, ReactNode } from 'react';
import { nostosThemes, radii } from '@jonoshheba/config';
import {
  AvailabilityState,
  DEFAULT_LOCALE,
  TrustLabel,
  getDictionary,
  type Locale,
} from '@jonoshheba/shared';

export const ROMAN_NUMERALS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
  'XVI',
  'XVII',
  'XVIII',
  'XIX',
  'XX',
] as const;

export function toRomanNumeral(indexOneBased: number): string {
  return ROMAN_NUMERALS[indexOneBased - 1] ?? String(indexOneBased);
}

/**
 * WCAG 2.2 AA relative luminance & contrast ratio calculator
 * Used by automated contrast tests to verify all NIGHT and DAY token pairs >= 4.5:1.
 */
export function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHexRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function calculateContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export interface TrustBadgeProps {
  label: TrustLabel;
  locale?: Locale;
  lastVerifiedAt?: string | null;
  pending?: boolean;
}

/**
 * NOSTOS Trust Tag:
 * - Official/verified = steel-blue outline
 * - Pending = dashed gold outline
 * - Unknown/stale = hairline grey outline
 * - Wide-tracked small caps
 */
export function TrustBadge({
  label,
  locale = DEFAULT_LOCALE,
  lastVerifiedAt,
  pending = false,
}: TrustBadgeProps) {
  const dict = getDictionary(locale);
  const isPending = pending || !lastVerifiedAt;
  const borderStyle = isPending
    ? `1px dashed ${nostosThemes.night.gold}`
    : label === TrustLabel.UNAVAILABLE_STALE
      ? `1px solid ${nostosThemes.night.hair}`
      : `1px solid ${nostosThemes.night.accent}`;

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 9px',
    borderRadius: radii.sm,
    border: borderStyle,
    backgroundColor: 'transparent',
    color: isPending ? 'var(--gold)' : 'var(--accent)',
    fontSize: '0.6875rem',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    fontWeight: 600,
  };

  return (
    <span style={style} data-trust-label={label}>
      <span>{isPending ? dict.trust.VERIFICATION_PENDING : dict.trust[label]}</span>
      {!isPending && lastVerifiedAt ? <span style={{ opacity: 0.8 }}>· {lastVerifiedAt}</span> : null}
    </span>
  );
}

export interface AvailabilityBadgeProps {
  state: AvailabilityState;
  locale?: Locale;
}

export function AvailabilityBadge({ state, locale = DEFAULT_LOCALE }: AvailabilityBadgeProps) {
  const dict = getDictionary(locale);
  const isError =
    state === AvailabilityState.SOLD_OUT || state === AvailabilityState.PROVIDER_ERROR;
  const isPending = state === AvailabilityState.LIMITED;
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 9px',
    borderRadius: radii.sm,
    border: isError
      ? '1px solid #B3261E'
      : isPending
        ? '1px dashed var(--gold)'
        : '1px solid var(--hair)',
    color: isError ? '#B3261E' : isPending ? 'var(--gold)' : 'var(--text-muted)',
    fontSize: '0.6875rem',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    fontWeight: 600,
  };

  return (
    <span style={style} data-availability-state={state}>
      {dict.availability[state]}
    </span>
  );
}

export interface EmergencyStripProps {
  locale?: Locale;
}

/** R8 & NOSTOS Safety Rule: Solid #B3261E 999 button with white text */
export function EmergencyStrip({ locale = DEFAULT_LOCALE }: EmergencyStripProps) {
  const dict = getDictionary(locale);
  return (
    <aside
      role="region"
      aria-label={dict.emergency.bannerTitle}
      style={{
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--hair)',
        padding: '10px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        color: 'var(--text)',
      }}
    >
      <strong style={{ color: 'var(--text)', letterSpacing: '0.04em' }}>
        {dict.emergency.bannerTitle}
      </strong>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <a
          href="tel:999"
          style={{
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 16px',
            borderRadius: radii.full,
            backgroundColor: '#B3261E',
            color: '#FFFFFF',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          {dict.emergency.call999}
        </a>
        <a
          href="tel:333"
          style={{
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 16px',
            borderRadius: radii.sm,
            border: '1px solid var(--gold-line)',
            color: 'var(--text)',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {dict.emergency.call333}
        </a>
      </div>
    </aside>
  );
}

export interface DisclaimerFooterProps {
  locale?: Locale;
}

/** R11: Independent branding disclaimer footer in NOSTOS hairline style */
export function DisclaimerFooter({ locale = DEFAULT_LOCALE }: DisclaimerFooterProps) {
  const dict = getDictionary(locale);
  return (
    <footer
      style={{
        borderTop: '1px solid var(--hair)',
        backgroundColor: 'var(--page)',
        padding: '24px 16px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.75rem',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
      }}
    >
      <p style={{ margin: 0, fontWeight: 600 }}>{dict.app.disclaimer}</p>
    </footer>
  );
}

export interface NostosSectionHeadingProps {
  roman: string;
  overlineEn: string;
  titleBnOrEn: string;
  subtitle?: string;
  rightSlot?: ReactNode;
}

export function NostosSectionHeading({
  roman,
  overlineEn,
  titleBnOrEn,
  subtitle,
  rightSlot,
}: NostosSectionHeadingProps) {
  return (
    <div
      style={{
        borderBottom: '1px solid var(--hair)',
        paddingBottom: '16px',
        marginBottom: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: '16px',
      }}
    >
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.6875rem',
            letterSpacing: '0.38em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-cormorant, "Cormorant Garamond"), Georgia, serif',
              fontStyle: 'italic',
              fontSize: '1rem',
              letterSpacing: '0.12em',
              color: 'var(--gold)',
            }}
          >
            {roman}
          </span>
          <span aria-hidden="true">—</span>
          <span>{overlineEn}</span>
        </div>
        <h2
          style={{
            marginTop: '8px',
            fontSize: 'clamp(1.75rem, 3.4vw, 3rem)',
            lineHeight: 1.08,
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          {titleBnOrEn}
        </h2>
        {subtitle ? (
          <p
            style={{
              marginTop: '6px',
              fontFamily: 'var(--font-cormorant, "Cormorant Garamond"), Georgia, serif',
              fontStyle: 'italic',
              fontSize: '1.125rem',
              color: 'var(--text-muted)',
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {rightSlot}
    </div>
  );
}
