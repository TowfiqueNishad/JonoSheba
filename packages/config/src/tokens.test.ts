import { describe, expect, it } from 'vitest';
import { colors, nostosThemes, spacing, typography } from './tokens';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Design Tokens (WCAG AA & Bangla typography)', () => {
  it('meets WCAG AA (>= 4.5:1) for NOSTOS night & day text, accents, and 999 emergency button', () => {
    const { night, day } = nostosThemes;

    // Night ("Steel & Gold") theme contrast on page/surface
    expect(contrastRatio(night.text, night.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(night.textMuted, night.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(night.heroText, night.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(night.accent, night.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(night.gold, night.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(night.emergencyText, night.emergencyRed)).toBeGreaterThanOrEqual(4.5);

    // Day ("Bleached Light") theme contrast on page/surface
    expect(contrastRatio(day.text, day.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(day.textMuted, day.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(day.heroText, day.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(day.accent, day.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(day.gold, day.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(day.emergencyText, day.emergencyRed)).toBeGreaterThanOrEqual(4.5);

    // Core dark surface tokens
    const bg = colors.surface.background;
    expect(contrastRatio(colors.brand.primary, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.text.primary, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.text.secondary, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.text.muted, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.semantic.success, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.semantic.info, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.semantic.warning, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('includes Bangla-first fonts and >= 1.6 line-height', () => {
    expect(typography.fontFamily.bangla).toContain('Anek Bangla');
    expect(typography.fontFamily.bangla).toContain('Noto Sans Bengali');
    expect(typography.fontFamily.sans).toContain('Anek Bangla');
    expect(typography.fontFamily.sans).toContain('Montserrat');
    expect(typography.lineHeight.normal).toBeGreaterThanOrEqual(1.6);
  });

  it('exposes 48px touch target spacing token', () => {
    expect(spacing[12]).toBe('48px');
  });
});
