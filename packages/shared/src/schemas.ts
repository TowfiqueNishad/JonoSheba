import { z } from 'zod';
import {
  AvailabilityState,
  AvailabilityStateSchema,
  IntegrationTypeSchema,
  LocaleSchema,
  TrustLabelSchema,
} from './enums';

/** R5: Required attribution payload accompanying every citizen-facing fact */
export const TrustAttributionSchema = z.object({
  trustLabel: TrustLabelSchema,
  sourceUrl: z.string().url().nullable(),
  agency: z.string().min(1),
  lastVerifiedAt: z.string().datetime().nullable(),
});
export type TrustAttribution = z.infer<typeof TrustAttributionSchema>;

/** RFC 9457 Problem Details error payload */
export const ProblemDetailsSchema = z.object({
  type: z.string().default('about:blank'),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  requestId: z.string().optional(),
  errors: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

/** Cursor pagination metadata */
export const CursorPageMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  prevCursor: z.string().nullable().optional(),
  hasMore: z.boolean(),
  limit: z.number().int().positive(),
});
export type CursorPageMeta = z.infer<typeof CursorPageMetaSchema>;

/** Health check response contract shared across services */
export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  service: z.string(),
  version: z.string(),
  timestamp: z.string().datetime(),
  timezone: z.literal('Asia/Dhaka'),
  checks: z.record(z.enum(['ok', 'degraded', 'down', 'skipped'])).optional(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/** R6: Availability observation contract */
export const AvailabilityObservationSchema = z.object({
  providerId: z.string().min(1),
  integrationType: IntegrationTypeSchema,
  state: AvailabilityStateSchema,
  seatsAvailable: z.number().int().nonnegative().nullable(),
  checkedAt: z.string().datetime(),
  isLive: z.boolean(),
  disclaimerKey: z.literal('transport.notReservedNotice'),
});
export type AvailabilityObservation = z.infer<typeof AvailabilityObservationSchema>;

/**
 * R6 Guard: Safely resolves an availability state from raw check status & staleness.
 * Stale or errored provider responses MUST NEVER be downgraded to SOLD_OUT.
 */
export function resolveHonestAvailabilityState(input: {
  providerErrored: boolean;
  isStale: boolean;
  seatsAvailable: number | null;
  limitedThreshold?: number;
}): AvailabilityState {
  if (input.providerErrored) {
    return AvailabilityState.PROVIDER_ERROR;
  }
  if (input.isStale || input.seatsAvailable === null) {
    return AvailabilityState.UNKNOWN_STALE;
  }
  if (input.seatsAvailable <= 0) {
    return AvailabilityState.SOLD_OUT;
  }
  const threshold = input.limitedThreshold ?? 5;
  if (input.seatsAvailable <= threshold) {
    return AvailabilityState.LIMITED;
  }
  return AvailabilityState.AVAILABLE;
}

export const LocaleHeaderSchema = LocaleSchema.default('bn');
