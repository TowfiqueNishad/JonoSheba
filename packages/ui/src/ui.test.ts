import { describe, expect, it } from 'vitest';
import { nostosThemes } from '@jonoshheba/config';
import { calculateContrastRatio, toRomanNumeral } from './components';

describe('NOSTOS Design System — Colour Grade, Contrast >= 4.5:1 & Typography Primitives', () => {
  it('enforces WCAG 2.2 AA contrast ratio (>= 4.5:1) on every NIGHT ("Steel & Gold") text/background pair', () => {
    const n = nostosThemes.night;
    expect(calculateContrastRatio(n.text, n.page)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(n.text, n.surface)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(n.text, n.surface2)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(n.textMuted, n.page)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(n.textMuted, n.surface)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(n.heroText, n.page)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(n.heroMuted, n.page)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(n.accent, n.page)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(n.gold, n.page)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(n.gold, n.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('enforces WCAG 2.2 AA contrast ratio (>= 4.5:1) on every DAY ("Bleached Light") text/background pair', () => {
    const d = nostosThemes.day;
    expect(calculateContrastRatio(d.text, d.page)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(d.text, d.surface)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(d.textMuted, d.page)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(d.textMuted, d.surface)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(d.heroText, d.page)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(d.heroMuted, d.page)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(d.accent, d.page)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(d.gold, d.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('enforces Safety Rule: 999 emergency button (#B3261E with #FFFFFF text) has >= 4.5:1 contrast in both themes', () => {
    expect(nostosThemes.night.emergencyRed).toBe('#B3261E');
    expect(nostosThemes.day.emergencyRed).toBe('#B3261E');
    expect(
      calculateContrastRatio(nostosThemes.night.emergencyText, nostosThemes.night.emergencyRed),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('formats chapter Roman numerals I through XX', () => {
    expect(toRomanNumeral(1)).toBe('I');
    expect(toRomanNumeral(4)).toBe('IV');
    expect(toRomanNumeral(12)).toBe('XII');
  });
});
