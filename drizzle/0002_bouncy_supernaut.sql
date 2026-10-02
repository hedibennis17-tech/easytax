CREATE TYPE "public"."access_code_status" AS ENUM('active', 'used', 'expired', 'disabled', 'replaced');--> statement-breakpoint
CREATE TYPE "public"."access_code_type" AS ENUM('DOWNLOAD_CODE', 'IMPOTNET_ACCESS_CODE', 'REGISTRATION_CODE', 'NETFILE_ACCESS_CODE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."document_party_type" AS ENUM('TAXPAYER', 'SPOUSE', 'DEPENDENT', 'EMPLOYER', 'BUSINESS', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."gov_account_status" AS ENUM('active', 'inactive', 'unverified', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."gov_account_type" AS ENUM('PERSONAL', 'BUSINESS', 'REPRESENTATIVE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."gov_audit_action" AS ENUM('sin_viewed', 'sin_updated', 'government_code_created', 'government_code_viewed', 'government_code_updated', 'government_code_verified', 'government_code_disabled', 'gov_account_created', 'gov_account_updated', 'document_party_linked');--> statement-breakpoint
CREATE TYPE "public"."government" AS ENUM('CRA', 'REVENU_QUEBEC', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."jurisdiction_level" AS ENUM('federal', 'provincial', 'territorial');--> statement-breakpoint
CREATE TYPE "public"."question_section" AS ENUM('identity', 'family', 'employment', 'self_employment', 'investment', 'deductions', 'credits', 'provincial', 'review');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('BOOLEAN', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'NUMBER', 'DECIMAL', 'TEXT', 'DATE', 'MONEY', 'DOCUMENT', 'ADDRESS', 'PERSON', 'EMPLOYER');--> statement-breakpoint
CREATE TYPE "public"."rule_operator" AS ENUM('eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains', 'is_null', 'is_not_null');--> statement-breakpoint
CREATE TYPE "public"."tax_administration" AS ENUM('CRA', 'REVENU_QUEBEC', 'CRA_AND_REVENU_QUEBEC');--> statement-breakpoint
CREATE TABLE "document_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_document_id" uuid NOT NULL,
	"party_type" "document_party_type" NOT NULL,
	"party_id" uuid NOT NULL,
	"relationship" varchar(100),
	"jurisdiction_id" uuid,
	"tax_year_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "government_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"tax_profile_id" uuid NOT NULL,
	"government" "government" NOT NULL,
	"account_type" "gov_account_type" DEFAULT 'PERSONAL' NOT NULL,
	"identifier_encrypted" text,
	"identifier_last4" varchar(4),
	"status" "gov_account_status" DEFAULT 'unverified' NOT NULL,
	"verified_at" timestamp,
	"last_verified_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "government_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"tax_profile_id" uuid,
	"action" "gov_audit_action" NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jurisdiction_tax_year_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"filing_deadline" date,
	"payment_deadline" date,
	"rules_version" varchar(20),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jurisdictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(10) NOT NULL,
	"country_code" varchar(5) DEFAULT 'CA' NOT NULL,
	"name_fr" varchar(255) NOT NULL,
	"name_en" varchar(255) NOT NULL,
	"jurisdiction_level" "jurisdiction_level" NOT NULL,
	"tax_administration" "tax_administration" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"has_provincial_return" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jurisdictions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tax_question_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"tax_profile_id" uuid NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"tax_return_id" uuid,
	"question_id" uuid NOT NULL,
	"question_version" integer DEFAULT 1 NOT NULL,
	"answer_value" text,
	"answer_json" text,
	"previous_value" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"value" varchar(100) NOT NULL,
	"label_fr" varchar(255) NOT NULL,
	"label_en" varchar(255) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_question_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"condition_question_code" varchar(100) NOT NULL,
	"operator" "rule_operator" NOT NULL,
	"condition_value" varchar(255),
	"action" varchar(20) DEFAULT 'show' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"jurisdiction_id" uuid,
	"tax_year_id" uuid,
	"section" "question_section" NOT NULL,
	"question_type" "question_type" NOT NULL,
	"text_fr" text NOT NULL,
	"text_en" text NOT NULL,
	"hint_fr" text,
	"hint_en" text,
	"required" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_year_access_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tax_profile_id" uuid NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"tax_return_id" uuid,
	"jurisdiction_id" uuid,
	"government" "government" NOT NULL,
	"code_type" "access_code_type" NOT NULL,
	"code_encrypted" text,
	"code_last4" varchar(4),
	"status" "access_code_status" DEFAULT 'active' NOT NULL,
	"issued_at" timestamp,
	"expires_at" timestamp,
	"verified_at" timestamp,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tax_profiles" ADD COLUMN "sin_status" varchar(20) DEFAULT 'unverified';--> statement-breakpoint
ALTER TABLE "tax_profiles" ADD COLUMN "sin_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tax_profiles" ADD COLUMN "sin_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "document_parties" ADD CONSTRAINT "document_parties_fiscal_document_id_fiscal_documents_id_fk" FOREIGN KEY ("fiscal_document_id") REFERENCES "public"."fiscal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_parties" ADD CONSTRAINT "document_parties_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_parties" ADD CONSTRAINT "document_parties_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_accounts" ADD CONSTRAINT "government_accounts_tax_profile_id_tax_profiles_id_fk" FOREIGN KEY ("tax_profile_id") REFERENCES "public"."tax_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_audit_logs" ADD CONSTRAINT "government_audit_logs_tax_profile_id_tax_profiles_id_fk" FOREIGN KEY ("tax_profile_id") REFERENCES "public"."tax_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jurisdiction_tax_year_rules" ADD CONSTRAINT "jurisdiction_tax_year_rules_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jurisdiction_tax_year_rules" ADD CONSTRAINT "jurisdiction_tax_year_rules_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_question_answers" ADD CONSTRAINT "tax_question_answers_tax_profile_id_tax_profiles_id_fk" FOREIGN KEY ("tax_profile_id") REFERENCES "public"."tax_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_question_answers" ADD CONSTRAINT "tax_question_answers_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_question_answers" ADD CONSTRAINT "tax_question_answers_tax_return_id_tax_returns_id_fk" FOREIGN KEY ("tax_return_id") REFERENCES "public"."tax_returns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_question_answers" ADD CONSTRAINT "tax_question_answers_question_id_tax_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."tax_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_question_options" ADD CONSTRAINT "tax_question_options_question_id_tax_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."tax_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_question_rules" ADD CONSTRAINT "tax_question_rules_question_id_tax_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."tax_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_questions" ADD CONSTRAINT "tax_questions_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_questions" ADD CONSTRAINT "tax_questions_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_year_access_codes" ADD CONSTRAINT "tax_year_access_codes_tax_profile_id_tax_profiles_id_fk" FOREIGN KEY ("tax_profile_id") REFERENCES "public"."tax_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_year_access_codes" ADD CONSTRAINT "tax_year_access_codes_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_year_access_codes" ADD CONSTRAINT "tax_year_access_codes_tax_return_id_tax_returns_id_fk" FOREIGN KEY ("tax_return_id") REFERENCES "public"."tax_returns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_year_access_codes" ADD CONSTRAINT "tax_year_access_codes_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;