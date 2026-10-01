/**
 * Seed — Types de documents fiscaux canadiens
 * Lance: npx tsx scripts/seed-document-types.ts
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { documentTypes } from "../src/db/schema";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const DOCUMENT_TYPES = [
  // Feuillets emploi
  { code: "T4",       labelFr: "T4 — État de la rémunération payée",      labelEn: "T4 — Statement of Remuneration Paid",         category: "employment", isFederal: true,  isQuebec: false, sortOrder: 10 },
  { code: "RL-1",     labelFr: "RL-1 — Revenus d'emploi et revenus divers", labelEn: "RL-1 — Employment and Other Income",          category: "employment", isFederal: false, isQuebec: true,  sortOrder: 11 },
  { code: "T4A",      labelFr: "T4A — État du revenu de pension, de retraite, de rente", labelEn: "T4A — Pension, Retirement, Annuity",     category: "employment", isFederal: true,  isQuebec: false, sortOrder: 12 },
  { code: "T4E",      labelFr: "T4E — État des prestations d'assurance-emploi", labelEn: "T4E — Employment Insurance Benefits",         category: "employment", isFederal: true,  isQuebec: false, sortOrder: 13 },
  // Feuillets placements
  { code: "T5",       labelFr: "T5 — État des revenus de placements",      labelEn: "T5 — Statement of Investment Income",         category: "investment", isFederal: true,  isQuebec: false, sortOrder: 20 },
  { code: "RL-2",     labelFr: "RL-2 — Revenus de retraite et rentes",     labelEn: "RL-2 — Retirement and Annuity Income",        category: "investment", isFederal: false, isQuebec: true,  sortOrder: 21 },
  { code: "RL-3",     labelFr: "RL-3 — Revenus de placements",             labelEn: "RL-3 — Investment Income",                    category: "investment", isFederal: false, isQuebec: true,  sortOrder: 22 },
  { code: "T5007",    labelFr: "T5007 — État des prestations",             labelEn: "T5007 — Statement of Benefits",               category: "benefits",   isFederal: true,  isQuebec: false, sortOrder: 23 },
  // Logement
  { code: "RL-31",    labelFr: "Relevé 31 — Renseignements sur l'occupation d'un logement", labelEn: "RL-31 — Information about Occupying a Dwelling", category: "housing", isFederal: false, isQuebec: true, sortOrder: 30 },
  // Dépenses et crédits
  { code: "MEDICAL",  labelFr: "Reçus médicaux",                           labelEn: "Medical Receipts",                            category: "medical",    isFederal: true,  isQuebec: true,  sortOrder: 40 },
  { code: "DONATION", labelFr: "Reçus de dons de bienfaisance",            labelEn: "Charitable Donation Receipts",                category: "donations",  isFederal: true,  isQuebec: true,  sortOrder: 41 },
  { code: "TUITION",  labelFr: "Documents scolaires / frais de scolarité", labelEn: "Tuition and Education Documents",             category: "education",  isFederal: true,  isQuebec: true,  sortOrder: 42 },
  // Travail autonome
  { code: "SE_INCOME",  labelFr: "Revenus d'entreprise / travail autonome", labelEn: "Self-Employment Income",                      category: "self_employment", isFederal: true, isQuebec: true, sortOrder: 50 },
  { code: "SE_EXPENSE", labelFr: "Dépenses d'entreprise / travail autonome", labelEn: "Self-Employment Expenses",                  category: "self_employment", isFederal: true, isQuebec: true, sortOrder: 51 },
  // Autres
  { code: "OTHER",    labelFr: "Autre document fiscal",                    labelEn: "Other Fiscal Document",                       category: "other",      isFederal: true,  isQuebec: true,  sortOrder: 99 },
];

async function main() {
  console.log("🌱 Seed types de documents fiscaux...");

  for (const type of DOCUMENT_TYPES) {
    try {
      await db.insert(documentTypes).values(type).onConflictDoNothing();
      console.log(`✅ ${type.code} — ${type.labelFr}`);
    } catch (e) {
      console.log(`⏭️  ${type.code} existe déjà`);
    }
  }

  console.log("✅ Seed terminé.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erreur seed:", err);
  process.exit(1);
});
