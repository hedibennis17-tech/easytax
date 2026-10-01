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
