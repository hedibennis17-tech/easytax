CREATE TYPE "public"."document_audit_action" AS ENUM('document_uploaded', 'document_viewed', 'document_downloaded', 'document_archived', 'document_deleted', 'document_restored', 'document_duplicate_detected');--> statement-breakpoint
CREATE TYPE "public"."document_source" AS ENUM('user_upload', 'employer', 'manual', 'system');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('uploaded', 'stored', 'pending_review', 'ready_for_processing', 'processing', 'processed', 'needs_review', 'verified', 'rejected', 'archived', 'deleted');--> statement-breakpoint
CREATE TABLE "document_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"action" "document_audit_action" NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"storage_key" varchar(1000),
	"ocr_status" varchar(50) DEFAULT 'pending',
	"extracted_data" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"label_fr" varchar(255) NOT NULL,
	"label_en" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"is_federal" boolean DEFAULT true,
	"is_quebec" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fiscal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"tax_profile_id" uuid NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"tax_return_id" uuid,
	"document_type_id" uuid NOT NULL,
	"original_filename" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"storage_path" text NOT NULL,
	"storage_key" varchar(1000) NOT NULL,
	"sha256_hash" varchar(64),
	"source" "document_source" DEFAULT 'user_upload' NOT NULL,
	"status" "document_status" DEFAULT 'uploaded' NOT NULL,
	"page_count" integer,
	"archived_at" timestamp,
	"deleted_at" timestamp,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fiscal_documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "document_audit_logs" ADD CONSTRAINT "document_audit_logs_document_id_fiscal_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."fiscal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_document_id_fiscal_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."fiscal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_tax_profile_id_tax_profiles_id_fk" FOREIGN KEY ("tax_profile_id") REFERENCES "public"."tax_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_tax_return_id_tax_returns_id_fk" FOREIGN KEY ("tax_return_id") REFERENCES "public"."tax_returns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id") ON DELETE no action ON UPDATE no action;