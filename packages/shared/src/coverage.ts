import { z } from 'zod';
import { TrustLabel } from './enums';

export const NameHistoryEntrySchema = z.object({
  oldNameBn: z.string().min(1),
  oldNameEn: z.string().min(1),
  validFrom: z.string(),
  validTo: z.string().nullable().optional(),
});
export type NameHistoryEntry = z.infer<typeof NameHistoryEntrySchema>;

export const SourceRecordSchema = z.object({
  id: z.string().min(3),
  name: z.string().min(2),
  agency: z.string().min(2),
  url: z.string().url(),
  kind: z.enum(['OFFICIAL_SITE', 'OFFICIAL_PDF', 'OPEN_DATASET', 'PARTNER_FEED', 'ADMIN_CITED']),
  licence: z.string().min(2),
  attribution: z.string().min(2),
  freshnessSlaDays: z.number().int().min(1),
  lastCheckedAt: z.string(),
  status: z.enum(['HEALTHY', 'DEGRADED', 'ERROR']),
});
export type SourceRecord = z.infer<typeof SourceRecordSchema>;

export type FreshnessEntityType =
  | 'hotline'
  | 'fee_or_eligibility'
  | 'rail_schedule'
  | 'office_contact'
  | 'notice'
  | 'disaster_alert';

/** Coverage Rule C5: Freshness SLAs in days */
export const FRESHNESS_SLA_DAYS: Record<FreshnessEntityType, number> = {
  hotline: 30,
  fee_or_eligibility: 90,
  rail_schedule: 30,
  office_contact: 180,
  notice: 30,
  disaster_alert: 1,
};

export interface FreshnessEvaluation {
  isStale: boolean;
  ageDays: number;
  slaDays: number;
  effectiveTrustLabel: TrustLabel;
}

/**
 * Evaluates record freshness against Coverage Rule C5 SLAs.
 * Past SLA or past explicit `expiresAt` automatically flags UNAVAILABLE_STALE.
 */
export function evaluateFreshness(params: {
  entityType: FreshnessEntityType;
  lastVerifiedAt: string | null | undefined;
  baseTrustLabel: TrustLabel;
  expiresAt?: string | null;
  now?: Date;
}): FreshnessEvaluation {
  const now = params.now ?? new Date();
  const slaDays = FRESHNESS_SLA_DAYS[params.entityType];

  if (params.expiresAt) {
    const exp = new Date(params.expiresAt);
    if (!Number.isNaN(exp.getTime()) && now.getTime() > exp.getTime()) {
      return {
        isStale: true,
        ageDays: slaDays + 1,
        slaDays,
        effectiveTrustLabel: TrustLabel.UNAVAILABLE_STALE,
      };
    }
  }

  if (!params.lastVerifiedAt) {
    return {
      isStale: true,
      ageDays: Infinity,
      slaDays,
      effectiveTrustLabel: TrustLabel.UNAVAILABLE_STALE,
    };
  }

  const verified = new Date(params.lastVerifiedAt);
  if (Number.isNaN(verified.getTime())) {
    return {
      isStale: true,
      ageDays: Infinity,
      slaDays,
      effectiveTrustLabel: TrustLabel.UNAVAILABLE_STALE,
    };
  }

  const ageDays = Math.max(0, Math.floor((now.getTime() - verified.getTime()) / 86_400_000));
  const isStale = ageDays > slaDays;
  return {
    isStale,
    ageDays,
    slaDays,
    effectiveTrustLabel: isStale ? TrustLabel.UNAVAILABLE_STALE : params.baseTrustLabel,
  };
}

/** Rule C6: Standard bilingual fraud warning for ticketing & payment hand-offs */
export const OFFICIAL_HANDOFF_FRAUD_WARNING = {
  bn: 'সতর্কতা: শুধুমাত্র যাচাইকৃত অফিসিয়াল সরকারি চ্যানেলে টিকিট বা ফি পরিশোধ করুন। অচেনা ফেসবুক পেজ বা অননুমোদিত সাইটে পিন/ওটিপি/কার্ড নম্বর দেবেন না।',
  en: 'Fraud warning: Buy tickets or pay fees ONLY on the verified official channel. Never share PINs, OTPs, or card details on unofficial websites or Facebook pages.',
} as const;

/** Rule C7: Required OpenStreetMap ODbL attribution string */
export const OSM_ODBL_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)' as const;
