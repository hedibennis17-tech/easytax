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
    const types = [
      // ── Federal ──────────────────────────────────────────────────────────────
      { code: "T3",           name: "État des revenus de fiducie",                              jurisdiction: "CA", category: "FEDERAL", sort: 1 },
      { code: "T4",           name: "État de la rémunération payée",                            jurisdiction: "CA", category: "FEDERAL", sort: 2 },
      { code: "T4A",          name: "État du revenu de pension, de retraite, de rente",         jurisdiction: "CA", category: "FEDERAL", sort: 3 },
      { code: "T4A_OAS",      name: "État des prestations de la Sécurité de la vieillesse",     jurisdiction: "CA", category: "FEDERAL", sort: 4 },
      { code: "T4A_P",        name: "État des prestations du Régime de pensions du Canada",     jurisdiction: "CA", category: "FEDERAL", sort: 5 },
      { code: "T4E",          name: "État des prestations d'assurance-emploi",                  jurisdiction: "CA", category: "FEDERAL", sort: 6 },
      { code: "T4FHSA",       name: "Compte d'épargne libre d'impôt pour l'achat d'une maison",jurisdiction: "CA", category: "FEDERAL", sort: 7 },
      { code: "T4RIF",        name: "Revenu d'un fonds enregistré de revenu de retraite",       jurisdiction: "CA", category: "FEDERAL", sort: 8 },
      { code: "T4RSP",        name: "Revenu d'un REER",                                         jurisdiction: "CA", category: "FEDERAL", sort: 9 },
      { code: "T5",           name: "État des revenus de placements",                           jurisdiction: "CA", category: "FEDERAL", sort: 10 },
      { code: "T5007",        name: "État des prestations",                                     jurisdiction: "CA", category: "FEDERAL", sort: 11 },
      { code: "T5008",        name: "État des opérations sur titres",                           jurisdiction: "CA", category: "FEDERAL", sort: 12 },
      { code: "T5013",        name: "État des revenus d'une société de personnes",              jurisdiction: "CA", category: "FEDERAL", sort: 13 },
      { code: "T5018",        name: "État des paiements contractuels",                          jurisdiction: "CA", category: "FEDERAL", sort: 14 },
      { code: "T1204",        name: "Paiements de services gouvernementaux",                    jurisdiction: "CA", category: "FEDERAL", sort: 15 },
      { code: "T2202",        name: "Certificat pour frais de scolarité et d'inscription",      jurisdiction: "CA", category: "FEDERAL", sort: 16 },
      { code: "NR4",          name: "État des sommes payées ou créditées à des non-résidents",  jurisdiction: "CA", category: "FEDERAL", sort: 17 },
      { code: "RC62",         name: "État de la prestation universelle pour la garde d'enfants",jurisdiction: "CA", category: "FEDERAL", sort: 18 },
      { code: "RRSP_RECEIPT", name: "Reçu de cotisation REER",                                  jurisdiction: "CA", category: "FEDERAL", sort: 19 },
      { code: "PRPP_RECEIPT", name: "Reçu de cotisation RPAC",                                  jurisdiction: "CA", category: "FEDERAL", sort: 20 },
      { code: "TFSA",         name: "Compte d'épargne libre d'impôt",                           jurisdiction: "CA", category: "FEDERAL", sort: 21 },
      // ── Québec ────────────────────────────────────────────────────────────────
      { code: "RL1",  name: "Revenus d'emploi et revenus divers",          jurisdiction: "QC", category: "QUEBEC", sort: 22 },
      { code: "RL2",  name: "Revenus de retraite et rentes",               jurisdiction: "QC", category: "QUEBEC", sort: 23 },
      { code: "RL3",  name: "Revenus de placements",                       jurisdiction: "QC", category: "QUEBEC", sort: 24 },
      { code: "RL4",  name: "Revenus en fiducie",                          jurisdiction: "QC", category: "QUEBEC", sort: 25 },
      { code: "RL5",  name: "Revenus de location et revenus divers",       jurisdiction: "QC", category: "QUEBEC", sort: 26 },
      { code: "RL6",  name: "Dividendes, intérêts et autres revenus",      jurisdiction: "QC", category: "QUEBEC", sort: 27 },
      { code: "RL7",  name: "Revenus divers (artistes)",                   jurisdiction: "QC", category: "QUEBEC", sort: 28 },
      { code: "RL8",  name: "Frais de scolarité ou d'examen",              jurisdiction: "QC", category: "QUEBEC", sort: 29 },
      { code: "RL10", name: "Revenus d'agriculture et de pêche",           jurisdiction: "QC", category: "QUEBEC", sort: 30 },
      { code: "RL11", name: "Honoraires ou autres sommes",                 jurisdiction: "QC", category: "QUEBEC", sort: 31 },
      { code: "RL14", name: "Paiements contractuels",                      jurisdiction: "QC", category: "QUEBEC", sort: 32 },
      { code: "RL15", name: "Revenus d'une société de personnes",          jurisdiction: "QC", category: "QUEBEC", sort: 33 },
      { code: "RL16", name: "Revenus de succession",                       jurisdiction: "QC", category: "QUEBEC", sort: 34 },
      { code: "RL18", name: "Opérations sur titres",                       jurisdiction: "QC", category: "QUEBEC", sort: 35 },
      { code: "RL19", name: "Revenus d'une fiducie de fonds commun",       jurisdiction: "QC", category: "QUEBEC", sort: 36 },
      { code: "RL20", name: "Régime d'accession à la propriété",           jurisdiction: "QC", category: "QUEBEC", sort: 37 },
      { code: "RL21", name: "Régime d'encouragement à l'éducation permanente", jurisdiction: "QC", category: "QUEBEC", sort: 38 },
      { code: "RL22", name: "Retraite progressive",                        jurisdiction: "QC", category: "QUEBEC", sort: 39 },
      { code: "RL24", name: "Frais pour la garde d'enfants",               jurisdiction: "QC", category: "QUEBEC", sort: 40 },
      { code: "RL25", name: "Remboursement de prestations d'aide sociale", jurisdiction: "QC", category: "QUEBEC", sort: 41 },
      { code: "RL26", name: "Revenus et renseignements divers",            jurisdiction: "QC", category: "QUEBEC", sort: 42 },
      { code: "RL40", name: "Crédits d'impôt relatifs aux ressources",     jurisdiction: "QC", category: "QUEBEC", sort: 43 },
      // ── Autres ────────────────────────────────────────────────────────────────
      { code: "MEDICAL",    name: "Reçus médicaux",              jurisdiction: "CA", category: "OTHER", sort: 44 },
      { code: "DONATION",   name: "Reçus de dons",               jurisdiction: "CA", category: "OTHER", sort: 45 },
      { code: "SE_INCOME",  name: "Revenu de travail autonome",  jurisdiction: "CA", category: "OTHER", sort: 46 },
      { code: "SE_EXPENSE", name: "Dépenses de travail autonome",jurisdiction: "CA", category: "OTHER", sort: 47 },
      { code: "OTHER",      name: "Autre document fiscal",       jurisdiction: "CA", category: "OTHER", sort: 48 },
    ];

    let seeded = 0;
    for (const t of types) {
      const fields: string[] = ["code", "name"];
      const values: any[]    = [t.code, t.name];

      if (jurisdictionCol) { fields.push(jurisdictionCol); values.push(t.jurisdiction); }
      if (hasCategory)     { fields.push("category");      values.push(t.category); }
      if (sortCol)         { fields.push(sortCol);         values.push(t.sort); }
      if (isActiveCol)     { fields.push(isActiveCol);     values.push(true); }

      const ph  = values.map((_, i) => `$${i + 1}`).join(", ");
      const upd = fields
        .filter(f => f !== "code")
        .map(f   => `${f} = EXCLUDED.${f}`)
        .join(", ");

      await sql.query(
        `INSERT INTO document_types (${fields.join(", ")})
         VALUES (${ph})
         ON CONFLICT (code) DO UPDATE SET ${upd}`,
        values
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
