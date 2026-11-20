import type { Role } from '@jonoshheba/shared';

export type PlatformType = 'web' | 'ios' | 'android';

export interface RoleAssignment {
  role: Role;
  orgId: string | null;
}

export interface UserEntity {
  id: string;
  phoneE164: string | null;
  email: string | null;
  emailVerifiedAt: Date | null;
  passwordHash: string | null;
  displayName: string | null;
  status: 'active' | 'suspended' | 'pending_deletion' | 'deleted';
  locale: 'bn' | 'en';
  isGuest: boolean;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  mfaBackupCodeHashes: string[];
  roles: RoleAssignment[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface SessionEntity {
  id: string;
  userId: string;
  deviceId: string;
  platform: PlatformType;
  refreshTokenHash: string;
  tokenFamilyId: string;
  ipHash: string | null;
  userAgent: string | null;
  mfaVerified: boolean;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OtpChallengeEntity {
  id: string;
  phoneE164: string;
  codeHash: string;
  purpose: 'login' | 'verify_phone';
  attempts: number;
  maxAttempts: number;
  ipHash: string | null;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface PasswordResetTokenEntity {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface EmailVerificationTokenEntity {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface UserPreferenceEntity {
  userId: string;
  language: 'bn' | 'en';
  numeralStyle: 'bn' | 'en';
  notificationChannels: {
    in_app: boolean;
    web_push: boolean;
    mobile_push: boolean;
    email: boolean;
    sms: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: 'Asia/Dhaka';
  };
  accessibility: {
    font_scale: number;
    high_contrast: boolean;
    voice_first: boolean;
    low_data: boolean;
  };
  updatedAt: Date;
}

export type ConsentPurpose =
  | 'profile_hint_age_band'
  | 'profile_hint_location'
  | 'profile_hint_occupation'
  | 'profile_hint_student_level'
  | 'profile_hint_disability'
  | 'assistant_long_term_memory'
  | 'notifications_sms'
  | 'notifications_email';

export interface ConsentEntity {
  id: string;
  userId: string;
  purpose: ConsentPurpose;
  version: string;
  grantedAt: Date;
  withdrawnAt: Date | null;
  ipHash: string | null;
}

export interface UserProfileHintEntity {
  userId: string;
  ageBand: string | null;
  ageBandConsentId: string | null;
  divisionId: string | null;
  districtId: string | null;
  upazilaId: string | null;
  locationConsentId: string | null;
  occupationBand: string | null;
  occupationConsentId: string | null;
  studentLevel: string | null;
  studentConsentId: string | null;
  hasDisability: boolean | null;
  disabilityConsentId: string | null;
  updatedAt: Date;
}

export interface DataExportRequestEntity {
  id: string;
  userId: string;
  status: 'requested' | 'processing' | 'ready' | 'completed' | 'failed';
  signedDownloadUrl: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface DeletionRequestEntity {
  id: string;
  userId: string;
  status: 'requested' | 'completed' | 'cancelled';
  requestedAt: Date;
  graceUntil: Date;
  completedAt: Date | null;
}

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  roles: Role[];
  orgScopes: RoleAssignment[];
  isGuest: boolean;
  mfaVerified: boolean;
  locale: 'bn' | 'en';
}

/** R9: Explicit bilingual purpose metadata returned for every optional profile hint field */
export const PROFILE_HINT_METADATA = {
  ageBand: {
    consentPurpose: 'profile_hint_age_band' as ConsentPurpose,
    purpose_bn: 'বয়সভিত্তিক সরকারি ভাতা, বৃত্তি ও চাকরির বয়সসীমা যাচাইয়ে সাহায্য করার জন্য।',
    purpose_en: 'Used to highlight age-relevant benefits, scholarships, and job eligibility ranges.',
    retention_days: 365,
  },
  location: {
    consentPurpose: 'profile_hint_location' as ConsentPurpose,
    purpose_bn: 'আপনার জেলা ও উপজেলার সরকারি অফিস, জরুরি সতর্কতা ও স্থানীয় নোটিশ দেখানোর জন্য।',
    purpose_en: 'Used to show nearby service offices, district notices, and disaster/outage alerts.',
    retention_days: 365,
  },
  occupationBand: {
    consentPurpose: 'profile_hint_occupation' as ConsentPurpose,
    purpose_bn: 'কৃষি প্রণোদনা, যুব ঋণ বা প্রবাসী সেবার মতো প্রাসঙ্গিক কর্মসূচি সাজাতে।',
    purpose_en: 'Used to surface relevant programs such as farmer subsidies or youth loans.',
    retention_days: 365,
  },
  studentLevel: {
    consentPurpose: 'profile_hint_student_level' as ConsentPurpose,
    purpose_bn: 'আপনার শ্রেণি বা স্তরের উপযোগী উপবৃত্তি ও ভর্তি সময়সূচি দেখানোর জন্য।',
    purpose_en: 'Used to match stipends, scholarships, and admission calendars to your education level.',
    retention_days: 365,
  },
  hasDisability: {
    consentPurpose: 'profile_hint_disability' as ConsentPurpose,
    purpose_bn: 'সুবর্ণ নাগরিক কার্ড, প্রতিবন্ধী ভাতা ও শিক্ষা উপবৃত্তি তথ্য অগ্রাধিকার দিতে।',
    purpose_en: 'Used to surface disability ID, allowance, and education stipend options with your consent.',
    retention_days: 365,
  },
} as const;
