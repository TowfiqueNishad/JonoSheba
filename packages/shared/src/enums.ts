import { z } from 'zod';

/** R5: Mandatory provenance trust label on every citizen-facing fact */
export const TrustLabel = {
  OFFICIAL_SOURCE: 'OFFICIAL_SOURCE',
  VERIFIED_BY_JONOSHHEBA: 'VERIFIED_BY_JONOSHHEBA',
  PARTNER_PROVIDED: 'PARTNER_PROVIDED',
  COMMUNITY_REPORT: 'COMMUNITY_REPORT',
  UNAVAILABLE_STALE: 'UNAVAILABLE_STALE',
} as const;
export type TrustLabel = (typeof TrustLabel)[keyof typeof TrustLabel];
export const TrustLabelSchema = z.nativeEnum(TrustLabel);

/** R6: Honest transport & inventory availability state machine */
export const AvailabilityState = {
  AVAILABLE: 'AVAILABLE',
  LIMITED: 'LIMITED',
  SOLD_OUT: 'SOLD_OUT',
  UNKNOWN_STALE: 'UNKNOWN_STALE',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
} as const;
export type AvailabilityState = (typeof AvailabilityState)[keyof typeof AvailabilityState];
export const AvailabilityStateSchema = z.nativeEnum(AvailabilityState);

/** R2: Explicit external provider adapter integration classification */
export const IntegrationType = {
  OFFICIAL_API: 'OFFICIAL_API',
  PARTNER_FEED: 'PARTNER_FEED',
  PERMITTED_FEED: 'PERMITTED_FEED',
  MANUAL: 'MANUAL',
  LINK_ONLY: 'LINK_ONLY',
  MOCK: 'MOCK',
} as const;
export type IntegrationType = (typeof IntegrationType)[keyof typeof IntegrationType];
export const IntegrationTypeSchema = z.nativeEnum(IntegrationType);

/** R2: Only OFFICIAL_API, PARTNER_FEED, or PERMITTED_FEED may be labelled "live" */
export const LIVE_INTEGRATION_TYPES: ReadonlySet<IntegrationType> = new Set([
  IntegrationType.OFFICIAL_API,
  IntegrationType.PARTNER_FEED,
  IntegrationType.PERMITTED_FEED,
]);

export function isLiveIntegrationType(type: IntegrationType): boolean {
  return LIVE_INTEGRATION_TYPES.has(type);
}

/** Module 2: Ticket watch lifecycle status */
export const WatchStatus = {
  ACTIVE: 'active',
  MATCHED: 'matched',
  NOTIFIED: 'notified',
  PAUSED: 'paused',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  ERROR: 'error',
} as const;
export type WatchStatus = (typeof WatchStatus)[keyof typeof WatchStatus];
export const WatchStatusSchema = z.nativeEnum(WatchStatus);

/** Module 5: Citizen complaint / support case lifecycle status */
export const CaseStatus = {
  DRAFT: 'draft',
  READY: 'ready',
  SUBMITTED_EXTERNALLY: 'submitted_externally',
  REF_SAVED: 'ref_saved',
  CLOSED: 'closed',
} as const;
export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];
export const CaseStatusSchema = z.nativeEnum(CaseStatus);

/** Identity RBAC roles */
export const Role = {
  GUEST: 'guest',
  CITIZEN: 'citizen',
  ORG_MEMBER: 'org_member',
  CONTENT_EDITOR: 'content_editor',
  REVIEWER: 'reviewer',
  MODERATOR: 'moderator',
  SUPPORT_AGENT: 'support_agent',
  PLATFORM_ADMIN: 'platform_admin',
  AGENCY_PARTNER: 'agency_partner',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const RoleSchema = z.nativeEnum(Role);

/** Notification & communication channels */
export const Channel = {
  IN_APP: 'in_app',
  WEB_PUSH: 'web_push',
  MOBILE_PUSH: 'mobile_push',
  EMAIL: 'email',
  SMS: 'sms',
  WHATSAPP: 'whatsapp',
  USSD: 'ussd',
  IVR: 'ivr',
} as const;
export type Channel = (typeof Channel)[keyof typeof Channel];
export const ChannelSchema = z.nativeEnum(Channel);

/** Supported UI & API locales (bn is default) */
export const Locale = {
  BN: 'bn',
  EN: 'en',
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];
export const LocaleSchema = z.nativeEnum(Locale);
export const DEFAULT_LOCALE: Locale = Locale.BN;
