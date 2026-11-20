-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "admin";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ai";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "audit";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "cases";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "catalogue";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "identity";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "notify";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "opportunities";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "transport";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "identity"."UserStatus" AS ENUM ('active', 'suspended', 'pending_deletion', 'deleted');

-- CreateEnum
CREATE TYPE "identity"."Platform" AS ENUM ('web', 'ios', 'android');

-- CreateEnum
CREATE TYPE "identity"."OrgStatus" AS ENUM ('pending', 'verified', 'suspended');

-- CreateEnum
CREATE TYPE "identity"."MalwareScanStatus" AS ENUM ('pending', 'clean', 'infected', 'failed');

-- CreateEnum
CREATE TYPE "identity"."OcrStatus" AS ENUM ('not_requested', 'pending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "catalogue"."TrustLabel" AS ENUM ('OFFICIAL_SOURCE', 'VERIFIED_BY_JONOSHHEBA', 'PARTNER_PROVIDED', 'COMMUNITY_REPORT', 'UNAVAILABLE_STALE');

-- CreateEnum
CREATE TYPE "catalogue"."ContentStatus" AS ENUM ('draft', 'in_review', 'published', 'archived');

-- CreateEnum
CREATE TYPE "catalogue"."NoticeKind" AS ENUM ('circular', 'deadline', 'outage', 'disaster', 'health', 'exam');

-- CreateEnum
CREATE TYPE "catalogue"."FacilityType" AS ENUM ('hospital', 'clinic', 'diagnostic', 'shelter', 'police', 'fire', 'utility_office');

-- CreateEnum
CREATE TYPE "catalogue"."ContentReportStatus" AS ENUM ('open', 'in_review', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "catalogue"."ReminderStatus" AS ENUM ('scheduled', 'sent', 'cancelled');

-- CreateEnum
CREATE TYPE "transport"."TransportMode" AS ENUM ('train', 'bus', 'launch', 'flight', 'metro');

-- CreateEnum
CREATE TYPE "transport"."IntegrationType" AS ENUM ('OFFICIAL_API', 'PARTNER_FEED', 'PERMITTED_FEED', 'MANUAL', 'LINK_ONLY', 'MOCK');

-- CreateEnum
CREATE TYPE "transport"."ProviderStatus" AS ENUM ('active', 'degraded', 'disabled');

-- CreateEnum
CREATE TYPE "transport"."WatchStatus" AS ENUM ('active', 'matched', 'notified', 'paused', 'expired', 'cancelled', 'error');

-- CreateEnum
CREATE TYPE "transport"."AvailabilityState" AS ENUM ('AVAILABLE', 'LIMITED', 'SOLD_OUT', 'UNKNOWN_STALE', 'PROVIDER_ERROR');

-- CreateEnum
CREATE TYPE "transport"."MatchQuality" AS ENUM ('exact', 'partial');

-- CreateEnum
CREATE TYPE "notify"."NotificationChannel" AS ENUM ('in_app', 'web_push', 'mobile_push', 'email', 'sms', 'whatsapp', 'ussd', 'ivr');

-- CreateEnum
CREATE TYPE "notify"."NotificationPriority" AS ENUM ('P0', 'P1', 'P2', 'P3');

-- CreateEnum
CREATE TYPE "notify"."NotificationJobStatus" AS ENUM ('queued', 'sending', 'sent', 'delivered', 'failed', 'dlq', 'suppressed');

-- CreateEnum
CREATE TYPE "opportunities"."OpportunityTargetType" AS ENUM ('program', 'scholarship', 'job');

-- CreateEnum
CREATE TYPE "opportunities"."OpportunityStatus" AS ENUM ('draft', 'in_review', 'published', 'expired', 'archived');

-- CreateEnum
CREATE TYPE "cases"."CaseType" AS ENUM ('support', 'external_complaint');

-- CreateEnum
CREATE TYPE "cases"."CaseStatus" AS ENUM ('draft', 'ready', 'submitted_externally', 'ref_saved', 'closed');

-- CreateEnum
CREATE TYPE "ai"."KbDocStatus" AS ENUM ('pending', 'indexed', 'superseded', 'archived');

-- CreateEnum
CREATE TYPE "ai"."MessageRole" AS ENUM ('user', 'assistant', 'system', 'tool');

-- CreateEnum
CREATE TYPE "audit"."DataRequestStatus" AS ENUM ('requested', 'processing', 'ready', 'completed', 'cancelled', 'failed');

-- CreateTable
CREATE TABLE "identity"."users" (
    "id" UUID NOT NULL,
    "phone_e164" TEXT,
    "email" TEXT,
    "password_hash" TEXT,
    "display_name" TEXT,
    "status" "identity"."UserStatus" NOT NULL DEFAULT 'active',
    "locale" VARCHAR(8) NOT NULL DEFAULT 'bn',
    "is_guest" BOOLEAN NOT NULL DEFAULT false,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret_enc" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."identity_providers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "identity_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "platform" "identity"."Platform" NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "token_family_id" UUID NOT NULL,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."otp_challenges" (
    "id" UUID NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "purpose" VARCHAR(32) NOT NULL DEFAULT 'login',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "ip_hash" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name_bn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "requires_mfa" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."organizations" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_bn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "org_type" VARCHAR(40) NOT NULL,
    "status" "identity"."OrgStatus" NOT NULL DEFAULT 'pending',
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "org_id" UUID,
    "granted_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."user_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "language" VARCHAR(8) NOT NULL DEFAULT 'bn',
    "numeral_style" VARCHAR(8) NOT NULL DEFAULT 'bn',
    "notification_channels" JSONB NOT NULL DEFAULT '{"in_app":true,"web_push":true,"mobile_push":true,"email":false,"sms":false}',
    "quiet_hours" JSONB NOT NULL DEFAULT '{"enabled":false,"start":"23:00","end":"06:00","timezone":"Asia/Dhaka"}',
    "accessibility" JSONB NOT NULL DEFAULT '{"font_scale":100,"high_contrast":false,"voice_first":false,"low_data":false}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" VARCHAR(80) NOT NULL,
    "version" VARCHAR(24) NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMPTZ(6),
    "ip_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."user_profile_hints" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "age_band" VARCHAR(32),
    "age_band_consent_id" UUID,
    "division_id" UUID,
    "district_id" UUID,
    "upazila_id" UUID,
    "location_consent_id" UUID,
    "occupation_band" VARCHAR(64),
    "occupation_consent_id" UUID,
    "student_level" VARCHAR(48),
    "student_consent_id" UUID,
    "has_disability" BOOLEAN,
    "disability_consent_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_profile_hints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" "identity"."Platform" NOT NULL,
    "push_token" TEXT NOT NULL,
    "device_label" TEXT,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."documents" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "mime" VARCHAR(128) NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "document_type" VARCHAR(64) NOT NULL,
    "malware_scan_status" "identity"."MalwareScanStatus" NOT NULL DEFAULT 'pending',
    "ocr_status" "identity"."OcrStatus" NOT NULL DEFAULT 'not_requested',
    "retention_until" TIMESTAMPTZ(6) NOT NULL,
    "encrypted_dek" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."divisions" (
    "id" UUID NOT NULL,
    "bbs_code" VARCHAR(8) NOT NULL,
    "name_bn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "bbox" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."districts" (
    "id" UUID NOT NULL,
    "division_id" UUID NOT NULL,
    "bbs_code" VARCHAR(8) NOT NULL,
    "name_bn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "bbox" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."upazilas" (
    "id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "bbs_code" VARCHAR(12) NOT NULL,
    "name_bn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "bbox" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "upazilas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."unions_wards" (
    "id" UUID NOT NULL,
    "upazila_id" UUID NOT NULL,
    "bbs_code" VARCHAR(16) NOT NULL,
    "name_bn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "kind" VARCHAR(24) NOT NULL DEFAULT 'union',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "bbox" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "unions_wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."service_categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "slug" TEXT NOT NULL,
    "name_bn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "icon" VARCHAR(64),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."life_events" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title_bn" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "summary_bn" TEXT NOT NULL,
    "summary_en" TEXT NOT NULL,
    "icon" VARCHAR(64),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "catalogue"."ContentStatus" NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "life_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."life_event_steps" (
    "id" UUID NOT NULL,
    "life_event_id" UUID NOT NULL,
    "service_id" UUID,
    "step_order" INTEGER NOT NULL,
    "title_bn" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "notes_bn" TEXT,
    "notes_en" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "life_event_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."agencies" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_bn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "agency_type" VARCHAR(40) NOT NULL DEFAULT 'government',
    "official_url" TEXT,
    "contact_phone" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."sources" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "source_type" VARCHAR(40) NOT NULL,
    "content_hash" VARCHAR(64),
    "fetched_at" TIMESTAMPTZ(6),
    "verified_at" TIMESTAMPTZ(6),
    "valid_from" TIMESTAMPTZ(6),
    "valid_to" TIMESTAMPTZ(6),
    "reviewer_id" UUID,
    "trust_label" "catalogue"."TrustLabel" NOT NULL DEFAULT 'OFFICIAL_SOURCE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."services" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title_bn" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "summary_bn" TEXT NOT NULL,
    "summary_en" TEXT NOT NULL,
    "description_md_bn" TEXT NOT NULL,
    "description_md_en" TEXT NOT NULL,
    "agency_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "delivery_channels" TEXT[] DEFAULT ARRAY['online']::TEXT[],
    "official_url" TEXT NOT NULL,
    "fee_info" JSONB NOT NULL DEFAULT '{}',
    "processing_time" TEXT,
    "status" "catalogue"."ContentStatus" NOT NULL DEFAULT 'draft',
    "trust_label" "catalogue"."TrustLabel" NOT NULL DEFAULT 'OFFICIAL_SOURCE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "last_verified_at" TIMESTAMPTZ(6),
    "verified_by" UUID,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."service_versions" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "change_summary" TEXT,
    "author_id" UUID,
    "reviewer_id" UUID,
    "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."service_requirements" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "document_name_bn" TEXT NOT NULL,
    "document_name_en" TEXT NOT NULL,
    "eligibility_rule_ref" TEXT,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "notes_bn" TEXT,
    "notes_en" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."service_steps" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "title_bn" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "instruction_bn" TEXT NOT NULL,
    "instruction_en" TEXT NOT NULL,
    "channel" VARCHAR(32) NOT NULL DEFAULT 'online',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."service_offices" (
    "id" UUID NOT NULL,
    "service_id" UUID,
    "agency_id" UUID NOT NULL,
    "district_id" UUID,
    "upazila_id" UUID,
    "name_bn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "address_bn" TEXT NOT NULL,
    "address_en" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "hours" TEXT,
    "contact" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "service_offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."notices" (
    "id" UUID NOT NULL,
    "title_bn" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "body_bn" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "kind" "catalogue"."NoticeKind" NOT NULL,
    "published_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "region_scope" JSONB NOT NULL DEFAULT '{"national":true}',
    "source_id" UUID NOT NULL,
    "trust_label" "catalogue"."TrustLabel" NOT NULL DEFAULT 'OFFICIAL_SOURCE',
    "status" "catalogue"."ContentStatus" NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."faqs" (
    "id" UUID NOT NULL,
    "service_id" UUID,
    "question_bn" TEXT NOT NULL,
    "question_en" TEXT NOT NULL,
    "answer_bn" TEXT NOT NULL,
    "answer_en" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "trust_label" "catalogue"."TrustLabel" NOT NULL DEFAULT 'VERIFIED_BY_JONOSHHEBA',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."content_reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID,
    "resource_type" VARCHAR(48) NOT NULL,
    "resource_id" UUID NOT NULL,
    "reason" VARCHAR(80) NOT NULL,
    "details" TEXT NOT NULL,
    "status" "catalogue"."ContentReportStatus" NOT NULL DEFAULT 'open',
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."saved_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "resource_type" VARCHAR(48) NOT NULL,
    "resource_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "saved_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."reminders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "resource_type" VARCHAR(48) NOT NULL,
    "resource_id" UUID,
    "title_bn" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "remind_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "catalogue"."ReminderStatus" NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."hotlines" (
    "id" UUID NOT NULL,
    "number" VARCHAR(24) NOT NULL,
    "name_bn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "scope" VARCHAR(48) NOT NULL DEFAULT 'national',
    "category" VARCHAR(48) NOT NULL,
    "source_id" UUID NOT NULL,
    "trust_label" "catalogue"."TrustLabel" NOT NULL DEFAULT 'OFFICIAL_SOURCE',
    "last_verified_at" TIMESTAMPTZ(6),
    "verified_by" UUID,
    "second_reviewer_id" UUID,
    "verify_before_release" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."facilities" (
    "id" UUID NOT NULL,
    "facility_type" "catalogue"."FacilityType" NOT NULL,
    "name_bn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "district_id" UUID,
    "upazila_id" UUID,
    "address_bn" TEXT NOT NULL,
    "address_en" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "hours" TEXT,
    "contact" TEXT,
    "trust_label" "catalogue"."TrustLabel" NOT NULL DEFAULT 'OFFICIAL_SOURCE',
    "source_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."utility_outages" (
    "id" UUID NOT NULL,
    "utility_type" VARCHAR(32) NOT NULL,
    "provider_name" TEXT NOT NULL,
    "district_id" UUID,
    "upazila_id" UUID,
    "area_description_bn" TEXT NOT NULL,
    "area_description_en" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "expected_end_at" TIMESTAMPTZ(6),
    "status" VARCHAR(24) NOT NULL DEFAULT 'active',
    "source_id" UUID NOT NULL,
    "trust_label" "catalogue"."TrustLabel" NOT NULL DEFAULT 'OFFICIAL_SOURCE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "utility_outages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."transport_providers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "mode" "transport"."TransportMode" NOT NULL,
    "name" TEXT NOT NULL,
    "official_url" TEXT NOT NULL,
    "integration_type" "transport"."IntegrationType" NOT NULL,
    "rate_limit_per_min" INTEGER NOT NULL DEFAULT 30,
    "terms_url" TEXT,
    "status" "transport"."ProviderStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "transport_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."stations_stops" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "mode" "transport"."TransportMode" NOT NULL,
    "name_bn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "district_id" UUID,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "stations_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."routes" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "route_key" TEXT NOT NULL,
    "mode" "transport"."TransportMode" NOT NULL,
    "origin_id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "name_bn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "distance_km" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."trips" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "trip_code" VARCHAR(32) NOT NULL,
    "name_bn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "depart_time_local" VARCHAR(8) NOT NULL,
    "arrive_time_local" VARCHAR(8) NOT NULL,
    "operating_days" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
    "status" VARCHAR(24) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."seat_classes" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name_bn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "base_fare_bdt" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "seat_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."journey_searches" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "opt_in_saved" BOOLEAN NOT NULL DEFAULT false,
    "mode" "transport"."TransportMode" NOT NULL,
    "origin_id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "journey_date" DATE NOT NULL,
    "passengers" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journey_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."ticket_watches" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mode" "transport"."TransportMode" NOT NULL,
    "origin_id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "journey_date" DATE NOT NULL,
    "passengers" INTEGER NOT NULL DEFAULT 1,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "flexibility" JSONB NOT NULL DEFAULT '{}',
    "channels" TEXT[] DEFAULT ARRAY['in_app', 'web_push']::TEXT[],
    "status" "transport"."WatchStatus" NOT NULL DEFAULT 'active',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_checked_at" TIMESTAMPTZ(6),
    "consecutive_errors" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "ticket_watches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."inventory_snapshots" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "route_key" TEXT NOT NULL,
    "journey_date" DATE NOT NULL,
    "seat_class" VARCHAR(32) NOT NULL,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" "transport"."AvailabilityState" NOT NULL,
    "seats_available" INTEGER,
    "fare_bdt" INTEGER,
    "source_ref" TEXT,
    "response_status" INTEGER,
    "raw_hash" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."watch_matches" (
    "id" UUID NOT NULL,
    "watch_id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "match_quality" "transport"."MatchQuality" NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "notified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watch_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."demand_aggregates" (
    "id" UUID NOT NULL,
    "route_key" TEXT NOT NULL,
    "journey_date" DATE NOT NULL,
    "watch_count" INTEGER NOT NULL DEFAULT 0,
    "search_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "demand_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notify"."notification_templates" (
    "id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "channel" "notify"."NotificationChannel" NOT NULL,
    "locale" VARCHAR(8) NOT NULL DEFAULT 'bn',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notify"."notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title_bn" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "body_bn" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "category" VARCHAR(48) NOT NULL,
    "priority" "notify"."NotificationPriority" NOT NULL DEFAULT 'P2',
    "action_url" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notify"."notification_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_type" VARCHAR(48) NOT NULL,
    "source_id" UUID NOT NULL,
    "channel" "notify"."NotificationChannel" NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "priority" "notify"."NotificationPriority" NOT NULL DEFAULT 'P2',
    "status" "notify"."NotificationJobStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "provider_message_id" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "opened_at" TIMESTAMPTZ(6),
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notify"."notification_feedback" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_useful" BOOLEAN NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities"."programs" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title_bn" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "summary_bn" TEXT NOT NULL,
    "summary_en" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "benefit_amount_info" TEXT,
    "deadline_at" TIMESTAMPTZ(6),
    "required_documents" JSONB NOT NULL DEFAULT '[]',
    "application_url" TEXT NOT NULL,
    "region_scope" JSONB NOT NULL DEFAULT '{"national":true}',
    "trust_label" VARCHAR(32) NOT NULL DEFAULT 'OFFICIAL_SOURCE',
    "source_id" UUID NOT NULL,
    "status" "opportunities"."OpportunityStatus" NOT NULL DEFAULT 'published',
    "last_verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities"."scholarships" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title_bn" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "summary_bn" TEXT NOT NULL,
    "summary_en" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "education_level" VARCHAR(48) NOT NULL,
    "deadline_at" TIMESTAMPTZ(6),
    "required_documents" JSONB NOT NULL DEFAULT '[]',
    "application_url" TEXT NOT NULL,
    "region_scope" JSONB NOT NULL DEFAULT '{"national":true}',
    "trust_label" VARCHAR(32) NOT NULL DEFAULT 'OFFICIAL_SOURCE',
    "source_id" UUID NOT NULL,
    "status" "opportunities"."OpportunityStatus" NOT NULL DEFAULT 'published',
    "last_verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "scholarships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities"."job_circulars" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title_bn" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "organization_bn" TEXT NOT NULL,
    "organization_en" TEXT NOT NULL,
    "grade" VARCHAR(32),
    "vacancies" INTEGER,
    "age_limit_info" TEXT,
    "qualifications_bn" TEXT NOT NULL,
    "qualifications_en" TEXT NOT NULL,
    "fee_info" TEXT,
    "deadline_at" TIMESTAMPTZ(6),
    "required_documents" JSONB NOT NULL DEFAULT '[]',
    "application_url" TEXT NOT NULL,
    "region_scope" JSONB NOT NULL DEFAULT '{"national":true}',
    "trust_label" VARCHAR(32) NOT NULL DEFAULT 'OFFICIAL_SOURCE',
    "source_id" UUID NOT NULL,
    "status" "opportunities"."OpportunityStatus" NOT NULL DEFAULT 'published',
    "last_verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "job_circulars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities"."eligibility_rules" (
    "id" UUID NOT NULL,
    "target_type" "opportunities"."OpportunityTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "rule_json_logic" JSONB NOT NULL,
    "criteria_explanations" JSONB NOT NULL DEFAULT '[]',
    "source_id" UUID NOT NULL,
    "reviewer_id" UUID,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "eligibility_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases"."complaint_guides" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "authority_bn" TEXT NOT NULL,
    "authority_en" TEXT NOT NULL,
    "official_channel_url" TEXT NOT NULL,
    "supports_anonymity" BOOLEAN NOT NULL DEFAULT false,
    "anonymity_notes_bn" TEXT,
    "anonymity_notes_en" TEXT,
    "evidence_checklist" JSONB NOT NULL DEFAULT '[]',
    "source_id" UUID NOT NULL,
    "trust_label" VARCHAR(32) NOT NULL DEFAULT 'OFFICIAL_SOURCE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "complaint_guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases"."duplicate_clusters" (
    "id" UUID NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "district_id" UUID,
    "centroid_summary" TEXT NOT NULL,
    "member_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "duplicate_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases"."citizen_cases" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "case_type" "cases"."CaseType" NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "title" TEXT NOT NULL,
    "summary_bn" TEXT,
    "summary_en" TEXT,
    "ai_draft" TEXT,
    "user_final_text" TEXT,
    "external_channel" TEXT,
    "external_reference" TEXT,
    "status" "cases"."CaseStatus" NOT NULL DEFAULT 'draft',
    "user_reported_updates" JSONB NOT NULL DEFAULT '[]',
    "duplicate_cluster_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "citizen_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases"."case_events" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "actor_id" UUID,
    "event_type" VARCHAR(48) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."kb_documents" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "lang" VARCHAR(8) NOT NULL DEFAULT 'bn',
    "agency" TEXT NOT NULL,
    "doc_type" VARCHAR(32) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ai"."KbDocStatus" NOT NULL DEFAULT 'pending',
    "valid_from" TIMESTAMPTZ(6),
    "valid_to" TIMESTAMPTZ(6),
    "checksum" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "kb_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."kb_chunks" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "lang" VARCHAR(8) NOT NULL DEFAULT 'bn',
    "tokens" INTEGER NOT NULL,
    "heading_path" TEXT,
    "embedding" vector(1024),
    "tsv" tsvector,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_expired" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."conversations" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "channel" VARCHAR(24) NOT NULL DEFAULT 'web',
    "locale" VARCHAR(8) NOT NULL DEFAULT 'bn',
    "title" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "ai"."MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB NOT NULL DEFAULT '[]',
    "tool_calls" JSONB NOT NULL DEFAULT '[]',
    "model" VARCHAR(64),
    "prompt_version" VARCHAR(32),
    "latency_ms" INTEGER,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "safety_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."message_feedback" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" UUID,
    "rating" INTEGER NOT NULL,
    "reason" TEXT,
    "correction" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."ai_eval_runs" (
    "id" UUID NOT NULL,
    "suite_name" VARCHAR(64) NOT NULL,
    "prompt_version" VARCHAR(32) NOT NULL,
    "model" VARCHAR(64) NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_eval_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."model_registry_refs" (
    "id" UUID NOT NULL,
    "model_name" VARCHAR(80) NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "stage" VARCHAR(24) NOT NULL DEFAULT 'staging',
    "mlflow_run_id" TEXT,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "model_registry_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."prompt_versions" (
    "id" UUID NOT NULL,
    "prompt_key" VARCHAR(80) NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "template" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."feature_flags" (
    "id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB NOT NULL DEFAULT '{}',
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."provider_health_checks" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "status" VARCHAR(24) NOT NULL,
    "latency_ms" INTEGER,
    "error_rate" DOUBLE PRECISION,
    "circuit_state" VARCHAR(24) NOT NULL DEFAULT 'closed',
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit"."audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_role" VARCHAR(40),
    "action" VARCHAR(80) NOT NULL,
    "resource_type" VARCHAR(64) NOT NULL,
    "resource_id" TEXT,
    "before_diff" JSONB,
    "after_diff" JSONB,
    "ip_hash" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit"."outbox_events" (
    "id" UUID NOT NULL,
    "aggregate_type" VARCHAR(64) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit"."data_export_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "audit"."DataRequestStatus" NOT NULL DEFAULT 'requested',
    "object_key" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "data_export_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit"."deletion_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "audit"."DataRequestStatus" NOT NULL DEFAULT 'requested',
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grace_until" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_e164_key" ON "identity"."users"("phone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "identity"."users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "identity"."users"("status");

-- CreateIndex
CREATE INDEX "identity_providers_user_id_idx" ON "identity"."identity_providers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "identity_providers_provider_provider_user_id_key" ON "identity"."identity_providers"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "identity"."sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "identity"."sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_family_id_idx" ON "identity"."sessions"("token_family_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "identity"."sessions"("expires_at");

-- CreateIndex
CREATE INDEX "otp_challenges_phone_e164_created_at_idx" ON "identity"."otp_challenges"("phone_e164", "created_at");

-- CreateIndex
CREATE INDEX "otp_challenges_expires_at_idx" ON "identity"."otp_challenges"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "identity"."roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "identity"."organizations"("slug");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "identity"."user_roles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_org_id_key" ON "identity"."user_roles"("user_id", "role_id", "org_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "identity"."user_preferences"("user_id");

-- CreateIndex
CREATE INDEX "consents_user_id_purpose_idx" ON "identity"."consents"("user_id", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_hints_user_id_key" ON "identity"."user_profile_hints"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_push_token_key" ON "identity"."devices"("push_token");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "identity"."devices"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_object_key_key" ON "identity"."documents"("object_key");

-- CreateIndex
CREATE INDEX "documents_owner_id_idx" ON "identity"."documents"("owner_id");

-- CreateIndex
CREATE INDEX "documents_retention_until_idx" ON "identity"."documents"("retention_until");

-- CreateIndex
CREATE UNIQUE INDEX "divisions_bbs_code_key" ON "catalogue"."divisions"("bbs_code");

-- CreateIndex
CREATE UNIQUE INDEX "districts_bbs_code_key" ON "catalogue"."districts"("bbs_code");

-- CreateIndex
CREATE INDEX "districts_division_id_idx" ON "catalogue"."districts"("division_id");

-- CreateIndex
CREATE UNIQUE INDEX "upazilas_bbs_code_key" ON "catalogue"."upazilas"("bbs_code");

-- CreateIndex
CREATE INDEX "upazilas_district_id_idx" ON "catalogue"."upazilas"("district_id");

-- CreateIndex
CREATE UNIQUE INDEX "unions_wards_bbs_code_key" ON "catalogue"."unions_wards"("bbs_code");

-- CreateIndex
CREATE INDEX "unions_wards_upazila_id_idx" ON "catalogue"."unions_wards"("upazila_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_slug_key" ON "catalogue"."service_categories"("slug");

-- CreateIndex
CREATE INDEX "service_categories_parent_id_idx" ON "catalogue"."service_categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "life_events_slug_key" ON "catalogue"."life_events"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "life_event_steps_life_event_id_step_order_key" ON "catalogue"."life_event_steps"("life_event_id", "step_order");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_slug_key" ON "catalogue"."agencies"("slug");

-- CreateIndex
CREATE INDEX "sources_valid_to_idx" ON "catalogue"."sources"("valid_to");

-- CreateIndex
CREATE INDEX "sources_trust_label_idx" ON "catalogue"."sources"("trust_label");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "catalogue"."services"("slug");

-- CreateIndex
CREATE INDEX "services_category_id_idx" ON "catalogue"."services"("category_id");

-- CreateIndex
CREATE INDEX "services_agency_id_idx" ON "catalogue"."services"("agency_id");

-- CreateIndex
CREATE INDEX "services_status_idx" ON "catalogue"."services"("status");

-- CreateIndex
CREATE UNIQUE INDEX "service_versions_service_id_version_key" ON "catalogue"."service_versions"("service_id", "version");

-- CreateIndex
CREATE INDEX "service_requirements_service_id_idx" ON "catalogue"."service_requirements"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_steps_service_id_step_order_key" ON "catalogue"."service_steps"("service_id", "step_order");

-- CreateIndex
CREATE INDEX "service_offices_district_id_idx" ON "catalogue"."service_offices"("district_id");

-- CreateIndex
CREATE INDEX "service_offices_agency_id_idx" ON "catalogue"."service_offices"("agency_id");

-- CreateIndex
CREATE INDEX "notices_kind_published_at_idx" ON "catalogue"."notices"("kind", "published_at");

-- CreateIndex
CREATE INDEX "notices_expires_at_idx" ON "catalogue"."notices"("expires_at");

-- CreateIndex
CREATE INDEX "faqs_service_id_idx" ON "catalogue"."faqs"("service_id");

-- CreateIndex
CREATE INDEX "content_reports_status_created_at_idx" ON "catalogue"."content_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "content_reports_resource_type_resource_id_idx" ON "catalogue"."content_reports"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "saved_items_user_id_idx" ON "catalogue"."saved_items"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_items_user_id_resource_type_resource_id_key" ON "catalogue"."saved_items"("user_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "reminders_user_id_remind_at_idx" ON "catalogue"."reminders"("user_id", "remind_at");

-- CreateIndex
CREATE UNIQUE INDEX "hotlines_number_key" ON "catalogue"."hotlines"("number");

-- CreateIndex
CREATE INDEX "hotlines_category_sort_order_idx" ON "catalogue"."hotlines"("category", "sort_order");

-- CreateIndex
CREATE INDEX "facilities_facility_type_district_id_idx" ON "catalogue"."facilities"("facility_type", "district_id");

-- CreateIndex
CREATE INDEX "facilities_lat_lng_idx" ON "catalogue"."facilities"("lat", "lng");

-- CreateIndex
CREATE INDEX "utility_outages_district_id_status_idx" ON "catalogue"."utility_outages"("district_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "transport_providers_code_key" ON "transport"."transport_providers"("code");

-- CreateIndex
CREATE INDEX "transport_providers_mode_integration_type_idx" ON "transport"."transport_providers"("mode", "integration_type");

-- CreateIndex
CREATE UNIQUE INDEX "stations_stops_code_key" ON "transport"."stations_stops"("code");

-- CreateIndex
CREATE INDEX "stations_stops_mode_district_id_idx" ON "transport"."stations_stops"("mode", "district_id");

-- CreateIndex
CREATE UNIQUE INDEX "routes_route_key_key" ON "transport"."routes"("route_key");

-- CreateIndex
CREATE INDEX "routes_origin_id_destination_id_mode_idx" ON "transport"."routes"("origin_id", "destination_id", "mode");

-- CreateIndex
CREATE INDEX "trips_route_id_idx" ON "transport"."trips"("route_id");

-- CreateIndex
CREATE UNIQUE INDEX "trips_provider_id_trip_code_key" ON "transport"."trips"("provider_id", "trip_code");

-- CreateIndex
CREATE UNIQUE INDEX "seat_classes_provider_id_code_key" ON "transport"."seat_classes"("provider_id", "code");

-- CreateIndex
CREATE INDEX "journey_searches_user_id_created_at_idx" ON "transport"."journey_searches"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_watches_user_id_status_idx" ON "transport"."ticket_watches"("user_id", "status");

-- CreateIndex
CREATE INDEX "ticket_watches_status_journey_date_idx" ON "transport"."ticket_watches"("status", "journey_date");

-- CreateIndex
CREATE INDEX "inventory_snapshots_provider_id_route_key_journey_date_chec_idx" ON "transport"."inventory_snapshots"("provider_id", "route_key", "journey_date", "checked_at");

-- CreateIndex
CREATE UNIQUE INDEX "watch_matches_dedupe_key_key" ON "transport"."watch_matches"("dedupe_key");

-- CreateIndex
CREATE INDEX "watch_matches_watch_id_idx" ON "transport"."watch_matches"("watch_id");

-- CreateIndex
CREATE UNIQUE INDEX "demand_aggregates_route_key_journey_date_key" ON "transport"."demand_aggregates"("route_key", "journey_date");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_key_channel_locale_version_key" ON "notify"."notification_templates"("key", "channel", "locale", "version");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notify"."notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_jobs_dedupe_key_key" ON "notify"."notification_jobs"("dedupe_key");

-- CreateIndex
CREATE INDEX "notification_jobs_user_id_status_idx" ON "notify"."notification_jobs"("user_id", "status");

-- CreateIndex
CREATE INDEX "notification_jobs_status_priority_idx" ON "notify"."notification_jobs"("status", "priority");

-- CreateIndex
CREATE INDEX "notification_feedback_notification_id_idx" ON "notify"."notification_feedback"("notification_id");

-- CreateIndex
CREATE INDEX "notification_feedback_user_id_idx" ON "notify"."notification_feedback"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "programs_slug_key" ON "opportunities"."programs"("slug");

-- CreateIndex
CREATE INDEX "programs_category_status_idx" ON "opportunities"."programs"("category", "status");

-- CreateIndex
CREATE INDEX "programs_deadline_at_idx" ON "opportunities"."programs"("deadline_at");

-- CreateIndex
CREATE UNIQUE INDEX "scholarships_slug_key" ON "opportunities"."scholarships"("slug");

-- CreateIndex
CREATE INDEX "scholarships_education_level_status_idx" ON "opportunities"."scholarships"("education_level", "status");

-- CreateIndex
CREATE INDEX "scholarships_deadline_at_idx" ON "opportunities"."scholarships"("deadline_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_circulars_slug_key" ON "opportunities"."job_circulars"("slug");

-- CreateIndex
CREATE INDEX "job_circulars_status_deadline_at_idx" ON "opportunities"."job_circulars"("status", "deadline_at");

-- CreateIndex
CREATE INDEX "eligibility_rules_target_type_target_id_is_active_idx" ON "opportunities"."eligibility_rules"("target_type", "target_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "eligibility_rules_target_type_target_id_version_key" ON "opportunities"."eligibility_rules"("target_type", "target_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_guides_slug_key" ON "cases"."complaint_guides"("slug");

-- CreateIndex
CREATE INDEX "complaint_guides_category_idx" ON "cases"."complaint_guides"("category");

-- CreateIndex
CREATE INDEX "duplicate_clusters_category_district_id_idx" ON "cases"."duplicate_clusters"("category", "district_id");

-- CreateIndex
CREATE INDEX "citizen_cases_user_id_status_idx" ON "cases"."citizen_cases"("user_id", "status");

-- CreateIndex
CREATE INDEX "citizen_cases_category_idx" ON "cases"."citizen_cases"("category");

-- CreateIndex
CREATE INDEX "case_events_case_id_created_at_idx" ON "cases"."case_events"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "kb_documents_status_valid_to_idx" ON "ai"."kb_documents"("status", "valid_to");

-- CreateIndex
CREATE INDEX "kb_documents_checksum_idx" ON "ai"."kb_documents"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "kb_documents_source_id_version_key" ON "ai"."kb_documents"("source_id", "version");

-- CreateIndex
CREATE INDEX "kb_chunks_is_expired_idx" ON "ai"."kb_chunks"("is_expired");

-- CreateIndex
CREATE UNIQUE INDEX "kb_chunks_document_id_ordinal_key" ON "ai"."kb_chunks"("document_id", "ordinal");

-- CreateIndex
CREATE INDEX "conversations_user_id_updated_at_idx" ON "ai"."conversations"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "ai"."messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "message_feedback_message_id_idx" ON "ai"."message_feedback"("message_id");

-- CreateIndex
CREATE INDEX "ai_eval_runs_suite_name_created_at_idx" ON "ai"."ai_eval_runs"("suite_name", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "model_registry_refs_model_name_version_key" ON "ai"."model_registry_refs"("model_name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_versions_prompt_key_version_key" ON "ai"."prompt_versions"("prompt_key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "admin"."feature_flags"("key");

-- CreateIndex
CREATE INDEX "provider_health_checks_provider_id_checked_at_idx" ON "admin"."provider_health_checks"("provider_id", "checked_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit"."audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit"."audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit"."audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_created_at_idx" ON "audit"."outbox_events"("published_at", "created_at");

-- CreateIndex
CREATE INDEX "data_export_requests_user_id_status_idx" ON "audit"."data_export_requests"("user_id", "status");

-- CreateIndex
CREATE INDEX "deletion_requests_user_id_status_idx" ON "audit"."deletion_requests"("user_id", "status");

-- CreateIndex
CREATE INDEX "deletion_requests_grace_until_idx" ON "audit"."deletion_requests"("grace_until");

-- AddForeignKey
ALTER TABLE "identity"."identity_providers" ADD CONSTRAINT "identity_providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "identity"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user_roles" ADD CONSTRAINT "user_roles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "identity"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user_profile_hints" ADD CONSTRAINT "user_profile_hints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."documents" ADD CONSTRAINT "documents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."districts" ADD CONSTRAINT "districts_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "catalogue"."divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."upazilas" ADD CONSTRAINT "upazilas_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "catalogue"."districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."unions_wards" ADD CONSTRAINT "unions_wards_upazila_id_fkey" FOREIGN KEY ("upazila_id") REFERENCES "catalogue"."upazilas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."service_categories" ADD CONSTRAINT "service_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "catalogue"."service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."life_event_steps" ADD CONSTRAINT "life_event_steps_life_event_id_fkey" FOREIGN KEY ("life_event_id") REFERENCES "catalogue"."life_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."life_event_steps" ADD CONSTRAINT "life_event_steps_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "catalogue"."services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."services" ADD CONSTRAINT "services_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "catalogue"."agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalogue"."service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."services" ADD CONSTRAINT "services_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "catalogue"."sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."service_versions" ADD CONSTRAINT "service_versions_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "catalogue"."services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."service_requirements" ADD CONSTRAINT "service_requirements_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "catalogue"."services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."service_steps" ADD CONSTRAINT "service_steps_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "catalogue"."services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."service_offices" ADD CONSTRAINT "service_offices_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "catalogue"."services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."service_offices" ADD CONSTRAINT "service_offices_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "catalogue"."agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."service_offices" ADD CONSTRAINT "service_offices_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "catalogue"."districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."service_offices" ADD CONSTRAINT "service_offices_upazila_id_fkey" FOREIGN KEY ("upazila_id") REFERENCES "catalogue"."upazilas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."notices" ADD CONSTRAINT "notices_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "catalogue"."sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."faqs" ADD CONSTRAINT "faqs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "catalogue"."services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."faqs" ADD CONSTRAINT "faqs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "catalogue"."sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."hotlines" ADD CONSTRAINT "hotlines_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "catalogue"."sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."facilities" ADD CONSTRAINT "facilities_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "catalogue"."districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."facilities" ADD CONSTRAINT "facilities_upazila_id_fkey" FOREIGN KEY ("upazila_id") REFERENCES "catalogue"."upazilas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."facilities" ADD CONSTRAINT "facilities_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "catalogue"."sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."utility_outages" ADD CONSTRAINT "utility_outages_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "catalogue"."districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."utility_outages" ADD CONSTRAINT "utility_outages_upazila_id_fkey" FOREIGN KEY ("upazila_id") REFERENCES "catalogue"."upazilas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."utility_outages" ADD CONSTRAINT "utility_outages_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "catalogue"."sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."routes" ADD CONSTRAINT "routes_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "transport"."transport_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."routes" ADD CONSTRAINT "routes_origin_id_fkey" FOREIGN KEY ("origin_id") REFERENCES "transport"."stations_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."routes" ADD CONSTRAINT "routes_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "transport"."stations_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."trips" ADD CONSTRAINT "trips_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "transport"."routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."trips" ADD CONSTRAINT "trips_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "transport"."transport_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."seat_classes" ADD CONSTRAINT "seat_classes_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "transport"."transport_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."ticket_watches" ADD CONSTRAINT "ticket_watches_origin_id_fkey" FOREIGN KEY ("origin_id") REFERENCES "transport"."stations_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."ticket_watches" ADD CONSTRAINT "ticket_watches_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "transport"."stations_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."inventory_snapshots" ADD CONSTRAINT "inventory_snapshots_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "transport"."transport_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."watch_matches" ADD CONSTRAINT "watch_matches_watch_id_fkey" FOREIGN KEY ("watch_id") REFERENCES "transport"."ticket_watches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."watch_matches" ADD CONSTRAINT "watch_matches_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "transport"."inventory_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notify"."notification_feedback" ADD CONSTRAINT "notification_feedback_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notify"."notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases"."citizen_cases" ADD CONSTRAINT "citizen_cases_duplicate_cluster_id_fkey" FOREIGN KEY ("duplicate_cluster_id") REFERENCES "cases"."duplicate_clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases"."case_events" ADD CONSTRAINT "case_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"."citizen_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."kb_chunks" ADD CONSTRAINT "kb_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "ai"."kb_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."message_feedback" ADD CONSTRAINT "message_feedback_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ai"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
