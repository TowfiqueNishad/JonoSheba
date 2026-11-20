import { describe, expect, it } from 'vitest';
import { colors, spacing, typography } from './tokens';

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
  it('meets WCAG AA (>= 4.5:1) for primary brand and semantic text colors on white', () => {
    const white = colors.surface.background;
    expect(contrastRatio(colors.brand.primary, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.brand.secondary, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.text.primary, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.text.secondary, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.text.muted, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.semantic.success, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.semantic.danger, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.semantic.info, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.semantic.warning, colors.semantic.warningSoft)).toBeGreaterThanOrEqual(4.5);
  });

  it('includes Bangla-first fonts and >= 1.6 line-height', () => {
    expect(typography.fontFamily.sans).toContain('Noto Sans Bengali');
    expect(typography.fontFamily.sans).toContain('Hind Siliguri');
    expect(typography.fontFamily.sans).toContain('Inter');
    expect(typography.lineHeight.normal).toBeGreaterThanOrEqual(1.6);
  });

  it('exposes 48px touch target spacing token', () => {
    expect(spacing[12]).toBe('48px');
  });
});
