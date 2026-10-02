CREATE TYPE "public"."extraction_status" AS ENUM('pending', 'in_progress', 'completed', 'needs_review', 'validated', 'failed');--> statement-breakpoint
CREATE TYPE "public"."field_validation_status" AS ENUM('unreviewed', 'confirmed', 'corrected', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."document_audit_action" ADD VALUE 'document_ocr_started';--> statement-breakpoint
ALTER TYPE "public"."document_audit_action" ADD VALUE 'document_ocr_completed';--> statement-breakpoint
ALTER TYPE "public"."document_audit_action" ADD VALUE 'document_ocr_failed';--> statement-breakpoint
ALTER TYPE "public"."document_audit_action" ADD VALUE 'document_classified';--> statement-breakpoint
ALTER TYPE "public"."document_audit_action" ADD VALUE 'document_extraction_started';--> statement-breakpoint
ALTER TYPE "public"."document_audit_action" ADD VALUE 'document_extraction_completed';--> statement-breakpoint
ALTER TYPE "public"."document_audit_action" ADD VALUE 'document_extraction_failed';--> statement-breakpoint
ALTER TYPE "public"."document_audit_action" ADD VALUE 'document_extraction_reviewed';--> statement-breakpoint
ALTER TYPE "public"."document_audit_action" ADD VALUE 'document_extraction_validated';--> statement-breakpoint
ALTER TYPE "public"."document_status" ADD VALUE 'ocr_completed';--> statement-breakpoint
ALTER TYPE "public"."document_status" ADD VALUE 'classified';--> statement-breakpoint
ALTER TYPE "public"."document_status" ADD VALUE 'extracted';--> statement-breakpoint
ALTER TYPE "public"."document_status" ADD VALUE 'ready_for_tax_return';--> statement-breakpoint
ALTER TYPE "public"."document_status" ADD VALUE 'ocr_failed';--> statement-breakpoint
ALTER TYPE "public"."document_status" ADD VALUE 'classification_failed';--> statement-breakpoint
ALTER TYPE "public"."document_status" ADD VALUE 'extraction_failed';--> statement-breakpoint
ALTER TYPE "public"."document_status" ADD VALUE 'processing_failed';--> statement-breakpoint
CREATE TABLE "document_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_document_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"detected_document_type_id" uuid,
	"classification_confidence" integer,
	"classification_reason" text,
	"detected_tax_year" integer,
	"detected_jurisdiction_id" uuid,
	"status" "extraction_status" DEFAULT 'pending' NOT NULL,
	"ocr_provider" varchar(50),
	"extraction_version" varchar(20) DEFAULT '1.0',
	"overall_confidence" integer,
	"needs_human_review" boolean DEFAULT false,
	"year_mismatch_warning" boolean DEFAULT false,
	"processing_started_at" timestamp,
	"ocr_completed_at" timestamp,
	"classified_at" timestamp,
	"extracted_at" timestamp,
	"reviewed_at" timestamp,
	"reviewed_by_user_id" varchar(255),
	"validated_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_extractions_fiscal_document_id_unique" UNIQUE("fiscal_document_id")
);
--> statement-breakpoint
CREATE TABLE "extraction_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"extraction_id" uuid NOT NULL,
	"field_code" varchar(100) NOT NULL,
	"field_label" varchar(255),
	"page_number" integer,
	"raw_ocr_value" text,
	"ocr_confidence" integer,
	"validated_value" text,
	"validation_status" "field_validation_status" DEFAULT 'unreviewed' NOT NULL,
	"previous_value" text,
	"corrected_by_user_id" varchar(255),
	"corrected_at" timestamp,
	"correction_note" text,
	"needs_review" boolean DEFAULT false,
	"is_required" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_pages" ADD COLUMN "ocr_text" text;--> statement-breakpoint
ALTER TABLE "document_pages" ADD COLUMN "ocr_confidence" integer;--> statement-breakpoint
ALTER TABLE "document_pages" ADD COLUMN "ocr_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "document_pages" ADD COLUMN "ocr_error" text;--> statement-breakpoint
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_fiscal_document_id_fiscal_documents_id_fk" FOREIGN KEY ("fiscal_document_id") REFERENCES "public"."fiscal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_detected_document_type_id_document_types_id_fk" FOREIGN KEY ("detected_document_type_id") REFERENCES "public"."document_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_detected_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("detected_jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_fields" ADD CONSTRAINT "extraction_fields_extraction_id_document_extractions_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."document_extractions"("id") ON DELETE no action ON UPDATE no action;