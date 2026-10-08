/**
 * Purge complète — tous les documents fiscaux EasyTax
 *
 * Supprime dans le bon ordre (FK) puis re-seed les types de documents.
 * Lance: npx tsx scripts/purge-documents.ts
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = neon(process.env.DATABASE_URL!);
const db = drizzle(client);

async function main() {
  console.log("🗑️  Purge des documents fiscaux EasyTax...\n");

  // 1. extraction_fields (dépend de document_extractions)
  const r1 = await db.execute(sql`DELETE FROM extraction_fields`);
  console.log(`✓ extraction_fields supprimés: ${r1.rowCount ?? "?"}`);

  // 2. document_extractions (dépend de fiscal_documents)
  const r2 = await db.execute(sql`DELETE FROM document_extractions`);
  console.log(`✓ document_extractions supprimées: ${r2.rowCount ?? "?"}`);

  // 3. document_audit_logs (dépend de fiscal_documents)
  const r3 = await db.execute(sql`DELETE FROM document_audit_logs`);
  console.log(`✓ document_audit_logs supprimés: ${r3.rowCount ?? "?"}`);

  // 4. document_pages (dépend de fiscal_documents)
  const r4 = await db.execute(sql`DELETE FROM document_pages`);
  console.log(`✓ document_pages supprimées: ${r4.rowCount ?? "?"}`);

  // 5. document_parties (dépend de fiscal_documents)
  const r5 = await db.execute(sql`DELETE FROM document_parties`);
  console.log(`✓ document_parties supprimées: ${r5.rowCount ?? "?"}`);

  // 6. document_requests (dépend de fiscal_documents si FK existe)
  try {
    const r6 = await db.execute(sql`DELETE FROM document_requests`);
    console.log(`✓ document_requests supprimées: ${r6.rowCount ?? "?"}`);
  } catch {
    console.log(`⏭️  document_requests — table absente ou pas de FK, skip`);
  }

  // 7. fiscal_documents — tous les feuillets (T4, T4A, T5007, etc.)
  const r7 = await db.execute(sql`DELETE FROM fiscal_documents`);
  console.log(`✓ fiscal_documents supprimés: ${r7.rowCount ?? "?"}`);

  // 8. document_types — vider avant re-seed
  const r8 = await db.execute(sql`DELETE FROM document_types`);
  console.log(`✓ document_types vidés: ${r8.rowCount ?? "?"}`);

  console.log("\n🌱 Re-seed des types de documents...\n");

  const DOCUMENT_TYPES = [
    // Emploi fédéral
    { code: "T4",       label_fr: "T4 — État de la rémunération payée",                        label_en: "T4 — Statement of Remuneration Paid",                    category: "employment",       is_federal: true,  is_quebec: false, sort_order: 10 },
    { code: "T4A",      label_fr: "T4A — État du revenu de pension, de retraite, de rente",    label_en: "T4A — Pension, Retirement, Annuity",                     category: "employment",       is_federal: true,  is_quebec: false, sort_order: 12 },
    { code: "T4A_NR",   label_fr: "T4A-NR — Paiements aux non-résidents",                      label_en: "T4A-NR — Payments to Non-Residents",                     category: "employment",       is_federal: true,  is_quebec: false, sort_order: 13 },
    { code: "T4A_OAS",  label_fr: "T4A-OAS — Pension de sécurité de la vieillesse",            label_en: "T4A-OAS — Old Age Security",                             category: "benefits",         is_federal: true,  is_quebec: false, sort_order: 14 },
    { code: "T4A_P",    label_fr: "T4A-P — Prestations du RPC",                                label_en: "T4A-P — CPP Benefits",                                   category: "benefits",         is_federal: true,  is_quebec: false, sort_order: 15 },
    { code: "T4E",      label_fr: "T4E — État des prestations d'assurance-emploi",             label_en: "T4E — Employment Insurance Benefits",                    category: "employment",       is_federal: true,  is_quebec: false, sort_order: 16 },
    { code: "T4FHSA",   label_fr: "T4FHSA — Compte d'épargne libre d'impôt pour l'achat d'une première propriété", label_en: "T4FHSA — First Home Savings Account", category: "savings",          is_federal: true,  is_quebec: false, sort_order: 17 },
    { code: "T4RIF",    label_fr: "T4RIF — Revenus d'un FERR",                                 label_en: "T4RIF — Income from a RRIF",                             category: "retirement",       is_federal: true,  is_quebec: false, sort_order: 18 },
    { code: "T4RSP",    label_fr: "T4RSP — Revenus d'un REER",                                 label_en: "T4RSP — Income from an RRSP",                            category: "retirement",       is_federal: true,  is_quebec: false, sort_order: 19 },
    // Placements fédéraux
    { code: "T3",       label_fr: "T3 — État des revenus de fiducie",                          label_en: "T3 — Statement of Trust Income",                         category: "investment",       is_federal: true,  is_quebec: false, sort_order: 20 },
    { code: "T5",       label_fr: "T5 — État des revenus de placements",                       label_en: "T5 — Statement of Investment Income",                    category: "investment",       is_federal: true,  is_quebec: false, sort_order: 21 },
    { code: "T5007",    label_fr: "T5007 — État des prestations",                              label_en: "T5007 — Statement of Benefits",                          category: "benefits",         is_federal: true,  is_quebec: false, sort_order: 22 },
    { code: "T5008",    label_fr: "T5008 — État des opérations sur titres",                    label_en: "T5008 — Statement of Securities Transactions",           category: "investment",       is_federal: true,  is_quebec: false, sort_order: 23 },
    { code: "T5013",    label_fr: "T5013 — État des revenus d'une société de personnes",       label_en: "T5013 — Statement of Partnership Income",                category: "investment",       is_federal: true,  is_quebec: false, sort_order: 24 },
    { code: "T5018",    label_fr: "T5018 — État des paiements contractuels",                   label_en: "T5018 — Statement of Contract Payments",                 category: "employment",       is_federal: true,  is_quebec: false, sort_order: 25 },
    // Crédits / éducation fédéraux
    { code: "T1204",    label_fr: "T1204 — Honoraires de service gouvernemental",              label_en: "T1204 — Government Service Contract Payments",           category: "employment",       is_federal: true,  is_quebec: false, sort_order: 30 },
    { code: "T2202",    label_fr: "T2202 — Certificat pour frais de scolarité et d'inscription", label_en: "T2202 — Tuition and Enrolment Certificate",           category: "education",        is_federal: true,  is_quebec: false, sort_order: 31 },
    { code: "NR4",      label_fr: "NR4 — État des montants payés à des non-résidents",         label_en: "NR4 — Statement of Amounts Paid to Non-Residents",       category: "investment",       is_federal: true,  is_quebec: false, sort_order: 32 },
    { code: "RC62",     label_fr: "RC62 — État de la prestation universelle pour la garde d'enfants", label_en: "RC62 — Universal Child Care Benefit Statement",   category: "benefits",         is_federal: true,  is_quebec: false, sort_order: 33 },
    { code: "RRSP_RECEIPT",  label_fr: "Reçu de cotisation REER",                             label_en: "RRSP Contribution Receipt",                              category: "retirement",       is_federal: true,  is_quebec: false, sort_order: 34 },
    { code: "PRPP_RECEIPT",  label_fr: "Reçu de cotisation RPAC",                             label_en: "PRPP Contribution Receipt",                              category: "retirement",       is_federal: true,  is_quebec: false, sort_order: 35 },
    { code: "TFSA",     label_fr: "CELI — Compte d'épargne libre d'impôt",                    label_en: "TFSA — Tax-Free Savings Account",                        category: "savings",          is_federal: true,  is_quebec: false, sort_order: 36 },
    // Relevés Québec
    { code: "RL-1",     label_fr: "RL-1 — Revenus d'emploi et revenus divers",                label_en: "RL-1 — Employment and Other Income",                     category: "employment",       is_federal: false, is_quebec: true,  sort_order: 50 },
    { code: "RL-2",     label_fr: "RL-2 — Revenus de retraite et rentes",                     label_en: "RL-2 — Retirement and Annuity Income",                   category: "retirement",       is_federal: false, is_quebec: true,  sort_order: 51 },
    { code: "RL-3",     label_fr: "RL-3 — Revenus de placements",                             label_en: "RL-3 — Investment Income",                               category: "investment",       is_federal: false, is_quebec: true,  sort_order: 52 },
    { code: "RL-5",     label_fr: "RL-5 — Prestations et indemnités",                         label_en: "RL-5 — Benefits and Indemnities",                        category: "benefits",         is_federal: false, is_quebec: true,  sort_order: 53 },
    { code: "RL-6",     label_fr: "RL-6 — Régimes d'assurance-groupe",                        label_en: "RL-6 — Group Insurance Plans",                           category: "employment",       is_federal: false, is_quebec: true,  sort_order: 54 },
    { code: "RL-8",     label_fr: "RL-8 — Frais de scolarité ou d'examen",                    label_en: "RL-8 — Tuition or Examination Fees",                     category: "education",        is_federal: false, is_quebec: true,  sort_order: 55 },
    { code: "RL-10",    label_fr: "RL-10 — Revenu d'entreprise ou de profession",              label_en: "RL-10 — Business or Professional Income",                category: "self_employment",  is_federal: false, is_quebec: true,  sort_order: 56 },
    { code: "RL-18",    label_fr: "RL-18 — Gains en capital et revenus de fiducie",            label_en: "RL-18 — Capital Gains and Trust Income",                 category: "investment",       is_federal: false, is_quebec: true,  sort_order: 57 },
    { code: "RL-24",    label_fr: "RL-24 — Frais de garde d'enfants",                         label_en: "RL-24 — Childcare Expenses",                             category: "benefits",         is_federal: false, is_quebec: true,  sort_order: 58 },
    { code: "RL-25",    label_fr: "RL-25 — Revenus et dépenses de location",                  label_en: "RL-25 — Rental Income and Expenses",                     category: "investment",       is_federal: false, is_quebec: true,  sort_order: 59 },
    { code: "RL-26",    label_fr: "RL-26 — Revenus d'une fiducie de fonds commun",            label_en: "RL-26 — Income from a Mutual Fund Trust",                category: "investment",       is_federal: false, is_quebec: true,  sort_order: 60 },
    { code: "RL-27",    label_fr: "RL-27 — Determination of Employment Status",               label_en: "RL-27 — Determination of Employment Status",             category: "employment",       is_federal: false, is_quebec: true,  sort_order: 61 },
    { code: "RL-28",    label_fr: "RL-28 — Revenus d'un plan d'épargne",                      label_en: "RL-28 — Income from a Savings Plan",                     category: "savings",          is_federal: false, is_quebec: true,  sort_order: 62 },
    { code: "RL-29",    label_fr: "RL-29 — Cotisations syndicales",                           label_en: "RL-29 — Union Dues",                                     category: "employment",       is_federal: false, is_quebec: true,  sort_order: 63 },
    { code: "RL-31",    label_fr: "RL-31 — Renseignements sur l'occupation d'un logement",    label_en: "RL-31 — Information about Occupying a Dwelling",         category: "housing",          is_federal: false, is_quebec: true,  sort_order: 64 },
    { code: "RL-32",    label_fr: "RL-32 — Revenus d'un régime enregistré d'épargne",         label_en: "RL-32 — Income from a Registered Savings Plan",          category: "retirement",       is_federal: false, is_quebec: true,  sort_order: 65 },
    { code: "RL-34",    label_fr: "RL-34 — Aide financière aux études",                       label_en: "RL-34 — Financial Assistance for Education",             category: "education",        is_federal: false, is_quebec: true,  sort_order: 66 },
    { code: "RL-35",    label_fr: "RL-35 — Compte d'épargne libre d'impôt",                   label_en: "RL-35 — Tax-Free Savings Account",                       category: "savings",          is_federal: false, is_quebec: true,  sort_order: 67 },
    { code: "RL-36",    label_fr: "RL-36 — Régime enregistré d'épargne-invalidité",           label_en: "RL-36 — Registered Disability Savings Plan",             category: "savings",          is_federal: false, is_quebec: true,  sort_order: 68 },
    { code: "RL-37",    label_fr: "RL-37 — Compte d'épargne premier logement",                label_en: "RL-37 — First Home Savings Account",                     category: "savings",          is_federal: false, is_quebec: true,  sort_order: 69 },
    { code: "RL-38",    label_fr: "RL-38 — Paiements d'aide sociale",                         label_en: "RL-38 — Social Assistance Payments",                     category: "benefits",         is_federal: false, is_quebec: true,  sort_order: 70 },
    { code: "RL-40",    label_fr: "RL-40 — Revenus d'entreprise agricole",                    label_en: "RL-40 — Farming Business Income",                        category: "self_employment",  is_federal: false, is_quebec: true,  sort_order: 71 },
    // Dépenses et crédits généraux
    { code: "MEDICAL",    label_fr: "Reçus médicaux",                                         label_en: "Medical Receipts",                                       category: "medical",          is_federal: true,  is_quebec: true,  sort_order: 80 },
    { code: "DONATION",   label_fr: "Reçus de dons de bienfaisance",                          label_en: "Charitable Donation Receipts",                           category: "donations",        is_federal: true,  is_quebec: true,  sort_order: 81 },
    { code: "SE_INCOME",  label_fr: "Revenus d'entreprise / travail autonome",                label_en: "Self-Employment Income",                                 category: "self_employment",  is_federal: true,  is_quebec: true,  sort_order: 82 },
    { code: "SE_EXPENSE", label_fr: "Dépenses d'entreprise / travail autonome",               label_en: "Self-Employment Expenses",                               category: "self_employment",  is_federal: true,  is_quebec: true,  sort_order: 83 },
    { code: "OTHER",      label_fr: "Autre document fiscal",                                  label_en: "Other Fiscal Document",                                  category: "other",            is_federal: true,  is_quebec: true,  sort_order: 99 },
  ];

  // Vérifier les colonnes disponibles dans document_types
  const cols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'document_types' ORDER BY ordinal_position
  `);
  const colNames = cols.rows.map((r: Record<string, unknown>) => r.column_name as string);
  console.log("Colonnes disponibles:", colNames.join(", "), "\n");

  // Construire les inserts selon les colonnes réelles
  const hasLabelFr = colNames.includes("label_fr");
  const hasLabelEn = colNames.includes("label_en");
  const hasLabelFrCamel = colNames.includes("labelFr");
  const hasIsFederal = colNames.includes("is_federal") || colNames.includes("isFederal");
  const hasIsQuebec = colNames.includes("is_quebec") || colNames.includes("isQuebec");
  const hasSortOrder = colNames.includes("sort_order") || colNames.includes("sortOrder");
  const hasCategory = colNames.includes("category");

  let inserted = 0;
  let skipped = 0;

  for (const t of DOCUMENT_TYPES) {
    try {
      // Construction dynamique selon les colonnes réelles
      if (hasLabelFr && hasIsFederal) {
        // snake_case columns
        await db.execute(sql`
          INSERT INTO document_types (code, label_fr, label_en, category, is_federal, is_quebec, sort_order)
          VALUES (
            ${t.code},
            ${t.label_fr},
            ${t.label_en},
            ${hasCategory ? t.category : null},
            ${t.is_federal},
            ${t.is_quebec},
            ${hasSortOrder ? t.sort_order : 0}
          )
          ON CONFLICT (code) DO UPDATE SET
            label_fr = EXCLUDED.label_fr,
            label_en = EXCLUDED.label_en,
            category = EXCLUDED.category,
            is_federal = EXCLUDED.is_federal,
            is_quebec = EXCLUDED.is_quebec,
            sort_order = EXCLUDED.sort_order
        `);
      } else if (hasLabelFrCamel) {
        // camelCase columns
        await db.execute(sql`
          INSERT INTO document_types (code, "labelFr", "labelEn", category, "isFederal", "isQuebec", "sortOrder")
          VALUES (
            ${t.code},
            ${t.label_fr},
            ${t.label_en},
            ${t.category},
            ${t.is_federal},
            ${t.is_quebec},
            ${t.sort_order}
          )
          ON CONFLICT (code) DO UPDATE SET
            "labelFr" = EXCLUDED."labelFr",
            "labelEn" = EXCLUDED."labelEn",
            category = EXCLUDED.category,
            "isFederal" = EXCLUDED."isFederal",
            "isQuebec" = EXCLUDED."isQuebec",
            "sortOrder" = EXCLUDED."sortOrder"
        `);
      } else {
        // Minimal fallback
        await db.execute(sql`
          INSERT INTO document_types (code) VALUES (${t.code})
          ON CONFLICT (code) DO NOTHING
        `);
      }
      console.log(`  ✅ ${t.code}`);
      inserted++;
    } catch (e) {
      console.log(`  ⚠️  ${t.code} — ${e instanceof Error ? e.message.slice(0, 80) : e}`);
      skipped++;
    }
  }

  console.log(`\n✅ Purge et re-seed terminés.`);
  console.log(`   ${inserted} types insérés/mis à jour, ${skipped} erreurs`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Erreur:", err);
  process.exit(1);
});
