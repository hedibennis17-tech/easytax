-- ══════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 4.6 — QUESTIONNAIRE INTELLIGENT + MODULES + DOCUMENTS + PRÉPARATEUR
-- Migration: 0007_questionnaire_engine
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── AJOUTER account_type + module_code sur tax_questions ────────────────────
ALTER TABLE "tax_questions"
  ADD COLUMN "account_type" varchar(20) DEFAULT 'INDIVIDUAL' NOT NULL,
  ADD COLUMN "module_code"  varchar(50);--> statement-breakpoint

-- ─── AJOUTER instance_id sur tax_question_answers ───────────────────────────
-- Permet T4#1, T4#2 (multi-employeurs, multi-activités)
ALTER TABLE "tax_question_answers"
  ADD COLUMN "instance_id"    varchar(100),
  ADD COLUMN "answer_status"  varchar(30) DEFAULT 'ANSWERED' NOT NULL;--> statement-breakpoint

-- ─── AJOUTER instance sur fiscal_documents ──────────────────────────────────
ALTER TABLE "fiscal_documents"
  ADD COLUMN "instance_id"    varchar(100),
  ADD COLUMN "instance_label" varchar(255);--> statement-breakpoint

-- ─── MODULES DE DOSSIER ──────────────────────────────────────────────────────
-- Modules activés par dossier selon les réponses du contribuable
CREATE TABLE "tax_dossier_modules" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"       varchar(255) NOT NULL,
  "tax_return_id" uuid NOT NULL REFERENCES "tax_returns"("id"),
  "module_code"   varchar(50) NOT NULL,
  -- ex: EMPLOYMENT | SELF_EMPLOYED | SELF_EMPLOYED_UBER | SELF_EMPLOYED_LYFT
  --     RENTAL | INVESTMENT | CRYPTO | FOREIGN | FAMILY | PENSION
  "is_active"     boolean DEFAULT true NOT NULL,
  "instance_count" integer DEFAULT 1 NOT NULL,  -- nb d'employeurs, d'activités, etc.
  "activated_at"  timestamp DEFAULT now() NOT NULL,
  "deactivated_at" timestamp,
  "metadata"      text,  -- JSON: noms d'employeurs, noms d'activités, etc.
  "created_at"    timestamp DEFAULT now() NOT NULL,
  "updated_at"    timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "module_return_unique" UNIQUE("tax_return_id", "module_code")
);--> statement-breakpoint

CREATE INDEX "modules_return_idx" ON "tax_dossier_modules"("tax_return_id");--> statement-breakpoint
CREATE INDEX "modules_user_idx"   ON "tax_dossier_modules"("user_id");--> statement-breakpoint

-- ─── DEMANDES DE DOCUMENTS ───────────────────────────────────────────────────
-- Préparateur → Client : "Il me manque votre T4 de ABC Inc."
CREATE TABLE "document_requests" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tax_return_id"       uuid NOT NULL REFERENCES "tax_returns"("id"),
  "requested_by_user_id" varchar(255) NOT NULL,  -- préparateur ou système
  "requested_to_user_id" varchar(255) NOT NULL,  -- client
  "document_type_code"  varchar(50) NOT NULL,    -- T4 | RL-1 | T5 | etc.
  "description_fr"      text,
  "description_en"      text,
  "instance_label"      varchar(255),  -- "T4 — ABC Inc."
  "status"              varchar(30) DEFAULT 'pending' NOT NULL,
  -- pending | uploaded | fulfilled | cancelled
  "fulfilled_document_id" uuid REFERENCES "fiscal_documents"("id"),
  "due_date"            timestamp,
  "fulfilled_at"        timestamp,
  "cancelled_at"        timestamp,
  "created_at"          timestamp DEFAULT now() NOT NULL,
  "updated_at"          timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "doc_requests_return_idx" ON "document_requests"("tax_return_id");--> statement-breakpoint
CREATE INDEX "doc_requests_to_idx"     ON "document_requests"("requested_to_user_id");--> statement-breakpoint

-- ─── MESSAGES PRÉPARATEUR ────────────────────────────────────────────────────
-- Communication directe préparateur ↔ client sur un dossier
CREATE TABLE "preparer_messages" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tax_return_id"   uuid NOT NULL REFERENCES "tax_returns"("id"),
  "from_user_id"    varchar(255) NOT NULL,
  "to_user_id"      varchar(255) NOT NULL,
  "message_fr"      text NOT NULL,
  "message_en"      text,
  "message_type"    varchar(30) DEFAULT 'note' NOT NULL,
  -- note | document_request | correction_request | approval | question
  "related_document_id"   uuid REFERENCES "fiscal_documents"("id"),
  "related_question_code" varchar(100),
  "is_read"         boolean DEFAULT false NOT NULL,
  "read_at"         timestamp,
  "created_at"      timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "prep_msg_return_idx" ON "preparer_messages"("tax_return_id");--> statement-breakpoint
CREATE INDEX "prep_msg_to_idx"     ON "preparer_messages"("to_user_id");--> statement-breakpoint

-- ─── PROGRESSION DU DOSSIER ──────────────────────────────────────────────────
-- Snapshot calculé — évite de recalculer à chaque render
CREATE TABLE "dossier_progress" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"               varchar(255) NOT NULL,
  "tax_return_id"         uuid NOT NULL REFERENCES "tax_returns"("id") UNIQUE,
  -- Sections
  "identity_pct"          integer DEFAULT 0 NOT NULL,
  "employment_pct"        integer DEFAULT 0 NOT NULL,
  "self_employment_pct"   integer DEFAULT 0 NOT NULL,
  "investment_pct"        integer DEFAULT 0 NOT NULL,
  "deductions_pct"        integer DEFAULT 0 NOT NULL,
  "family_pct"            integer DEFAULT 0 NOT NULL,
  "documents_pct"         integer DEFAULT 0 NOT NULL,
  "validation_pct"        integer DEFAULT 0 NOT NULL,
  -- Global
  "global_pct"            integer DEFAULT 0 NOT NULL,
  -- Compteurs
  "questions_applicable"  integer DEFAULT 0 NOT NULL,
  "questions_answered"    integer DEFAULT 0 NOT NULL,
  "documents_required"    integer DEFAULT 0 NOT NULL,
  "documents_received"    integer DEFAULT 0 NOT NULL,
  "documents_validated"   integer DEFAULT 0 NOT NULL,
  "items_needs_review"    integer DEFAULT 0 NOT NULL,
  -- État
  "is_ready_for_calc"     boolean DEFAULT false NOT NULL,
  "blocking_items"        text,  -- JSON: liste des éléments bloquants
  "last_calculated_at"    timestamp DEFAULT now() NOT NULL,
  "created_at"            timestamp DEFAULT now() NOT NULL,
  "updated_at"            timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

