CREATE TYPE "public"."audit_action" AS ENUM('profile_created', 'profile_updated', 'household_created', 'household_member_added', 'household_member_removed', 'employer_added', 'employer_updated', 'employer_removed', 'return_created', 'return_status_changed', 'self_employment_added', 'self_employment_updated');--> statement-breakpoint
CREATE TYPE "public"."dependent_relation" AS ENUM('child', 'stepchild', 'parent', 'grandparent', 'sibling', 'other');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('single', 'married', 'common_law', 'separated', 'divorced', 'widowed');--> statement-breakpoint
CREATE TYPE "public"."province" AS ENUM('QC', 'ON', 'BC', 'AB', 'SK', 'MB', 'NB', 'NS', 'PE', 'NL', 'NT', 'NU', 'YT');--> statement-breakpoint
CREATE TYPE "public"."tax_return_status" AS ENUM('draft', 'in_progress', 'review', 'ready', 'submitted', 'accepted', 'rejected', 'amended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tax_year_status" AS ENUM('open', 'closed', 'archived');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid,
	"tax_return_id" uuid,
	"action" "audit_action" NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dependents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"date_of_birth" date NOT NULL,
	"relation" "dependent_relation" DEFAULT 'child' NOT NULL,
	"sin_encrypted" text,
	"sin_last_four" varchar(4),
	"is_full_time_student" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" varchar(255) NOT NULL,
	"trade_name" varchar(255),
	"address" varchar(255),
	"city" varchar(100),
	"province" "province",
	"postal_code" varchar(10),
	"phone" varchar(20),
	"business_number" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primary_profile_id" uuid NOT NULL,
	"spouse_profile_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_employers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "self_employments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"business_name" varchar(255),
	"trade_name" varchar(255),
	"activity_description" text,
	"start_date" date,
	"address" varchar(255),
	"city" varchar(100),
	"province" "province",
	"postal_code" varchar(10),
	"business_number" varchar(20),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"date_of_birth" date,
	"sin_encrypted" text,
	"sin_last_four" varchar(4),
	"phone" varchar(20),
	"email" varchar(255),
	"address" varchar(255),
	"city" varchar(100),
	"province" "province",
	"postal_code" varchar(10),
	"marital_status" "marital_status" DEFAULT 'single',
	"fiscal_residence" "province",
	"is_canadian_citizen" boolean,
	"is_quebec_resident" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tax_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "tax_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"household_id" uuid,
	"status" "tax_return_status" DEFAULT 'draft' NOT NULL,
	"federal_status" "tax_return_status" DEFAULT 'draft',
	"quebec_status" "tax_return_status" DEFAULT 'draft',
	"estimated_federal_refund" integer,
	"estimated_quebec_refund" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tax_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"status" "tax_year_status" DEFAULT 'open' NOT NULL,
	"filing_deadline_federal" date,
	"filing_deadline_quebec" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tax_years_year_unique" UNIQUE("year")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_profile_id_tax_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."tax_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tax_return_id_tax_returns_id_fk" FOREIGN KEY ("tax_return_id") REFERENCES "public"."tax_returns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependents" ADD CONSTRAINT "dependents_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_primary_profile_id_tax_profiles_id_fk" FOREIGN KEY ("primary_profile_id") REFERENCES "public"."tax_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_spouse_profile_id_tax_profiles_id_fk" FOREIGN KEY ("spouse_profile_id") REFERENCES "public"."tax_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_employers" ADD CONSTRAINT "profile_employers_profile_id_tax_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."tax_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_employers" ADD CONSTRAINT "profile_employers_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_employers" ADD CONSTRAINT "profile_employers_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_employments" ADD CONSTRAINT "self_employments_profile_id_tax_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."tax_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_returns" ADD CONSTRAINT "tax_returns_profile_id_tax_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."tax_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_returns" ADD CONSTRAINT "tax_returns_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_returns" ADD CONSTRAINT "tax_returns_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;