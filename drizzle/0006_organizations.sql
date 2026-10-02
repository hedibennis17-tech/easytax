-- ══════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 4.5 — ORGANIZATIONS, MEMBERSHIPS, PREPARER, INVITATIONS, NOTIFICATIONS
-- Migration: 0006_organizations
-- ══════════════════════════════════════════════════════════════════════════════

-- ENUMS
CREATE TYPE "public"."org_type" AS ENUM(
  'BUSINESS',
  'TAX_FIRM',
  'SOLE_PROPRIETORSHIP'
);--> statement-breakpoint

CREATE TYPE "public"."org_status" AS ENUM(
  'active',
  'suspended',
  'archived'
);--> statement-breakpoint

CREATE TYPE "public"."membership_role" AS ENUM(
  'OWNER',
  'ADMIN',
  'MEMBER',
  'EMPLOYEE',
  'ACCOUNTANT',
  'REVIEWER'
);--> statement-breakpoint

CREATE TYPE "public"."membership_status" AS ENUM(
  'active',
  'invited',
  'suspended',
  'removed'
);--> statement-breakpoint

CREATE TYPE "public"."invitation_type" AS ENUM(
  'ORG_MEMBER',
  'PREPARER_CLIENT',
  'EMPLOYEE'
);--> statement-breakpoint

CREATE TYPE "public"."invitation_status" AS ENUM(
  'pending',
  'accepted',
  'expired',
  'cancelled'
);--> statement-breakpoint

CREATE TYPE "public"."assignment_status" AS ENUM(
  'pending',
  'active',
  'completed',
  'revoked'
);--> statement-breakpoint

-- ─── ORGANIZATIONS ────────────────────────────────────────────────────────────
-- Entreprise, cabinet comptable, ou travailleur autonome enregistré
-- ≠ de tax_profiles (personne physique) et ≠ de employers (entité T4 uniquement)

CREATE TABLE "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" varchar(255) NOT NULL,
  "type" "org_type" NOT NULL DEFAULT 'BUSINESS',
  "status" "org_status" NOT NULL DEFAULT 'active',
  -- Identité légale
  "legal_name" varchar(255) NOT NULL,
  "trade_name" varchar(255),
  -- Numéro d'entreprise — chiffré, jamais en clair
  "business_number_encrypted" text,
  "business_number_last4" varchar(4),
  "business_number_verified" boolean DEFAULT false,
  -- Province / adresse
  "province" varchar(5),
  "address" varchar(255),
  "city" varchar(100),
  "postal_code" varchar(10),
  -- Contact
  "phone" varchar(20),
  "email" varchar(255),
  "website" varchar(255),
  -- Métadonnées
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "organizations_owner_idx" ON "organizations"("owner_user_id");--> statement-breakpoint

-- ─── ORGANIZATION MEMBERSHIPS ─────────────────────────────────────────────────
-- Lien user ↔ organisation avec rôle granulaire
-- RÈGLE : vérification TOUJOURS côté serveur — jamais côté frontend uniquement

CREATE TABLE "organization_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "user_id" varchar(255) NOT NULL,
  "role" "membership_role" NOT NULL DEFAULT 'MEMBER',
  "status" "membership_status" NOT NULL DEFAULT 'active',
  -- Traçabilité invitation
  "invited_by_user_id" varchar(255),
  "invited_at" timestamp,
  "accepted_at" timestamp,
  -- Permissions granulaires (JSON array de strings)
  -- ex: ["read_documents","submit_returns","manage_employees"]
  "permissions" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  -- Un user ne peut être membre qu'une fois par org
  CONSTRAINT "org_membership_unique" UNIQUE("organization_id", "user_id")
);--> statement-breakpoint

CREATE INDEX "memberships_org_idx" ON "organization_memberships"("organization_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "organization_memberships"("user_id");--> statement-breakpoint

-- ─── PREPARER PROFILES ────────────────────────────────────────────────────────
-- Profil préparateur fiscal — lié à un user EasyTax

CREATE TABLE "preparer_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL UNIQUE,
  -- Cabinet optionnel
  "organization_id" uuid REFERENCES "organizations"("id"),
  -- Identité professionnelle
  "license_number" varchar(100),
  "specialty" varchar(255),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "preparer_user_idx" ON "preparer_profiles"("user_id");--> statement-breakpoint

-- ─── PREPARER CLIENT ASSIGNMENTS ──────────────────────────────────────────────
-- Relation explicite préparateur ↔ client
-- Un préparateur NE voit un client que si cette relation existe et est active

CREATE TABLE "preparer_client_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "preparer_id" uuid NOT NULL REFERENCES "preparer_profiles"("id"),
  "client_profile_id" uuid NOT NULL REFERENCES "tax_profiles"("id"),
  "status" "assignment_status" NOT NULL DEFAULT 'pending',
  -- Années fiscales autorisées (JSON array d'entiers)
  -- ex: [2024, 2025]
  "authorized_tax_years" text,
  -- Permissions accordées par le client
  -- ex: ["read_documents","read_returns","submit_returns"]
  "permissions" text,
  "assigned_at" timestamp DEFAULT now(),
  "expires_at" timestamp,
  "revoked_at" timestamp,
  "revoked_by_user_id" varchar(255),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  -- Un préparateur ne peut être assigné qu'une fois par client
  CONSTRAINT "preparer_client_unique" UNIQUE("preparer_id", "client_profile_id")
);--> statement-breakpoint

CREATE INDEX "assignments_preparer_idx" ON "preparer_client_assignments"("preparer_id");--> statement-breakpoint
CREATE INDEX "assignments_client_idx" ON "preparer_client_assignments"("client_profile_id");--> statement-breakpoint

-- ─── INVITATIONS ──────────────────────────────────────────────────────────────
-- Système d'invitations générique
-- Org → user, Préparateur → client, Employeur → employé

CREATE TABLE "invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" "invitation_type" NOT NULL,
  -- Contexte (l'un ou l'autre selon le type)
  "organization_id" uuid REFERENCES "organizations"("id"),
  "preparer_id" uuid REFERENCES "preparer_profiles"("id"),
  -- Destinataire
  "invited_email" varchar(255) NOT NULL,
  "invited_user_id" varchar(255),         -- rempli après acceptation
  -- Rôle proposé dans l'organisation
  "role" "membership_role",
  -- Token sécurisé — jamais dans une URL prévisible
  "token" varchar(255) NOT NULL UNIQUE,
  "status" "invitation_status" NOT NULL DEFAULT 'pending',
  "expires_at" timestamp NOT NULL,
  "accepted_at" timestamp,
  "cancelled_at" timestamp,
  "created_by_user_id" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "invitations_token_idx" ON "invitations"("token");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations"("invited_email");--> statement-breakpoint
CREATE INDEX "invitations_org_idx" ON "invitations"("organization_id");--> statement-breakpoint

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
-- Notifications in-app — jamais de données fiscales sensibles ici

CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL,
  -- Type générique extensible sans migration
  "type" varchar(100) NOT NULL,
  -- ex: "doc_uploaded" | "return_ready" | "payment_due" | "invitation_received"
  -- Contenu
  "title_fr" varchar(255) NOT NULL,
  "title_en" varchar(255),
  "body_fr" text,
  "body_en" text,
  -- Lecture
  "is_read" boolean DEFAULT false NOT NULL,
  "read_at" timestamp,
  -- Lien vers la ressource concernée (optionnel)
  "related_resource_type" varchar(50),  -- "tax_return" | "document" | "invitation" | etc.
  "related_resource_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "notifications_user_idx" ON "notifications"("user_id");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications"("user_id", "is_read");--> statement-breakpoint

-- ─── LIER ORGANIZATIONS AUX GOVERNMENT ACCOUNTS ───────────────────────────────
-- Les comptes gouvernementaux peuvent appartenir à une organisation (≠ individu)
ALTER TABLE "government_accounts"
  ADD COLUMN "organization_id" uuid REFERENCES "organizations"("id");--> statement-breakpoint

-- ─── LIER ORGANIZATIONS AUX FISCAL DOCUMENTS ─────────────────────────────────
-- Un document peut appartenir à une organisation (ex: T4 émis par une entreprise)
ALTER TABLE "fiscal_documents"
  ADD COLUMN "organization_id" uuid REFERENCES "organizations"("id");--> statement-breakpoint

