import { describe, expect, it } from 'vitest';
import { AvailabilityBadge, DisclaimerFooter, EmergencyStrip, TrustBadge } from './components';

describe('@jonoshheba/ui exports', () => {
  it('exports core compliance UI components (R5, R6, R8, R11)', () => {
    expect(typeof TrustBadge).toBe('function');
    expect(typeof AvailabilityBadge).toBe('function');
    expect(typeof EmergencyStrip).toBe('function');
    expect(typeof DisclaimerFooter).toBe('function');
  });
});
