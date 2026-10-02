/**
 * Seed — 13 juridictions canadiennes
 * Lance: npx tsx scripts/seed-jurisdictions.ts
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { jurisdictions } from "../src/db/schema";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const JURISDICTIONS = [
  // Fédéral
  {
    code: "CA",
    countryCode: "CA",
    nameFr: "Canada (fédéral)",
    nameEn: "Canada (Federal)",
    jurisdictionLevel: "federal" as const,
    taxAdministration: "CRA" as const,
    isActive: true,
    hasProvincialReturn: false,
  },
  // Provinces — CRA
  {
    code: "AB",
    countryCode: "CA",
    nameFr: "Alberta",
    nameEn: "Alberta",
    jurisdictionLevel: "provincial" as const,
    taxAdministration: "CRA" as const,
    isActive: true,
    hasProvincialReturn: false, // Alberta: pas de déclaration provinciale séparée (taux CRA)
  },
  {
    code: "BC",
    countryCode: "CA",
    nameFr: "Colombie-Britannique",
    nameEn: "British Columbia",
    jurisdictionLevel: "provincial" as const,
    taxAdministration: "CRA" as const,
    isActive: true,
    hasProvincialReturn: false,
  },
  {
    code: "MB",
    countryCode: "CA",
    nameFr: "Manitoba",
    nameEn: "Manitoba",
    jurisdictionLevel: "provincial" as const,
    taxAdministration: "CRA" as const,
    isActive: true,
    hasProvincialReturn: false,
  },
  {
    code: "NB",
    countryCode: "CA",
    nameFr: "Nouveau-Brunswick",
    nameEn: "New Brunswick",
    jurisdictionLevel: "provincial" as const,
    taxAdministration: "CRA" as const,
    isActive: true,
    hasProvincialReturn: false,
  },
  {
    code: "NL",
    countryCode: "CA",
    nameFr: "Terre-Neuve-et-Labrador",
    nameEn: "Newfoundland and Labrador",
    jurisdictionLevel: "provincial" as const,
    taxAdministration: "CRA" as const,
    isActive: true,
    hasProvincialReturn: false,
  },
  {
    code: "NS",
    countryCode: "CA",
    nameFr: "Nouvelle-Écosse",
    nameEn: "Nova Scotia",
    jurisdictionLevel: "provincial" as const,
    taxAdministration: "CRA" as const,
    isActive: true,
    hasProvincialReturn: false,
  },
  {
    code: "ON",
    countryCode: "CA",
    nameFr: "Ontario",
    nameEn: "Ontario",
    jurisdictionLevel: "provincial" as const,
    taxAdministration: "CRA" as const,
    isActive: true,
    hasProvincialReturn: false,
  },
  {
    code: "PE",
    countryCode: "CA",
    nameFr: "Île-du-Prince-Édouard",
    nameEn: "Prince Edward Island",
    jurisdictionLevel: "provincial" as const,
    taxAdministration: "CRA" as const,
    isActive: true,
    hasProvincialReturn: false,
  },
  {
    code: "SK",
    countryCode: "CA",
    nameFr: "Saskatchewan",
    nameEn: "Saskatchewan",
    jurisdictionLevel: "provincial" as const,
    taxAdministration: "CRA" as const,
    isActive: true,
    hasProvincialReturn: false,
  },
  // Québec — Revenu Québec (déclaration TP-1 séparée)
  {
    code: "QC",
    countryCode: "CA",
    nameFr: "Québec",
    nameEn: "Quebec",
    jurisdictionLevel: "provincial" as const,
    taxAdministration: "CRA_AND_REVENU_QUEBEC" as const,
    isActive: true,
    hasProvincialReturn: true, // TP-1 séparé
  },
  // Territoires
  {
    code: "YT",
    countryCode: "CA",
    nameFr: "Yukon",
    nameEn: "Yukon",
    jurisdictionLevel: "territorial" as const,
    taxAdministration: "CRA" as const,
    isActive: true,
    hasProvincialReturn: false,
  },
  {
    code: "NT",
    countryCode: "CA",
    nameFr: "Territoires du Nord-Ouest",
    nameEn: "Northwest Territories",
    jurisdictionLevel: "territorial" as const,
    taxAdministration: "CRA" as const,
    isActive: true,
    hasProvincialReturn: false,
  },
  {
    code: "NU",
    countryCode: "CA",
    nameFr: "Nunavut",
    nameEn: "Nunavut",
    jurisdictionLevel: "territorial" as const,
    taxAdministration: "CRA" as const,
    isActive: true,
    hasProvincialReturn: false,
  },
];

async function main() {
  console.log("🌱 Seed — 13 juridictions canadiennes + fédéral...");
  for (const j of JURISDICTIONS) {
    try {
      await db.insert(jurisdictions).values(j).onConflictDoNothing();
      console.log(`✅ ${j.code} — ${j.nameFr}`);
    } catch {
      console.log(`⏭️  ${j.code} existe déjà`);
    }
  }
  console.log("✅ Seed juridictions terminé.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erreur:", err);
  process.exit(1);
});
