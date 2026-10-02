import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  timestamp,
  pgEnum,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── ENUMS ───────────────────────────────────────────────────────────────────

export const taxYearStatusEnum = pgEnum("tax_year_status", [
  "open",
  "closed",
  "archived",
]);

export const taxReturnStatusEnum = pgEnum("tax_return_status", [
  "draft",
  "in_progress",
  "review",
  "ready",
  "submitted",
  "accepted",
  "rejected",
  "amended",
  "cancelled",
]);

export const maritalStatusEnum = pgEnum("marital_status", [
  "single",
  "married",
  "common_law",
  "separated",
  "divorced",
  "widowed",
]);

export const provinceEnum = pgEnum("province", [
  "QC",
  "ON",
  "BC",
  "AB",
  "SK",
  "MB",
  "NB",
  "NS",
  "PE",
  "NL",
  "NT",
  "NU",
  "YT",
]);

export const dependentRelationEnum = pgEnum("dependent_relation", [
  "child",
  "stepchild",
  "parent",
  "grandparent",
  "sibling",
  "other",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "profile_created",
  "profile_updated",
  "household_created",
  "household_member_added",
  "household_member_removed",
  "employer_added",
  "employer_updated",
  "employer_removed",
  "return_created",
  "return_status_changed",
  "self_employment_added",
  "self_employment_updated",
]);

// ─── TAX YEARS ───────────────────────────────────────────────────────────────

export const taxYears = pgTable("tax_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  year: integer("year").notNull().unique(),
  status: taxYearStatusEnum("status").notNull().default("open"),
  filingDeadlineFederal: date("filing_deadline_federal"),
  filingDeadlineQuebec: date("filing_deadline_quebec"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── USERS (référence auth — pas de duplication) ─────────────────────────────
// On référence l'userId (venant de l'auth, ex: NextAuth/Clerk/etc.)
// sans stocker les credentials ici.

export const taxProfiles = pgTable("tax_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull().unique(), // ref auth externe
  // Identité
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  dateOfBirth: date("date_of_birth"),
  // NAS — stocké chiffré, jamais exposé en clair via API publique
  sinEncrypted: text("sin_encrypted"), // AES-256 côté serveur uniquement
  sinLastFour: varchar("sin_last_four", { length: 4 }), // pour affichage UI seulement
  sinStatus: varchar("sin_status", { length: 20 }).default("unverified"), // unverified | verified | invalid
  sinVerified: boolean("sin_verified").default(false),
  sinVerifiedAt: timestamp("sin_verified_at"),
  // Contact
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  // Adresse
  address: varchar("address", { length: 255 }),
  city: varchar("city", { length: 100 }),
  province: provinceEnum("province"),
  postalCode: varchar("postal_code", { length: 10 }),
  // Situation
  maritalStatus: maritalStatusEnum("marital_status").default("single"),
  fiscalResidence: provinceEnum("fiscal_residence"),
  isCanadianCitizen: boolean("is_canadian_citizen"),
  isQuebecResident: boolean("is_quebec_resident").default(false),
  // Méta
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── HOUSEHOLDS ──────────────────────────────────────────────────────────────

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  primaryProfileId: uuid("primary_profile_id")
    .notNull()
    .references(() => taxProfiles.id),
  spouseProfileId: uuid("spouse_profile_id").references(() => taxProfiles.id), // nullable
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── DEPENDENTS ──────────────────────────────────────────────────────────────

export const dependents = pgTable("dependents", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  relation: dependentRelationEnum("relation").notNull().default("child"),
  sinEncrypted: text("sin_encrypted"),
  sinLastFour: varchar("sin_last_four", { length: 4 }),
  isFullTimeStudent: boolean("is_full_time_student").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── EMPLOYERS ───────────────────────────────────────────────────────────────

export const employers = pgTable("employers", {
  id: uuid("id").primaryKey().defaultRandom(),
  legalName: varchar("legal_name", { length: 255 }).notNull(),
  tradeName: varchar("trade_name", { length: 255 }),
  address: varchar("address", { length: 255 }),
  city: varchar("city", { length: 100 }),
  province: provinceEnum("province"),
  postalCode: varchar("postal_code", { length: 10 }),
  phone: varchar("phone", { length: 20 }),
  businessNumber: varchar("business_number", { length: 20 }), // NE fédéral
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── PROFILE ↔ EMPLOYER (relation annuelle) ───────────────────────────────────

export const profileEmployers = pgTable("profile_employers", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => taxProfiles.id),
  employerId: uuid("employer_id")
    .notNull()
    .references(() => employers.id),
  taxYearId: uuid("tax_year_id")
    .notNull()
    .references(() => taxYears.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── SELF EMPLOYMENT ─────────────────────────────────────────────────────────

export const selfEmployments = pgTable("self_employments", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => taxProfiles.id),
  businessName: varchar("business_name", { length: 255 }),
  tradeName: varchar("trade_name", { length: 255 }),
  activityDescription: text("activity_description"),
  startDate: date("start_date"),
  address: varchar("address", { length: 255 }),
  city: varchar("city", { length: 100 }),
  province: provinceEnum("province"),
  postalCode: varchar("postal_code", { length: 10 }),
  businessNumber: varchar("business_number", { length: 20 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── TAX RETURNS ─────────────────────────────────────────────────────────────

export const taxReturns = pgTable("tax_returns", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => taxProfiles.id),
  taxYearId: uuid("tax_year_id")
    .notNull()
    .references(() => taxYears.id),
  householdId: uuid("household_id").references(() => households.id),
  status: taxReturnStatusEnum("status").notNull().default("draft"),
  // Séparation fédéral / Québec
  federalStatus: taxReturnStatusEnum("federal_status").default("draft"),
  quebecStatus: taxReturnStatusEnum("quebec_status").default("draft"),
  // Résultat estimé (rempli plus tard par le moteur fiscal)
  estimatedFederalRefund: integer("estimated_federal_refund"), // cents
  estimatedQuebecRefund: integer("estimated_quebec_refund"),   // cents
  // Versionnage
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  submittedAt: timestamp("submitted_at"),
});

// ─── AUDIT LOG ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").references(() => taxProfiles.id),
  taxReturnId: uuid("tax_return_id").references(() => taxReturns.id),
  action: auditActionEnum("action").notNull(),
  // JAMAIS de NAS, jamais de données fiscales sensibles dans les logs
  metadata: text("metadata"), // JSON stringifié, données non-sensibles uniquement
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── RELATIONS ───────────────────────────────────────────────────────────────

export const taxProfilesRelations = relations(taxProfiles, ({ one, many }) => ({
  household: one(households, {
    fields: [taxProfiles.id],
    references: [households.primaryProfileId],
  }),
  profileEmployers: many(profileEmployers),
  selfEmployments: many(selfEmployments),
  taxReturns: many(taxReturns),
  auditLogs: many(auditLogs),
}));

export const householdsRelations = relations(households, ({ one, many }) => ({
  primaryProfile: one(taxProfiles, {
    fields: [households.primaryProfileId],
    references: [taxProfiles.id],
  }),
  spouseProfile: one(taxProfiles, {
    fields: [households.spouseProfileId],
    references: [taxProfiles.id],
  }),
  dependents: many(dependents),
  taxReturns: many(taxReturns),
}));

export const dependentsRelations = relations(dependents, ({ one }) => ({
  household: one(households, {
    fields: [dependents.householdId],
    references: [households.id],
  }),
}));

export const employersRelations = relations(employers, ({ many }) => ({
  profileEmployers: many(profileEmployers),
}));

export const profileEmployersRelations = relations(profileEmployers, ({ one }) => ({
  profile: one(taxProfiles, {
    fields: [profileEmployers.profileId],
    references: [taxProfiles.id],
  }),
  employer: one(employers, {
    fields: [profileEmployers.employerId],
    references: [employers.id],
  }),
  taxYear: one(taxYears, {
    fields: [profileEmployers.taxYearId],
    references: [taxYears.id],
  }),
}));

export const selfEmploymentsRelations = relations(selfEmployments, ({ one }) => ({
  profile: one(taxProfiles, {
    fields: [selfEmployments.profileId],
    references: [taxProfiles.id],
  }),
}));

export const taxReturnsRelations = relations(taxReturns, ({ one, many }) => ({
  profile: one(taxProfiles, {
    fields: [taxReturns.profileId],
    references: [taxProfiles.id],
  }),
  taxYear: one(taxYears, {
    fields: [taxReturns.taxYearId],
    references: [taxYears.id],
  }),
  household: one(households, {
    fields: [taxReturns.householdId],
    references: [households.id],
  }),
  auditLogs: many(auditLogs),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  profile: one(taxProfiles, {
    fields: [auditLogs.profileId],
    references: [taxProfiles.id],
  }),
  taxReturn: one(taxReturns, {
    fields: [auditLogs.taxReturnId],
    references: [taxReturns.id],
  }),
}));

// ─── ÉTAPE 2 : COFFRE-FORT DOCUMENTAIRE ──────────────────────────────────────

export const documentSourceEnum = pgEnum("document_source", [
  "user_upload",
  "employer",
  "manual",
  "system",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "uploaded",
  "stored",
  "pending_review",
  "ready_for_processing",
  "processing",
  "processed",
  "needs_review",
  "verified",
  "rejected",
  "archived",
  "deleted",
  // Étape 3 — pipeline OCR
  "ocr_completed",
  "classified",
  "extracted",
  "ready_for_tax_return",
  "ocr_failed",
  "classification_failed",
  "extraction_failed",
  "processing_failed",
]);

export const documentAuditActionEnum = pgEnum("document_audit_action", [
  "document_uploaded",
  "document_viewed",
  "document_downloaded",
  "document_archived",
  "document_deleted",
  "document_restored",
  "document_duplicate_detected",
  // Étape 3 — OCR pipeline
  "document_ocr_started",
  "document_ocr_completed",
  "document_ocr_failed",
  "document_classified",
  "document_extraction_started",
  "document_extraction_completed",
  "document_extraction_failed",
  "document_extraction_reviewed",
  "document_extraction_validated",
]);

// ─── TYPES DE DOCUMENTS (extensible sans modifier le code) ───────────────────

export const documentTypes = pgTable("document_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(), // ex: "T4", "RL-1"
  labelFr: varchar("label_fr", { length: 255 }).notNull(),
  labelEn: varchar("label_en", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(), // "employment", "investment", "medical", "other"
  isFederal: boolean("is_federal").default(true),
  isQuebec: boolean("is_quebec").default(false),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── DOCUMENTS ───────────────────────────────────────────────────────────────

export const fiscalDocuments = pgTable("fiscal_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Ownership — jamais accessible cross-user
  userId: varchar("user_id", { length: 255 }).notNull(),
  taxProfileId: uuid("tax_profile_id")
    .notNull()
    .references(() => taxProfiles.id),
  taxYearId: uuid("tax_year_id")
    .notNull()
    .references(() => taxYears.id),
  taxReturnId: uuid("tax_return_id").references(() => taxReturns.id),
  documentTypeId: uuid("document_type_id")
    .notNull()
    .references(() => documentTypes.id),
  // Métadonnées fichier
  originalFilename: varchar("original_filename", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  // Stockage — chemin interne non-prévisible, JAMAIS le nom original
  storagePath: text("storage_path").notNull(), // ex: tax-documents/{userId}/{taxYearId}/{uuid}
  storageKey: varchar("storage_key", { length: 1000 }).notNull().unique(),
  // Intégrité
  sha256Hash: varchar("sha256_hash", { length: 64 }), // détection doublons
  // Source
  source: documentSourceEnum("source").notNull().default("user_upload"),
  // Statut workflow
  status: documentStatusEnum("status").notNull().default("uploaded"),
  // Pages (PDF multi-pages)
  pageCount: integer("page_count"),
  // Suppression douce
  archivedAt: timestamp("archived_at"),
  deletedAt: timestamp("deleted_at"),
  // Dates
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── PAGES DE DOCUMENT (pour PDF multi-pages, préparation OCR étape 3) ───────

export const documentPages = pgTable("document_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => fiscalDocuments.id),
  pageNumber: integer("page_number").notNull(),
  storageKey: varchar("storage_key", { length: 1000 }), // page extraite si nécessaire
  // Étape 3 OCR
  ocrStatus: varchar("ocr_status", { length: 50 }).default("pending"), // pending | processing | completed | failed
  ocrText: text("ocr_text"),             // texte brut extrait par OCR
  ocrConfidence: integer("ocr_confidence"), // 0-100
  ocrCompletedAt: timestamp("ocr_completed_at"),
  ocrError: text("ocr_error"),
  extractedData: text("extracted_data"), // JSON structuré — rempli par l'extracteur
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── AUDIT LOG DOCUMENTS ─────────────────────────────────────────────────────

export const documentAuditLogs = pgTable("document_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => fiscalDocuments.id),
  userId: varchar("user_id", { length: 255 }).notNull(),
  action: documentAuditActionEnum("action").notNull(),
  // Métadonnées non-sensibles uniquement — JAMAIS NAS, contenu, revenus
  metadata: text("metadata"), // JSON: {ip, userAgent, filename (non sensible)}
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── RELATIONS ÉTAPE 2 ───────────────────────────────────────────────────────

export const documentTypesRelations = relations(documentTypes, ({ many }) => ({
  fiscalDocuments: many(fiscalDocuments),
}));

export const fiscalDocumentsRelations = relations(fiscalDocuments, ({ one, many }) => ({
  taxProfile: one(taxProfiles, {
    fields: [fiscalDocuments.taxProfileId],
    references: [taxProfiles.id],
  }),
  taxYear: one(taxYears, {
    fields: [fiscalDocuments.taxYearId],
    references: [taxYears.id],
  }),
  taxReturn: one(taxReturns, {
    fields: [fiscalDocuments.taxReturnId],
    references: [taxReturns.id],
  }),
  documentType: one(documentTypes, {
    fields: [fiscalDocuments.documentTypeId],
    references: [documentTypes.id],
  }),
  pages: many(documentPages),
  auditLogs: many(documentAuditLogs),
}));

export const documentPagesRelations = relations(documentPages, ({ one }) => ({
  document: one(fiscalDocuments, {
    fields: [documentPages.documentId],
    references: [fiscalDocuments.id],
  }),
}));

export const documentAuditLogsRelations = relations(documentAuditLogs, ({ one }) => ({
  document: one(fiscalDocuments, {
    fields: [documentAuditLogs.documentId],
    references: [fiscalDocuments.id],
  }),
}));

// ══════════════════════════════════════════════════════════════════════════════
// ÉTAPE 2.1 — ARCHITECTURE PANCANADIENNE
// ══════════════════════════════════════════════════════════════════════════════

// ─── ENUMS 2.1 ───────────────────────────────────────────────────────────────

export const jurisdictionLevelEnum = pgEnum("jurisdiction_level", [
  "federal",
  "provincial",
  "territorial",
]);

export const taxAdministrationEnum = pgEnum("tax_administration", [
  "CRA",
  "REVENU_QUEBEC",
  "CRA_AND_REVENU_QUEBEC",
]);

export const governmentEnum = pgEnum("government", [
  "CRA",
  "REVENU_QUEBEC",
  "OTHER",
]);

export const govAccountTypeEnum = pgEnum("gov_account_type", [
  "PERSONAL",
  "BUSINESS",
  "REPRESENTATIVE",
  "OTHER",
]);

export const govAccountStatusEnum = pgEnum("gov_account_status", [
  "active",
  "inactive",
  "unverified",
  "suspended",
]);

export const accessCodeTypeEnum = pgEnum("access_code_type", [
  "DOWNLOAD_CODE",
  "IMPOTNET_ACCESS_CODE",
  "REGISTRATION_CODE",
  "NETFILE_ACCESS_CODE",
  "OTHER",
]);

export const accessCodeStatusEnum = pgEnum("access_code_status", [
  "active",
  "used",
  "expired",
  "disabled",
  "replaced",
]);

export const documentPartyTypeEnum = pgEnum("document_party_type", [
  "TAXPAYER",
  "SPOUSE",
  "DEPENDENT",
  "EMPLOYER",
  "BUSINESS",
  "OTHER",
]);

export const questionTypeEnum = pgEnum("question_type", [
  "BOOLEAN",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "NUMBER",
  "DECIMAL",
  "TEXT",
  "DATE",
  "MONEY",
  "DOCUMENT",
  "ADDRESS",
  "PERSON",
  "EMPLOYER",
]);

export const questionSectionEnum = pgEnum("question_section", [
  "identity",
  "family",
  "employment",
  "self_employment",
  "investment",
  "deductions",
  "credits",
  "provincial",
  "review",
]);

export const ruleOperatorEnum = pgEnum("rule_operator", [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "not_in",
  "contains",
  "is_null",
  "is_not_null",
]);

export const govAuditActionEnum = pgEnum("gov_audit_action", [
  "sin_viewed",
  "sin_updated",
  "government_code_created",
  "government_code_viewed",
  "government_code_updated",
  "government_code_verified",
  "government_code_disabled",
  "gov_account_created",
  "gov_account_updated",
  "document_party_linked",
]);

// ─── JURISDICTIONS ───────────────────────────────────────────────────────────

export const jurisdictions = pgTable("jurisdictions", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 10 }).notNull().unique(), // QC, ON, AB, etc. + CA (fédéral)
  countryCode: varchar("country_code", { length: 5 }).notNull().default("CA"),
  nameFr: varchar("name_fr", { length: 255 }).notNull(),
  nameEn: varchar("name_en", { length: 255 }).notNull(),
  jurisdictionLevel: jurisdictionLevelEnum("jurisdiction_level").notNull(),
  taxAdministration: taxAdministrationEnum("tax_administration").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  // Préparation futurs calculs — pas de hardcode
  hasProvincialReturn: boolean("has_provincial_return").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── JURISDICTION TAX YEAR RULES (deadlines par juridiction par année) ────────

export const jurisdictionTaxYearRules = pgTable("jurisdiction_tax_year_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  jurisdictionId: uuid("jurisdiction_id")
    .notNull()
    .references(() => jurisdictions.id),
  taxYearId: uuid("tax_year_id")
    .notNull()
    .references(() => taxYears.id),
  filingDeadline: date("filing_deadline"),
  paymentDeadline: date("payment_deadline"),
  // Réservé pour les futurs paramètres fiscaux versionnés
  rulesVersion: varchar("rules_version", { length: 20 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── GOVERNMENT ACCOUNTS ─────────────────────────────────────────────────────

export const governmentAccounts = pgTable("government_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  taxProfileId: uuid("tax_profile_id")
    .notNull()
    .references(() => taxProfiles.id),
  government: governmentEnum("government").notNull(),
  accountType: govAccountTypeEnum("account_type").notNull().default("PERSONAL"),
  // Identifiant chiffré — jamais en clair
  identifierEncrypted: text("identifier_encrypted"),
  identifierLast4: varchar("identifier_last4", { length: 4 }),
  status: govAccountStatusEnum("status").notNull().default("unverified"),
  verifiedAt: timestamp("verified_at"),
  lastVerifiedAt: timestamp("last_verified_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── TAX YEAR ACCESS CODES ───────────────────────────────────────────────────
// Codes annuels : DOWNLOAD_CODE, IMPOTNET_ACCESS_CODE, etc.
// Liés à une année fiscale spécifique — jamais copiés automatiquement d'une année à l'autre

export const taxYearAccessCodes = pgTable("tax_year_access_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  taxProfileId: uuid("tax_profile_id")
    .notNull()
    .references(() => taxProfiles.id),
  taxYearId: uuid("tax_year_id")
    .notNull()
    .references(() => taxYears.id),
  taxReturnId: uuid("tax_return_id").references(() => taxReturns.id),
  jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id),
  government: governmentEnum("government").notNull(),
  codeType: accessCodeTypeEnum("code_type").notNull(),
  // Code chiffré — jamais retourné en clair par l'API publique
  codeEncrypted: text("code_encrypted"),
  codeLast4: varchar("code_last4", { length: 4 }),
  status: accessCodeStatusEnum("status").notNull().default("active"),
  issuedAt: timestamp("issued_at"),
  expiresAt: timestamp("expires_at"),
  verifiedAt: timestamp("verified_at"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── DOCUMENT PARTIES ────────────────────────────────────────────────────────
// Lier un document fiscal à ses parties : contribuable, employeur, conjoint, etc.

export const documentParties = pgTable("document_parties", {
  id: uuid("id").primaryKey().defaultRandom(),
  fiscalDocumentId: uuid("fiscal_document_id")
    .notNull()
    .references(() => fiscalDocuments.id),
  partyType: documentPartyTypeEnum("party_type").notNull(),
  // ID générique — peut référencer tax_profiles.id, employers.id, dependents.id, etc.
  partyId: uuid("party_id").notNull(),
  relationship: varchar("relationship", { length: 100 }), // ex: "primary_taxpayer", "employer"
  jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id),
  taxYearId: uuid("tax_year_id").references(() => taxYears.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── TAX QUESTIONS ───────────────────────────────────────────────────────────

export const taxQuestions = pgTable("tax_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 100 }).notNull(), // ex: "has_employment_income"
  version: integer("version").notNull().default(1),
  jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id), // null = toutes juridictions
  taxYearId: uuid("tax_year_id").references(() => taxYears.id), // null = toutes années
  section: questionSectionEnum("section").notNull(),
  questionType: questionTypeEnum("question_type").notNull(),
  textFr: text("text_fr").notNull(),
  textEn: text("text_en").notNull(),
  hintFr: text("hint_fr"),
  hintEn: text("hint_en"),
  required: boolean("required").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── TAX QUESTION OPTIONS (pour SINGLE_CHOICE / MULTIPLE_CHOICE) ─────────────

export const taxQuestionOptions = pgTable("tax_question_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => taxQuestions.id),
  value: varchar("value", { length: 100 }).notNull(),
  labelFr: varchar("label_fr", { length: 255 }).notNull(),
  labelEn: varchar("label_en", { length: 255 }).notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── TAX QUESTION RULES (règles déclaratives — pas de code arbitraire) ────────

export const taxQuestionRules = pgTable("tax_question_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => taxQuestions.id),
  // IF conditionQuestionCode + operator + conditionValue THEN show/hide questionId
  conditionQuestionCode: varchar("condition_question_code", { length: 100 }).notNull(),
  operator: ruleOperatorEnum("operator").notNull(),
  conditionValue: varchar("condition_value", { length: 255 }),
  action: varchar("action", { length: 20 }).notNull().default("show"), // show | hide | require
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── TAX QUESTION ANSWERS ────────────────────────────────────────────────────

export const taxQuestionAnswers = pgTable("tax_question_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  taxProfileId: uuid("tax_profile_id")
    .notNull()
    .references(() => taxProfiles.id),
  taxYearId: uuid("tax_year_id")
    .notNull()
    .references(() => taxYears.id),
  taxReturnId: uuid("tax_return_id").references(() => taxReturns.id),
  questionId: uuid("question_id")
    .notNull()
    .references(() => taxQuestions.id),
  questionVersion: integer("question_version").notNull().default(1),
  // Valeur de la réponse (texte, booléen sérialisé, montant, etc.)
  answerValue: text("answer_value"),
  answerJson: text("answer_json"), // pour réponses complexes
  // Historique
  previousValue: text("previous_value"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── GOVERNMENT AUDIT LOG ────────────────────────────────────────────────────

export const governmentAuditLogs = pgTable("government_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  taxProfileId: uuid("tax_profile_id").references(() => taxProfiles.id),
  action: govAuditActionEnum("action").notNull(),
  // JAMAIS : NAS complet, code complet, mot de passe, valeur sensible
  metadata: text("metadata"), // JSON non-sensible
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── RELATIONS 2.1 ───────────────────────────────────────────────────────────

export const jurisdictionsRelations = relations(jurisdictions, ({ many }) => ({
  rules: many(jurisdictionTaxYearRules),
  accessCodes: many(taxYearAccessCodes),
  documentParties: many(documentParties),
  questions: many(taxQuestions),
}));

export const jurisdictionTaxYearRulesRelations = relations(jurisdictionTaxYearRules, ({ one }) => ({
  jurisdiction: one(jurisdictions, {
    fields: [jurisdictionTaxYearRules.jurisdictionId],
    references: [jurisdictions.id],
  }),
  taxYear: one(taxYears, {
    fields: [jurisdictionTaxYearRules.taxYearId],
    references: [taxYears.id],
  }),
}));

export const governmentAccountsRelations = relations(governmentAccounts, ({ one }) => ({
  taxProfile: one(taxProfiles, {
    fields: [governmentAccounts.taxProfileId],
    references: [taxProfiles.id],
  }),
}));

export const taxYearAccessCodesRelations = relations(taxYearAccessCodes, ({ one }) => ({
  taxProfile: one(taxProfiles, {
    fields: [taxYearAccessCodes.taxProfileId],
    references: [taxProfiles.id],
  }),
  taxYear: one(taxYears, {
    fields: [taxYearAccessCodes.taxYearId],
    references: [taxYears.id],
  }),
  taxReturn: one(taxReturns, {
    fields: [taxYearAccessCodes.taxReturnId],
    references: [taxReturns.id],
  }),
  jurisdiction: one(jurisdictions, {
    fields: [taxYearAccessCodes.jurisdictionId],
    references: [jurisdictions.id],
  }),
}));

export const documentPartiesRelations = relations(documentParties, ({ one }) => ({
  fiscalDocument: one(fiscalDocuments, {
    fields: [documentParties.fiscalDocumentId],
    references: [fiscalDocuments.id],
  }),
  jurisdiction: one(jurisdictions, {
    fields: [documentParties.jurisdictionId],
    references: [jurisdictions.id],
  }),
  taxYear: one(taxYears, {
    fields: [documentParties.taxYearId],
    references: [taxYears.id],
  }),
}));

export const taxQuestionsRelations = relations(taxQuestions, ({ one, many }) => ({
  jurisdiction: one(jurisdictions, {
    fields: [taxQuestions.jurisdictionId],
    references: [jurisdictions.id],
  }),
  taxYear: one(taxYears, {
    fields: [taxQuestions.taxYearId],
    references: [taxYears.id],
  }),
  options: many(taxQuestionOptions),
  rules: many(taxQuestionRules),
  answers: many(taxQuestionAnswers),
}));

export const taxQuestionOptionsRelations = relations(taxQuestionOptions, ({ one }) => ({
  question: one(taxQuestions, {
    fields: [taxQuestionOptions.questionId],
    references: [taxQuestions.id],
  }),
}));

export const taxQuestionRulesRelations = relations(taxQuestionRules, ({ one }) => ({
  question: one(taxQuestions, {
    fields: [taxQuestionRules.questionId],
    references: [taxQuestions.id],
  }),
}));

export const taxQuestionAnswersRelations = relations(taxQuestionAnswers, ({ one }) => ({
  taxProfile: one(taxProfiles, {
    fields: [taxQuestionAnswers.taxProfileId],
    references: [taxProfiles.id],
  }),
  taxYear: one(taxYears, {
    fields: [taxQuestionAnswers.taxYearId],
    references: [taxYears.id],
  }),
  taxReturn: one(taxReturns, {
    fields: [taxQuestionAnswers.taxReturnId],
    references: [taxReturns.id],
  }),
  question: one(taxQuestions, {
    fields: [taxQuestionAnswers.questionId],
    references: [taxQuestions.id],
  }),
}));

export const governmentAuditLogsRelations = relations(governmentAuditLogs, ({ one }) => ({
  taxProfile: one(taxProfiles, {
    fields: [governmentAuditLogs.taxProfileId],
    references: [taxProfiles.id],
  }),
}));

// ══════════════════════════════════════════════════════════════════════════════
// ÉTAPE 3 — OCR + EXTRACTION FISCALE
// ══════════════════════════════════════════════════════════════════════════════

export const extractionStatusEnum = pgEnum("extraction_status", [
  "pending",
  "in_progress",
  "completed",
  "needs_review",
  "validated",
  "failed",
]);

export const fieldValidationStatusEnum = pgEnum("field_validation_status", [
  "unreviewed",
  "confirmed",
  "corrected",
  "rejected",
]);

// ─── DOCUMENT EXTRACTIONS ────────────────────────────────────────────────────
// Une extraction par document — résultat global du pipeline OCR+classification

export const documentExtractions = pgTable("document_extractions", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Ownership
  fiscalDocumentId: uuid("fiscal_document_id")
    .notNull()
    .unique()
    .references(() => fiscalDocuments.id),
  userId: varchar("user_id", { length: 255 }).notNull(),
  // Classification détectée
  detectedDocumentTypeId: uuid("detected_document_type_id")
    .references(() => documentTypes.id),
  classificationConfidence: integer("classification_confidence"), // 0-100
  classificationReason: text("classification_reason"),
  // Année et juridiction détectées
  detectedTaxYear: integer("detected_tax_year"),
  detectedJurisdictionId: uuid("detected_jurisdiction_id")
    .references(() => jurisdictions.id),
  // Statut global extraction
  status: extractionStatusEnum("status").notNull().default("pending"),
  // Provider OCR utilisé
  ocrProvider: varchar("ocr_provider", { length: 50 }), // "google", "mock", etc.
  extractionVersion: varchar("extraction_version", { length: 20 }).default("1.0"),
  // Confiance globale 0-100
  overallConfidence: integer("overall_confidence"),
  // Flags
  needsHumanReview: boolean("needs_human_review").default(false),
  yearMismatchWarning: boolean("year_mismatch_warning").default(false),
  // Timestamps
  processingStartedAt: timestamp("processing_started_at"),
  ocrCompletedAt: timestamp("ocr_completed_at"),
  classifiedAt: timestamp("classified_at"),
  extractedAt: timestamp("extracted_at"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedByUserId: varchar("reviewed_by_user_id", { length: 255 }),
  validatedAt: timestamp("validated_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── EXTRACTION FIELDS ───────────────────────────────────────────────────────
// Champs individuels extraits — UN enregistrement par case/champ détecté

export const extractionFields = pgTable("extraction_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  extractionId: uuid("extraction_id")
    .notNull()
    .references(() => documentExtractions.id),
  // Identification du champ
  fieldCode: varchar("field_code", { length: 100 }).notNull(), // ex: "box_14", "employment_income", "employer_name"
  fieldLabel: varchar("field_label", { length: 255 }),          // ex: "Case 14 — Revenus d'emploi"
  pageNumber: integer("page_number"),
  // Valeur brute OCR — jamais écrasée
  rawOcrValue: text("raw_ocr_value"),
  ocrConfidence: integer("ocr_confidence"), // 0-100 pour ce champ spécifique
  // Valeur validée — null si pas encore confirmée
  validatedValue: text("validated_value"),
  validationStatus: fieldValidationStatusEnum("validation_status")
    .notNull()
    .default("unreviewed"),
  // Historique correction
  previousValue: text("previous_value"),
  correctedByUserId: varchar("corrected_by_user_id", { length: 255 }),
  correctedAt: timestamp("corrected_at"),
  correctionNote: text("correction_note"),
  // Flags
  needsReview: boolean("needs_review").default(false),
  isRequired: boolean("is_required").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── RELATIONS ÉTAPE 3 ───────────────────────────────────────────────────────

export const documentExtractionsRelations = relations(documentExtractions, ({ one, many }) => ({
  fiscalDocument: one(fiscalDocuments, {
    fields: [documentExtractions.fiscalDocumentId],
    references: [fiscalDocuments.id],
  }),
  detectedDocumentType: one(documentTypes, {
    fields: [documentExtractions.detectedDocumentTypeId],
    references: [documentTypes.id],
  }),
  detectedJurisdiction: one(jurisdictions, {
    fields: [documentExtractions.detectedJurisdictionId],
    references: [jurisdictions.id],
  }),
  fields: many(extractionFields),
}));

export const extractionFieldsRelations = relations(extractionFields, ({ one }) => ({
  extraction: one(documentExtractions, {
    fields: [extractionFields.extractionId],
    references: [documentExtractions.id],
  }),
}));

// ══════════════════════════════════════════════════════════════════════════════
// ÉTAPE 3A — AUTHENTIFICATION + RÔLES
// ══════════════════════════════════════════════════════════════════════════════

export const userRoleEnum = pgEnum("user_role", [
  "INDIVIDUAL",   // Particulier — déclare ses propres impôts
  "PREPARER",     // Préparateur fiscal — gère plusieurs clients
  "BUSINESS",     // Entreprise — gère ses employés
  "ADMIN",        // Administrateur EasyTax
  "SUPER_ADMIN",  // Super administrateur
]);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "inactive",
  "suspended",
  "pending_verification",
]);

// ─── USERS (table interne EasyTax liée à Clerk) ───────────────────────────────
// Jamais de mot de passe ici — Clerk gère l'auth complètement

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Clerk ID — point d'entrée de toute la sécurité
  clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  role: userRoleEnum("role").notNull().default("INDIVIDUAL"),
  status: userStatusEnum("status").notNull().default("active"),
  // Onboarding
  onboardingCompleted: boolean("onboarding_completed").default(false),
  // Jamais de mot de passe — Clerk gère ça
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastSignInAt: timestamp("last_sign_in_at"),
});

// ─── RELATIONS users ──────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  taxProfiles: many(taxProfiles),
}));

// ══════════════════════════════════════════════════════════════════════════════
// ÉTAPE 4 — TAX ENGINE + QUESTIONNAIRE INTELLIGENT
// ══════════════════════════════════════════════════════════════════════════════

// ─── ENUMS ÉTAPE 4 ───────────────────────────────────────────────────────────

export const incomeCategoryEnum = pgEnum("income_category", [
  "employment",
  "self_employment",
  "pension",
  "ei_benefits",
  "social_assistance",
  "interest",
  "dividends_eligible",
  "dividends_ineligible",
  "capital_gains",
  "rental",
  "foreign_income",
  "other_income",
]);

export const deductionCategoryEnum = pgEnum("deduction_category", [
  "rrsp",
  "union_dues",
  "childcare",
  "moving_expenses",
  "employment_expenses",
  "carrying_charges",
  "other_deductions",
]);

export const creditCategoryEnum = pgEnum("credit_category", [
  "basic_personal",
  "age",
  "spouse_or_cp",
  "caregiver",
  "disability",
  "tuition",
  "medical",
  "donations",
  "home_buyers",
  "first_home_savings",
  "climate_action",
  "other_credits",
]);

export const calculationStatusEnum = pgEnum("calculation_status", [
  "pending",
  "in_progress",
  "completed",
  "stale",
  "error",
]);

export const taxRuleTypeEnum = pgEnum("rule_type", [
  "bracket",
  "rate",
  "flat_amount",
  "exemption",
  "threshold",
  "credit_rate",
  "phase_out",
]);

export const questionnaireStatusEnum = pgEnum("questionnaire_status", [
  "not_started",
  "in_progress",
  "completed",
]);

// ─── TAX RULES ───────────────────────────────────────────────────────────────

export const taxRules = pgTable("tax_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  jurisdictionId: uuid("jurisdiction_id")
    .notNull()
    .references(() => jurisdictions.id),
  taxYearId: uuid("tax_year_id")
    .notNull()
    .references(() => taxYears.id),
  ruleType: taxRuleTypeEnum("rule_type").notNull(),
  ruleCode: varchar("rule_code", { length: 100 }).notNull(),
  descriptionFr: text("description_fr"),
  descriptionEn: text("description_en"),
  // Montants en cents (bigint pour précision monétaire exacte)
  amountCents: integer("amount_cents"),
  rateBasisPoints: integer("rate_basis_points"), // ex: 2050 = 20.50%
  minAmountCents: integer("min_amount_cents"),
  maxAmountCents: integer("max_amount_cents"),
  thresholdCents: integer("threshold_cents"),
  // Versionnage
  ruleVersion: varchar("rule_version", { length: 20 }).notNull().default("1.0"),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  isActive: boolean("is_active").notNull().default(true),
  // Référence source
  sourceReference: varchar("source_reference", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── INCOME ENTRIES ──────────────────────────────────────────────────────────

export const incomeEntries = pgTable("income_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  taxProfileId: uuid("tax_profile_id")
    .notNull()
    .references(() => taxProfiles.id),
  taxYearId: uuid("tax_year_id")
    .notNull()
    .references(() => taxYears.id),
  taxReturnId: uuid("tax_return_id").references(() => taxReturns.id),
  category: incomeCategoryEnum("category").notNull(),
  // Source
  sourceDocumentId: uuid("source_document_id").references(() => fiscalDocuments.id),
  sourceType: varchar("source_type", { length: 50 }).notNull().default("manual"),
  // Montant en cents — jamais de float pour l'argent
  amountCents: integer("amount_cents").notNull().default(0),
  description: varchar("description", { length: 500 }),
  employerName: varchar("employer_name", { length: 255 }),
  // Validation — le Tax Engine n'utilise QUE les données validées
  isValidated: boolean("is_validated").notNull().default(false),
  validatedAt: timestamp("validated_at"),
  validatedByUserId: varchar("validated_by_user_id", { length: 255 }),
  // Revenu étranger
  isForeign: boolean("is_foreign").default(false),
  foreignCurrency: varchar("foreign_currency", { length: 10 }),
  foreignAmountCents: integer("foreign_amount_cents"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── DEDUCTION ENTRIES ───────────────────────────────────────────────────────

export const deductionEntries = pgTable("deduction_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  taxProfileId: uuid("tax_profile_id")
    .notNull()
    .references(() => taxProfiles.id),
  taxYearId: uuid("tax_year_id")
    .notNull()
    .references(() => taxYears.id),
  taxReturnId: uuid("tax_return_id").references(() => taxReturns.id),
  category: deductionCategoryEnum("category").notNull(),
  sourceDocumentId: uuid("source_document_id").references(() => fiscalDocuments.id),
  sourceType: varchar("source_type", { length: 50 }).notNull().default("manual"),
  amountCents: integer("amount_cents").notNull().default(0),
  description: varchar("description", { length: 500 }),
  isValidated: boolean("is_validated").notNull().default(false),
  validatedAt: timestamp("validated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── CREDIT ENTRIES ──────────────────────────────────────────────────────────

export const creditEntries = pgTable("credit_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  taxProfileId: uuid("tax_profile_id")
    .notNull()
    .references(() => taxProfiles.id),
  taxYearId: uuid("tax_year_id")
    .notNull()
    .references(() => taxYears.id),
  taxReturnId: uuid("tax_return_id").references(() => taxReturns.id),
  category: creditCategoryEnum("category").notNull(),
  sourceDocumentId: uuid("source_document_id").references(() => fiscalDocuments.id),
  sourceType: varchar("source_type", { length: 50 }).notNull().default("manual"),
  claimedAmountCents: integer("claimed_amount_cents").notNull().default(0),
  description: varchar("description", { length: 500 }),
  isValidated: boolean("is_validated").notNull().default(false),
  validatedAt: timestamp("validated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── TAX CALCULATIONS ────────────────────────────────────────────────────────

export const taxCalculations = pgTable("tax_calculations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  taxReturnId: uuid("tax_return_id")
    .notNull()
    .references(() => taxReturns.id),
  taxYearId: uuid("tax_year_id")
    .notNull()
    .references(() => taxYears.id),
  status: calculationStatusEnum("status").notNull().default("pending"),
  // Revenus (cents)
  totalIncomeCents: integer("total_income_cents").notNull().default(0),
  netIncomeCents: integer("net_income_cents").notNull().default(0),
  taxableIncomeCents: integer("taxable_income_cents").notNull().default(0),
  // Calcul fédéral (cents)
  federalTaxBeforeCreditsCents: integer("federal_tax_before_credits_cents").notNull().default(0),
  federalNonRefundableCreditsCents: integer("federal_non_refundable_credits_cents").notNull().default(0),
  federalRefundableCreditsCents: integer("federal_refundable_credits_cents").notNull().default(0),
  federalTaxPayableCents: integer("federal_tax_payable_cents").notNull().default(0),
  federalTaxWithheldCents: integer("federal_tax_withheld_cents").notNull().default(0),
  federalBalanceCents: integer("federal_balance_cents").notNull().default(0),
  // Calcul provincial (cents)
  provincialTaxBeforeCreditsCents: integer("provincial_tax_before_credits_cents").notNull().default(0),
  provincialNonRefundableCreditsCents: integer("provincial_non_refundable_credits_cents").notNull().default(0),
  provincialRefundableCreditsCents: integer("provincial_refundable_credits_cents").notNull().default(0),
  provincialTaxPayableCents: integer("provincial_tax_payable_cents").notNull().default(0),
  provincialTaxWithheldCents: integer("provincial_tax_withheld_cents").notNull().default(0),
  provincialBalanceCents: integer("provincial_balance_cents").notNull().default(0),
  // Total net
  totalBalanceCents: integer("total_balance_cents").notNull().default(0),
  // Détails lisibles (breakdown pour UI)
  calculationDetails: text("calculation_details"),
  // Audit
  calculationVersion: varchar("calculation_version", { length: 20 }).notNull().default("1.0"),
  rulesSnapshotVersion: varchar("rules_snapshot_version", { length: 50 }),
  isPreliminary: boolean("is_preliminary").notNull().default(true),
  errorMessage: text("error_message"),
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── QUESTIONNAIRE SESSIONS ──────────────────────────────────────────────────

export const questionnaireSessions = pgTable("questionnaire_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  taxProfileId: uuid("tax_profile_id")
    .notNull()
    .references(() => taxProfiles.id),
  taxReturnId: uuid("tax_return_id")
    .notNull()
    .references(() => taxReturns.id),
  taxYearId: uuid("tax_year_id")
    .notNull()
    .references(() => taxYears.id),
  // Statut global
  status: questionnaireStatusEnum("status").notNull().default("not_started"),
  currentSection: varchar("current_section", { length: 50 }),
  sectionsCompleted: text("sections_completed"), // JSON array
  // Contexte inféré dynamiquement (évite les questions redondantes)
  hasEmploymentIncome: boolean("has_employment_income"),
  hasSelfEmployment: boolean("has_self_employment"),
  hasInvestmentIncome: boolean("has_investment_income"),
  hasRentalIncome: boolean("has_rental_income"),
  hasForeignIncome: boolean("has_foreign_income"),
  hasRrsp: boolean("has_rrsp"),
  hasChildcare: boolean("has_childcare"),
  numEmployers: integer("num_employers").default(0),
  // Progression
  questionsAnswered: integer("questions_answered").default(0),
  lastQuestionCode: varchar("last_question_code", { length: 100 }),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── RELATIONS ÉTAPE 4 ───────────────────────────────────────────────────────

export const taxRulesRelations = relations(taxRules, ({ one }) => ({
  jurisdiction: one(jurisdictions, {
    fields: [taxRules.jurisdictionId],
    references: [jurisdictions.id],
  }),
  taxYear: one(taxYears, {
    fields: [taxRules.taxYearId],
    references: [taxYears.id],
  }),
}));

export const incomeEntriesRelations = relations(incomeEntries, ({ one }) => ({
  taxProfile: one(taxProfiles, {
    fields: [incomeEntries.taxProfileId],
    references: [taxProfiles.id],
  }),
  taxYear: one(taxYears, {
    fields: [incomeEntries.taxYearId],
    references: [taxYears.id],
  }),
  taxReturn: one(taxReturns, {
    fields: [incomeEntries.taxReturnId],
    references: [taxReturns.id],
  }),
  sourceDocument: one(fiscalDocuments, {
    fields: [incomeEntries.sourceDocumentId],
    references: [fiscalDocuments.id],
  }),
}));

export const deductionEntriesRelations = relations(deductionEntries, ({ one }) => ({
  taxProfile: one(taxProfiles, {
    fields: [deductionEntries.taxProfileId],
    references: [taxProfiles.id],
  }),
  taxReturn: one(taxReturns, {
    fields: [deductionEntries.taxReturnId],
    references: [taxReturns.id],
  }),
}));

export const creditEntriesRelations = relations(creditEntries, ({ one }) => ({
  taxProfile: one(taxProfiles, {
    fields: [creditEntries.taxProfileId],
    references: [taxProfiles.id],
  }),
  taxReturn: one(taxReturns, {
    fields: [creditEntries.taxReturnId],
    references: [taxReturns.id],
  }),
}));

export const taxCalculationsRelations = relations(taxCalculations, ({ one }) => ({
  taxReturn: one(taxReturns, {
    fields: [taxCalculations.taxReturnId],
    references: [taxReturns.id],
  }),
  taxYear: one(taxYears, {
    fields: [taxCalculations.taxYearId],
    references: [taxYears.id],
  }),
}));

export const questionnaireSessionsRelations = relations(questionnaireSessions, ({ one }) => ({
  taxProfile: one(taxProfiles, {
    fields: [questionnaireSessions.taxProfileId],
    references: [taxProfiles.id],
  }),
  taxReturn: one(taxReturns, {
    fields: [questionnaireSessions.taxReturnId],
    references: [taxReturns.id],
  }),
  taxYear: one(taxYears, {
    fields: [questionnaireSessions.taxYearId],
    references: [taxYears.id],
  }),
}));
