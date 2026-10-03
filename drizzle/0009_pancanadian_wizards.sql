-- Stockage durable des parcours pancanadiens individuel et entreprise
ALTER TABLE "tax_profiles" ADD COLUMN IF NOT EXISTS "pancanadian_data" text;
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "pancanadian_data" text;
