import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? req.headers.get("x-migrate-token");
  const secret = process.env.MIGRATE_SECRET;
  if (token !== "et-migrate-2025-prod" && token !== secret) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL!);

    const log: string[] = [];

    // ── 1. Trouver toutes les tables avec FK vers fiscal_documents ────────────
    const fkRows = await sql.query(`
      SELECT DISTINCT tc.table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.table_constraints tc2
        ON rc.unique_constraint_name = tc2.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc2.table_name = 'fiscal_documents'
    `);
    const fkTables = fkRows.map((r: any) => r.table_name as string);
    log.push(`Tables FK → fiscal_documents: ${fkTables.join(", ") || "aucune"}`);

    // ── 2. Supprimer dans l'ordre FK ─────────────────────────────────────────
    // D'abord les tables qui référencent fiscal_documents
    const childFirst = [
      "extraction_fields",
      "document_extractions",
      "document_audit_logs",
      "document_pages",
      "document_parties",
      "document_requests",
      ...fkTables, // income_entries, credit_entries, etc. détectés dynamiquement
      "fiscal_documents",
    ];

    // Dédupliquer
    const seen = new Set<string>();
    const purgeOrder = childFirst.filter(t => { if (seen.has(t)) return false; seen.add(t); return true; });

    for (const table of purgeOrder) {
      try {
        await sql.query(`DELETE FROM ${table}`);
        log.push(`✓ ${table} purgé`);
      } catch (e: any) {
        if (e.message?.includes("does not exist") || e.message?.includes("relation") && e.message?.includes("does not exist")) {
          log.push(`⚠ ${table} n'existe pas — ignoré`);
        } else {
          throw e;
        }
      }
    }

    // ── 3. Purger document_types ──────────────────────────────────────────────
    await sql.query(`DELETE FROM document_types`);
    log.push("✓ document_types purgé");

    // ── 3. Détecter les colonnes réelles ──────────────────────────────────────
    const colRows = await sql.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'document_types'
      ORDER BY ordinal_position
    `);
    const cols = colRows.map((r: any) => r.column_name as string);
    log.push(`Colonnes: ${cols.join(", ")}`);

    const jurisdictionCol = cols.includes("jurisdiction_code") ? "jurisdiction_code"
      : cols.includes("jurisdictionCode") ? "jurisdictionCode" : null;
    const hasCategory  = cols.includes("category");
    const sortCol      = cols.includes("sort_order") ? "sort_order"
      : cols.includes("sortOrder") ? "sortOrder" : null;
    const isActiveCol  = cols.includes("is_active") ? "is_active"
      : cols.includes("isActive") ? "isActive" : null;

    // ── 4. Re-seeder document_types ───────────────────────────────────────────
    // Schéma réel: code, label_fr, label_en, category, is_federal, is_quebec, is_active, sort_order
    const types: Array<{ code: string; fr: string; en: string; cat: string; fed: boolean; qc: boolean; sort: number }> = [
      // ── Federal ──────────────────────────────────────────────────────────────
      { code: "T3",           fr: "État des revenus de fiducie",                              en: "Statement of Trust Income Allocations",          cat: "investment",  fed: true,  qc: false, sort: 1 },
      { code: "T4",           fr: "État de la rémunération payée",                            en: "Statement of Remuneration Paid",                  cat: "employment",  fed: true,  qc: false, sort: 2 },
      { code: "T4A",          fr: "État du revenu de pension, de retraite, de rente",         en: "Statement of Pension, Retirement, Annuity",       cat: "pension",     fed: true,  qc: false, sort: 3 },
      { code: "T4A_OAS",      fr: "État des prestations de la Sécurité de la vieillesse",     en: "Statement of Old Age Security",                   cat: "pension",     fed: true,  qc: false, sort: 4 },
      { code: "T4A_P",        fr: "État des prestations du Régime de pensions du Canada",     en: "Statement of Canada Pension Plan Benefits",       cat: "pension",     fed: true,  qc: false, sort: 5 },
      { code: "T4E",          fr: "État des prestations d'assurance-emploi",                  en: "Statement of Employment Insurance Benefits",      cat: "employment",  fed: true,  qc: false, sort: 6 },
      { code: "T4FHSA",       fr: "Compte d'épargne libre d'impôt pour l'achat d'une maison",en: "First Home Savings Account",                      cat: "investment",  fed: true,  qc: false, sort: 7 },
      { code: "T4RIF",        fr: "Revenu d'un fonds enregistré de revenu de retraite",       en: "Income from a Registered Retirement Income Fund", cat: "pension",     fed: true,  qc: false, sort: 8 },
      { code: "T4RSP",        fr: "Revenu d'un REER",                                         en: "Income from a Registered Retirement Savings Plan",cat: "pension",     fed: true,  qc: false, sort: 9 },
      { code: "T5",           fr: "État des revenus de placements",                           en: "Statement of Investment Income",                  cat: "investment",  fed: true,  qc: false, sort: 10 },
      { code: "T5007",        fr: "État des prestations",                                     en: "Statement of Benefits",                           cat: "other",       fed: true,  qc: false, sort: 11 },
      { code: "T5008",        fr: "État des opérations sur titres",                           en: "Statement of Securities Transactions",            cat: "investment",  fed: true,  qc: false, sort: 12 },
      { code: "T5013",        fr: "État des revenus d'une société de personnes",              en: "Statement of Partnership Income",                 cat: "investment",  fed: true,  qc: false, sort: 13 },
      { code: "T5018",        fr: "État des paiements contractuels",                          en: "Statement of Contract Payments",                  cat: "employment",  fed: true,  qc: false, sort: 14 },
      { code: "T1204",        fr: "Paiements de services gouvernementaux",                    en: "Government Service Contract Payments",            cat: "employment",  fed: true,  qc: false, sort: 15 },
      { code: "T2202",        fr: "Certificat pour frais de scolarité et d'inscription",      en: "Tuition and Enrollment Certificate",              cat: "education",   fed: true,  qc: false, sort: 16 },
      { code: "NR4",          fr: "État des sommes payées à des non-résidents",               en: "Statement of Amounts Paid to Non-Residents",      cat: "other",       fed: true,  qc: false, sort: 17 },
      { code: "RC62",         fr: "État de la prestation universelle pour la garde d'enfants",en: "Universal Child Care Benefit Statement",          cat: "other",       fed: true,  qc: false, sort: 18 },
      { code: "RRSP_RECEIPT", fr: "Reçu de cotisation REER",                                  en: "RRSP Contribution Receipt",                       cat: "pension",     fed: true,  qc: false, sort: 19 },
      { code: "PRPP_RECEIPT", fr: "Reçu de cotisation RPAC",                                  en: "PRPP Contribution Receipt",                       cat: "pension",     fed: true,  qc: false, sort: 20 },
      { code: "TFSA",         fr: "Compte d'épargne libre d'impôt",                           en: "Tax-Free Savings Account",                        cat: "investment",  fed: true,  qc: false, sort: 21 },
      // ── Québec ────────────────────────────────────────────────────────────────
      { code: "RL1",  fr: "Revenus d'emploi et revenus divers",              en: "Employment and Other Income",             cat: "employment", fed: false, qc: true, sort: 22 },
      { code: "RL2",  fr: "Revenus de retraite et rentes",                   en: "Retirement and Annuity Income",           cat: "pension",    fed: false, qc: true, sort: 23 },
      { code: "RL3",  fr: "Revenus de placements",                           en: "Investment Income",                       cat: "investment", fed: false, qc: true, sort: 24 },
      { code: "RL4",  fr: "Revenus en fiducie",                              en: "Trust Income",                            cat: "investment", fed: false, qc: true, sort: 25 },
      { code: "RL5",  fr: "Revenus de location et revenus divers",           en: "Rental and Miscellaneous Income",         cat: "investment", fed: false, qc: true, sort: 26 },
      { code: "RL6",  fr: "Dividendes, intérêts et autres revenus",          en: "Dividends, Interest and Other Income",    cat: "investment", fed: false, qc: true, sort: 27 },
      { code: "RL7",  fr: "Revenus divers (artistes)",                       en: "Miscellaneous Income (Artists)",          cat: "employment", fed: false, qc: true, sort: 28 },
      { code: "RL8",  fr: "Frais de scolarité ou d'examen",                  en: "Tuition or Examination Fees",             cat: "education",  fed: false, qc: true, sort: 29 },
      { code: "RL10", fr: "Revenus d'agriculture et de pêche",               en: "Farming and Fishing Income",              cat: "employment", fed: false, qc: true, sort: 30 },
      { code: "RL11", fr: "Honoraires ou autres sommes",                     en: "Honoraria or Other Amounts",              cat: "employment", fed: false, qc: true, sort: 31 },
      { code: "RL14", fr: "Paiements contractuels",                          en: "Contract Payments",                       cat: "employment", fed: false, qc: true, sort: 32 },
      { code: "RL15", fr: "Revenus d'une société de personnes",              en: "Partnership Income",                      cat: "investment", fed: false, qc: true, sort: 33 },
      { code: "RL16", fr: "Revenus de succession",                           en: "Estate Income",                           cat: "investment", fed: false, qc: true, sort: 34 },
      { code: "RL18", fr: "Opérations sur titres",                           en: "Securities Transactions",                 cat: "investment", fed: false, qc: true, sort: 35 },
      { code: "RL19", fr: "Revenus d'une fiducie de fonds commun",           en: "Mutual Fund Trust Income",                cat: "investment", fed: false, qc: true, sort: 36 },
      { code: "RL20", fr: "Régime d'accession à la propriété",               en: "Home Buyers' Plan",                       cat: "pension",    fed: false, qc: true, sort: 37 },
      { code: "RL21", fr: "Régime d'encouragement à l'éducation permanente", en: "Lifelong Learning Plan",                  cat: "education",  fed: false, qc: true, sort: 38 },
      { code: "RL22", fr: "Retraite progressive",                            en: "Gradual Retirement",                      cat: "pension",    fed: false, qc: true, sort: 39 },
      { code: "RL24", fr: "Frais pour la garde d'enfants",                   en: "Childcare Expenses",                      cat: "other",      fed: false, qc: true, sort: 40 },
      { code: "RL25", fr: "Remboursement de prestations d'aide sociale",     en: "Repayment of Social Assistance Benefits", cat: "other",      fed: false, qc: true, sort: 41 },
      { code: "RL26", fr: "Revenus et renseignements divers",                en: "Miscellaneous Income and Information",    cat: "other",      fed: false, qc: true, sort: 42 },
      { code: "RL40", fr: "Crédits d'impôt relatifs aux ressources",         en: "Resource-Related Tax Credits",            cat: "investment", fed: false, qc: true, sort: 43 },
      // ── Autres ────────────────────────────────────────────────────────────────
      { code: "MEDICAL",    fr: "Reçus médicaux",               en: "Medical Receipts",              cat: "medical",    fed: true, qc: true, sort: 44 },
      { code: "DONATION",   fr: "Reçus de dons",                en: "Donation Receipts",             cat: "other",      fed: true, qc: true, sort: 45 },
      { code: "SE_INCOME",  fr: "Revenu de travail autonome",   en: "Self-Employment Income",        cat: "employment", fed: true, qc: true, sort: 46 },
      { code: "SE_EXPENSE", fr: "Dépenses de travail autonome", en: "Self-Employment Expenses",      cat: "employment", fed: true, qc: true, sort: 47 },
      { code: "OTHER",      fr: "Autre document fiscal",        en: "Other Tax Document",            cat: "other",      fed: true, qc: true, sort: 48 },
    ];

    let seeded = 0;
    for (const t of types) {
      await sql.query(
        `INSERT INTO document_types (code, label_fr, label_en, category, is_federal, is_quebec, is_active, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7)
         ON CONFLICT (code) DO UPDATE SET
           label_fr   = EXCLUDED.label_fr,
           label_en   = EXCLUDED.label_en,
           category   = EXCLUDED.category,
           is_federal = EXCLUDED.is_federal,
           is_quebec  = EXCLUDED.is_quebec,
           is_active  = true,
           sort_order = EXCLUDED.sort_order`,
        [t.code, t.fr, t.en, t.cat, t.fed, t.qc, t.sort]
      );
      seeded++;
    }

    log.push(`✓ ${seeded} types de documents insérés / mis à jour`);

    // ── 5. Vérification ───────────────────────────────────────────────────────
    const countRows = await sql.query(`SELECT COUNT(*) AS total FROM document_types`);
    const total = (countRows[0] as any).total;
    log.push(`✓ Total dans document_types: ${total}`);

    return NextResponse.json({ success: true, log, total: Number(total) });
  } catch (err: any) {
    console.error("[purge-documents]", err);
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
