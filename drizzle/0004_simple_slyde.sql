CREATE TYPE "public"."user_role" AS ENUM('INDIVIDUAL', 'PREPARER', 'BUSINESS', 'ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive', 'suspended', 'pending_verification');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"role" "user_role" DEFAULT 'INDIVIDUAL' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"onboarding_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_sign_in_at" timestamp,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
