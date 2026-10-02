-- ══════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 4 — TAX ENGINE + QUESTIONNAIRE INTELLIGENT
-- Migration: 0005_tax_engine
-- ══════════════════════════════════════════════════════════════════════════════

-- ENUMS
CREATE TYPE "public"."income_category" AS ENUM(
  'employment',
  'self_employment',
  'pension',
  'ei_benefits',
  'social_assistance',
  'interest',
  'dividends_eligible',
  'dividends_ineligible',
  'capital_gains',
  'rental',
  'foreign_income',
  'other_income'
);--> statement-breakpoint

CREATE TYPE "public"."deduction_category" AS ENUM(
  'rrsp',
  'union_dues',
  'childcare',
  'moving_expenses',
  'employment_expenses',
  'carrying_charges',
  'other_deductions'
);--> statement-breakpoint

CREATE TYPE "public"."credit_category" AS ENUM(
  'basic_personal',
  'age',
  'spouse_or_cp',
  'caregiver',
  'disability',
  'tuition',
  'medical',
  'donations',
  'home_buyers',
  'first_home_savings',
  'climate_action',
  'other_credits'
);--> statement-breakpoint

CREATE TYPE "public"."calculation_status" AS ENUM(
  'pending',
  'in_progress',
  'completed',
  'stale',
  'error'
);--> statement-breakpoint

CREATE TYPE "public"."rule_type" AS ENUM(
  'bracket',
  'rate',
  'flat_amount',
  'exemption',
  'threshold',
  'credit_rate',
  'phase_out'
);--> statement-breakpoint

CREATE TYPE "public"."questionnaire_status" AS ENUM(
  'not_started',
  'in_progress',
  'completed'
);--> statement-breakpoint

-- TAX RULES — versionnées par juridiction + année
CREATE TABLE "tax_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "jurisdiction_id" uuid NOT NULL REFERENCES "jurisdictions"("id"),
  "tax_year_id" uuid NOT NULL REFERENCES "tax_years"("id"),
  "rule_type" "rule_type" NOT NULL,
  "rule_code" varchar(100) NOT NULL,
  "description_fr" text,
  "description_en" text,
  -- Montants en cents (bigint pour précision)
  "amount_cents" bigint,
  "rate_basis_points" integer,  -- ex: 2050 = 20.50%
  "min_amount_cents" bigint,
  "max_amount_cents" bigint,
  "threshold_cents" bigint,
  -- Versionnage
  "rule_version" varchar(20) DEFAULT '1.0' NOT NULL,
  "effective_from" date,
  "effective_to" date,
  "is_active" boolean DEFAULT true NOT NULL,
  -- Métadonnées
  "source_reference" varchar(255),  -- ex: "T1 Schedule 1 line 30000"
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- INDEX performance
CREATE INDEX "tax_rules_jurisdiction_year_idx" ON "tax_rules"("jurisdiction_id", "tax_year_id");--> statement-breakpoint
CREATE INDEX "tax_rules_code_idx" ON "tax_rules"("rule_code");--> statement-breakpoint

-- INCOME ENTRIES — revenus validés (uniquement données VALIDATED)
CREATE TABLE "income_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "tax_profile_id" uuid NOT NULL REFERENCES "tax_profiles"("id"),
  "tax_year_id" uuid NOT NULL REFERENCES "tax_years"("id"),
  "tax_return_id" uuid REFERENCES "tax_returns"("id"),
  "category" "income_category" NOT NULL,
  -- Source de la donnée
  "source_document_id" uuid REFERENCES "fiscal_documents"("id"),
  "source_type" varchar(50) NOT NULL DEFAULT 'manual',  -- 'validated_ocr' | 'manual' | 'profile'
  -- Montants en cents
  "amount_cents" bigint NOT NULL DEFAULT 0,
  -- Métadonnées
  "description" varchar(500),
  "employer_name" varchar(255),
  -- Validation
  "is_validated" boolean DEFAULT false NOT NULL,
  "validated_at" timestamp,
  "validated_by_user_id" varchar(255),
  -- Drapeaux
  "is_foreign" boolean DEFAULT false,
  "foreign_currency" varchar(10),
  "foreign_amount_cents" bigint,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "income_entries_user_year_idx" ON "income_entries"("user_id", "tax_year_id");--> statement-breakpoint
CREATE INDEX "income_entries_return_idx" ON "income_entries"("tax_return_id");--> statement-breakpoint

-- DEDUCTION ENTRIES
CREATE TABLE "deduction_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "tax_profile_id" uuid NOT NULL REFERENCES "tax_profiles"("id"),
  "tax_year_id" uuid NOT NULL REFERENCES "tax_years"("id"),
  "tax_return_id" uuid REFERENCES "tax_returns"("id"),
  "category" "deduction_category" NOT NULL,
  "source_document_id" uuid REFERENCES "fiscal_documents"("id"),
  "source_type" varchar(50) NOT NULL DEFAULT 'manual',
  "amount_cents" bigint NOT NULL DEFAULT 0,
  "description" varchar(500),
  "is_validated" boolean DEFAULT false NOT NULL,
  "validated_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "deduction_entries_user_year_idx" ON "deduction_entries"("user_id", "tax_year_id");--> statement-breakpoint

-- CREDIT ENTRIES
CREATE TABLE "credit_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "tax_profile_id" uuid NOT NULL REFERENCES "tax_profiles"("id"),
  "tax_year_id" uuid NOT NULL REFERENCES "tax_years"("id"),
  "tax_return_id" uuid REFERENCES "tax_returns"("id"),
  "category" "credit_category" NOT NULL,
  "source_document_id" uuid REFERENCES "fiscal_documents"("id"),
  "source_type" varchar(50) NOT NULL DEFAULT 'manual',
  "claimed_amount_cents" bigint NOT NULL DEFAULT 0,
  "description" varchar(500),
  "is_validated" boolean DEFAULT false NOT NULL,
  "validated_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "credit_entries_user_year_idx" ON "credit_entries"("user_id", "tax_year_id");--> statement-breakpoint

-- TAX CALCULATIONS — résultats du moteur
CREATE TABLE "tax_calculations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "tax_return_id" uuid NOT NULL REFERENCES "tax_returns"("id"),
  "tax_year_id" uuid NOT NULL REFERENCES "tax_years"("id"),
  "status" "calculation_status" NOT NULL DEFAULT 'pending',
  -- Revenus (cents)
  "total_income_cents" bigint NOT NULL DEFAULT 0,
  "net_income_cents" bigint NOT NULL DEFAULT 0,
  "taxable_income_cents" bigint NOT NULL DEFAULT 0,
  -- Calcul fédéral (cents)
  "federal_tax_before_credits_cents" bigint NOT NULL DEFAULT 0,
  "federal_non_refundable_credits_cents" bigint NOT NULL DEFAULT 0,
  "federal_refundable_credits_cents" bigint NOT NULL DEFAULT 0,
  "federal_tax_payable_cents" bigint NOT NULL DEFAULT 0,
  "federal_tax_withheld_cents" bigint NOT NULL DEFAULT 0,
  "federal_balance_cents" bigint NOT NULL DEFAULT 0,  -- négatif = remboursement
  -- Calcul provincial (cents)
  "provincial_tax_before_credits_cents" bigint NOT NULL DEFAULT 0,
  "provincial_non_refundable_credits_cents" bigint NOT NULL DEFAULT 0,
  "provincial_refundable_credits_cents" bigint NOT NULL DEFAULT 0,
  "provincial_tax_payable_cents" bigint NOT NULL DEFAULT 0,
  "provincial_tax_withheld_cents" bigint NOT NULL DEFAULT 0,
  "provincial_balance_cents" bigint NOT NULL DEFAULT 0,
  -- Total
  "total_balance_cents" bigint NOT NULL DEFAULT 0,
  -- Détails JSON (breakdown lisible)
  "calculation_details" text,  -- JSON stringifié
  -- Versionnage et audit
  "calculation_version" varchar(20) DEFAULT '1.0' NOT NULL,
  "rules_snapshot_version" varchar(50),  -- hash ou version des règles utilisées
  "is_preliminary" boolean DEFAULT true NOT NULL,
  "error_message" text,
  "calculated_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "tax_calculations_return_idx" ON "tax_calculations"("tax_return_id");--> statement-breakpoint
CREATE INDEX "tax_calculations_user_year_idx" ON "tax_calculations"("user_id", "tax_year_id");--> statement-breakpoint

-- QUESTIONNAIRE SESSIONS — état du questionnaire par dossier
CREATE TABLE "questionnaire_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "tax_profile_id" uuid NOT NULL REFERENCES "tax_profiles"("id"),
  "tax_return_id" uuid NOT NULL REFERENCES "tax_returns"("id"),
  "tax_year_id" uuid NOT NULL REFERENCES "tax_years"("id"),
  -- Statut par section
  "status" "questionnaire_status" NOT NULL DEFAULT 'not_started',
  "current_section" varchar(50),
  "sections_completed" text,  -- JSON array: ["identity","employment",...]
  -- Contexte dynamique (inféré des réponses + documents)
  "has_employment_income" boolean,
  "has_self_employment" boolean,
  "has_investment_income" boolean,
  "has_rental_income" boolean,
  "has_foreign_income" boolean,
  "has_rrsp" boolean,
  "has_childcare" boolean,
  "num_employers" integer DEFAULT 0,
  -- Progression
  "questions_answered" integer DEFAULT 0,
  "last_question_code" varchar(100),
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX "questionnaire_sessions_return_idx" ON "questionnaire_sessions"("tax_return_id");--> statement-breakpoint
