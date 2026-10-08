/**
 * GET /api/debug/t4-entries
 *
 * Diagnostic complet : montre exactement ce que l'OCR a extrait du T4/RL-1
 * et comment chaque case a été mappée en entrée (revenu, déduction, crédit, retenue).
 *
 * Répond aux questions :
 *  - Quelle case du T4 a produit quelle entrée ?
 *  - Pourquoi une case réduit-elle le revenu net (23600) ?
 *  - Y a-t-il des doublons entre T4 et RL-1 ?
 *  - Les montants OCR correspondent-ils aux feuillets réels ?
 *
 * ⚠️ DEV ONLY
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  taxProfiles, taxReturns,
  incomeEntries, deductionEntries, creditEntries,
  fiscalDocuments, documentExtractions, extractionFields, documentTypes,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

function fmt(cents: number | null | undefined): string {
  if (!cents) return "0,00 $";
  return (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " $";
}

// Même whitelist que calculate/route.ts — RÈGLE ABSOLUE
const NET_INCOME_DEDUCTION_CATEGORIES = new Set([
  "rrsp", "union_dues", "childcare", "moving_expenses",
  "employment_expenses", "carrying_charges",
]);

// Même regex que calculate/route.ts
const FEDERAL_WITHHELD_RE = /impôt sur le revenu retenu|impôt fédéral|federal income tax withheld|income tax deducted/i;
const PROVINCIAL_WITHHELD_RE = /impôt du québec|impôt provincial|provincial income tax withheld|provincial tax withheld/i;
const PAYROLL_CREDIT_RE = /(?:cotisations?|contributions?).*(?:rrq|rpc|qpp|cpp|rqap|qpip|ae|assurance[- ]emploi)|(?:rrq|rpc|qpp|cpp)\s*\/\s*(?:rrq|rpc|qpp|cpp)|(?:t4|rl[- ]?1).*(?:case|box|caisse)\s*(?:16|18|b|c)\b|(?:case|box)\s*(?:16|18|b|c)\b.*(?:t4|rl[- ]?1)/i;

function classifyDeduction(d: { category: string | null; description: string | null }) {
  const desc = d.description ?? "";
  if (FEDERAL_WITHHELD_RE.test(desc))   return { role: "retenue_fédérale_43700", reducesNetIncome: false };
  if (PROVINCIAL_WITHHELD_RE.test(desc)) return { role: "retenue_provinciale_451",  reducesNetIncome: false };
  if (PAYROLL_CREDIT_RE.test(desc))     return { role: "cotisation_paie_crédit",    reducesNetIncome: false };
  if (NET_INCOME_DEDUCTION_CATEGORIES.has(d.category ?? "")) {
    return { role: "déduction_revenu_net_23600", reducesNetIncome: true };
  }
  return { role: "ignorée_catégorie_non_déductible", reducesNetIncome: false };
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Profil + dossier le plus récent
  const [profile] = await db.select({ id: taxProfiles.id, province: taxProfiles.province, fiscalResidence: taxProfiles.fiscalResidence })
    .from(taxProfiles).where(eq(taxProfiles.userId, userId)).limit(1);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const [taxReturn] = await db.select({ id: taxReturns.id })
    .from(taxReturns).where(eq(taxReturns.profileId, profile.id))
    .orderBy(desc(taxReturns.updatedAt)).limit(1);
  if (!taxReturn) return NextResponse.json({ error: "Aucun dossier" }, { status: 404 });

  const taxReturnId = taxReturn.id;

  // ── 1. Documents fiscaux uploadés ──────────────────────────────────────────
  const docs = await db
    .select({
      id: fiscalDocuments.id,
      status: fiscalDocuments.status,
      uploadedAt: fiscalDocuments.uploadedAt,
      typeCode: documentTypes.code,
    })
    .from(fiscalDocuments)
    .leftJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
    .where(and(eq(fiscalDocuments.userId, userId), eq(fiscalDocuments.taxReturnId, taxReturnId)))
    .orderBy(desc(fiscalDocuments.uploadedAt));

  // ── 2. Cases extraites par OCR pour chaque document ────────────────────────
  const docsWithFields = await Promise.all(docs.map(async (doc) => {
    const [extraction] = await db.select({
      id: documentExtractions.id,
      status: documentExtractions.status,
      confidence: documentExtractions.overallConfidence,
      extractedAt: documentExtractions.extractedAt,
      detectedTypeId: documentExtractions.detectedDocumentTypeId,
    }).from(documentExtractions)
      .where(eq(documentExtractions.fiscalDocumentId, doc.id))
      .orderBy(desc(documentExtractions.extractedAt))
      .limit(1);

    if (!extraction) return { ...doc, extraction: null, fields: [] };

    const fields = await db.select({
      fieldCode: extractionFields.fieldCode,
      rawOcrValue: extractionFields.rawOcrValue,
      validatedValue: extractionFields.validatedValue,
      confidence: extractionFields.ocrConfidence,
      validationStatus: extractionFields.validationStatus,
    }).from(extractionFields)
      .where(eq(extractionFields.extractionId, extraction.id))
      .orderBy(extractionFields.fieldCode);

    return { ...doc, extraction, fields };
  }));

  // ── 3. Entrées créées (revenus, déductions, crédits) ──────────────────────
  const [allIncomes, allDeductions, allCredits] = await Promise.all([
    db.select().from(incomeEntries)
      .where(and(eq(incomeEntries.userId, userId), eq(incomeEntries.taxReturnId, taxReturnId))),
    db.select().from(deductionEntries)
      .where(and(eq(deductionEntries.userId, userId), eq(deductionEntries.taxReturnId, taxReturnId))),
    db.select().from(creditEntries)
      .where(and(eq(creditEntries.userId, userId), eq(creditEntries.taxReturnId, taxReturnId))),
  ]);

  // ── 4. Analyse des déductions : ce qui réduit réellement 23600 ─────────────
  const validatedDeductions = allDeductions.filter(d => d.isValidated);
  const deductionAnalysis = validatedDeductions.map(d => {
    const { role, reducesNetIncome } = classifyDeduction(d);
    return {
      id: d.id,
      category: d.category,
      description: d.description,
      amount: fmt(d.amountCents),
      amountCents: d.amountCents,
      sourceType: d.sourceType,
      sourceDocumentId: d.sourceDocumentId,
      isValidated: d.isValidated,
      role,
      reducesNetIncome,
      danger: reducesNetIncome && d.sourceType === "validated_ocr"
        ? "⚠️ Cette déduction OCR réduit ton revenu net (23600). Vérifie si elle est réelle sur le feuillet."
        : null,
    };
  });

  const netIncomeReducers = deductionAnalysis.filter(d => d.reducesNetIncome);
  const totalRevenuCents  = allIncomes.filter(i => i.isValidated).reduce((s, i) => s + (i.amountCents ?? 0), 0);
  const totalDedCents     = netIncomeReducers.reduce((s, d) => s + (d.amountCents ?? 0), 0);
  const revenuNet23600    = totalRevenuCents - totalDedCents;

  // ── 5. Correspondance case OCR → entrée BD ────────────────────────────────
  const T4_CASE_EXPLANATIONS: Record<string, string> = {
    box_14:  "Case 14 = Revenus d'emploi → income_entries (employment). C'est ton salaire brut.",
    box_16:  "Case 16 = Cotisations RPC/RRQ employé → credit_entries. Ne réduit PAS 23600. Crédit non remboursable ligne 30800.",
    box_18:  "Case 18 = Cotisations AE employé → credit_entries. Ne réduit PAS 23600. Crédit non remboursable ligne 31200.",
    box_22:  "Case 22 = Impôt fédéral retenu → deduction_entries (withheld). Ne réduit PAS 23600. Va sur ligne 43700 (remboursement).",
    box_44:  "Case 44 = Cotisations syndicales → deduction_entries (union_dues). ⚠️ RÉDUIT 23600. Seulement si tu as un syndicat. Si OCR l'a extrait par erreur, invalide-le.",
    box_24:  "Case 24 = Gains assurables AE → informatif seulement, aucune entrée créée.",
    box_26:  "Case 26 = Gains ouvrant droit à pension → informatif seulement, aucune entrée créée.",
    case_a:  "Case A (RL-1) = Revenus d'emploi → income_entries. Même chose que T4 case 14 — vérifie qu'il n'y a pas de doublon.",
    case_b:  "Case B (RL-1) = Cotisations RRQ → credit_entries. Ne réduit PAS 23600.",
    case_c:  "Case C (RL-1) = Cotisations RQAP → credit_entries. Ne réduit PAS 23600.",
    case_e:  "Case E (RL-1) = Impôt provincial retenu → deduction_entries (withheld provincial). Ne réduit PAS 23600. Va sur ligne 451 (TP-1).",
    case_j:  "Case J (RL-1) = Cotisations syndicales → deduction_entries (union_dues). Même problème que T4 case 44.",
  };

  // Construire une vue case → entrée BD
  const caseToEntry = docsWithFields.map(doc => ({
    documentId: doc.id,
    typeCode: doc.typeCode,
    uploadedAt: doc.uploadedAt,
    extractionStatus: doc.extraction?.status ?? "no_extraction",
    confidence: doc.extraction?.confidence,
    cases: doc.fields.map(f => {
      // Trouver l'entrée BD créée depuis ce document pour cette case
      const matchingIncome = allIncomes.find(i => i.sourceDocumentId === doc.id);
      const matchingDeduction = allDeductions.find(d => d.sourceDocumentId === doc.id && (
        (f.fieldCode === "box_22" && FEDERAL_WITHHELD_RE.test(d.description ?? "")) ||
        (f.fieldCode === "box_44" && d.category === "union_dues") ||
        (f.fieldCode === "case_j" && d.category === "union_dues") ||
        (f.fieldCode === "case_e" && PROVINCIAL_WITHHELD_RE.test(d.description ?? ""))
      ));
      const matchingCredit = allCredits.find(c => c.sourceDocumentId === doc.id && (
        (f.fieldCode === "box_16" && /RPC|RRQ|CPP|QPP/i.test(c.description ?? "")) ||
        (f.fieldCode === "box_18" && /AE|assurance-emploi|EI/i.test(c.description ?? "")) ||
        ((f.fieldCode === "case_b" || f.fieldCode === "case_c") && /RRQ|RQAP/i.test(c.description ?? ""))
      ));

      const rawVal = f.validatedValue ?? f.rawOcrValue ?? null;
      return {
        fieldCode: f.fieldCode,
        rawOcrValue: f.rawOcrValue,
        validatedValue: f.validatedValue,
        confidence: f.confidence,
        validationStatus: f.validationStatus,
        explanation: T4_CASE_EXPLANATIONS[f.fieldCode] ?? `Case ${f.fieldCode} — voir ocr-to-entries.ts`,
        bdEntry: matchingDeduction
          ? { type: "deduction", id: matchingDeduction.id, amount: fmt(matchingDeduction.amountCents), category: matchingDeduction.category, isValidated: matchingDeduction.isValidated, reducesNetIncome: classifyDeduction(matchingDeduction).reducesNetIncome }
          : matchingCredit
          ? { type: "credit", id: matchingCredit.id, amount: fmt(matchingCredit.claimedAmountCents), category: matchingCredit.category }
          : f.fieldCode === "box_14" || f.fieldCode === "case_a"
          ? matchingIncome ? { type: "income", id: matchingIncome.id, amount: fmt(matchingIncome.amountCents), category: matchingIncome.category, isValidated: matchingIncome.isValidated } : { type: "income", note: "introuvable — cas OCR non lié à ce document" }
          : null,
        ocrVsBd: rawVal && (matchingDeduction ?? matchingCredit ?? matchingIncome)
          ? "lié"
          : rawVal ? "extrait_mais_non_lié" : "vide",
      };
    }),
  }));

  // ── 6. Synthèse du problème ────────────────────────────────────────────────
  const duplicateEmploymentIncome = (() => {
    const empIncomes = allIncomes.filter(i => i.isValidated && i.category === "employment");
    if (empIncomes.length > 1) {
      return {
        detected: true,
        count: empIncomes.length,
        total: fmt(empIncomes.reduce((s, i) => s + (i.amountCents ?? 0), 0)),
        entries: empIncomes.map(i => ({ id: i.id, amount: fmt(i.amountCents), sourceDocument: i.sourceDocumentId, description: i.description })),
        explication: "⚠️ Doublon probable T4+RL-1 : les deux feuillets déclarent le même revenu d'emploi. Un seul devrait être validé.",
      };
    }
    return { detected: false };
  })();

  return NextResponse.json({
    taxReturnId,
    generatedAt: new Date().toISOString(),
    province: profile.fiscalResidence ?? profile.province ?? "QC",

    // ── Calcul T1 simulé ────────────────────────────────────────────────────
    t1_simulation: {
      "15000_revenu_total": fmt(totalRevenuCents),
      "déductions_vers_23600": fmt(totalDedCents),
      "23600_revenu_net_théorique": fmt(revenuNet23600),
      note: "Ce calcul utilise les mêmes règles que /api/tax-engine/calculate. Si 23600 ≠ 15000, c'est à cause des déductions ci-dessous.",
    },

    // ── Déductions qui touchent 23600 ───────────────────────────────────────
    deductions_qui_reduisent_23600: {
      count: netIncomeReducers.length,
      total: fmt(totalDedCents),
      entries: netIncomeReducers.map(d => ({
        id: d.id,
        category: d.category,
        description: d.description,
        amount: d.amount,
        amountCents: d.amountCents,
        sourceType: d.sourceType,
        isValidated: d.isValidated,
        danger: d.danger,
        action: d.sourceType === "validated_ocr"
          ? `DELETE /api/debug/net-income-analysis?id=${d.id} pour invalider`
          : "entrée manuelle — vérifier si elle est correcte",
      })),
    },

    // ── Analyse complète de toutes les déductions ───────────────────────────
    toutes_les_deductions: {
      total: allDeductions.length,
      validées: allDeductions.filter(d => d.isValidated).length,
      invalidées: allDeductions.filter(d => !d.isValidated).length,
      entries: deductionAnalysis,
    },

    // ── Documents et cases OCR ──────────────────────────────────────────────
    documents: {
      count: docs.length,
      liste: docs.map(d => ({ id: d.id, typeCode: d.typeCode, status: d.status, uploadedAt: d.uploadedAt })),
    },
    cases_ocr_par_document: caseToEntry,

    // ── Revenus ─────────────────────────────────────────────────────────────
    revenus: {
      total: fmt(totalRevenuCents),
      validés: allIncomes.filter(i => i.isValidated).length,
      entries: allIncomes.map(i => ({
        id: i.id,
        category: i.category,
        amount: fmt(i.amountCents),
        amountCents: i.amountCents,
        description: i.description,
        sourceType: i.sourceType,
        isValidated: i.isValidated,
        sourceDocumentId: i.sourceDocumentId,
      })),
      doublon_emploi: duplicateEmploymentIncome,
    },

    // ── Crédits (RPC/AE/RQAP) ───────────────────────────────────────────────
    credits: {
      total: allCredits.length,
      entries: allCredits.map(c => ({
        id: c.id,
        category: c.category,
        amount: fmt(c.claimedAmountCents),
        description: c.description,
        sourceType: c.sourceType,
        isValidated: c.isValidated,
        note: "Les crédits ne réduisent PAS 23600. Ils réduisent l'impôt calculé.",
      })),
    },

    // ── Guide de lecture ────────────────────────────────────────────────────
    guide: {
      "Pourquoi 23600 < 15000 ?": "Une ou plusieurs déductions passent le filtre NET_INCOME_DEDUCTION_CATEGORIES. Voir 'deductions_qui_reduisent_23600'.",
      "Catégories qui réduisent 23600": ["rrsp", "union_dues", "childcare", "moving_expenses", "employment_expenses", "carrying_charges"],
      "Catégories qui NE réduisent PAS 23600": ["retenues_fédérales_43700", "retenues_provinciales_451", "cotisations_RPC_RRQ_AE_RQAP_→_crédit"],
      "Comment corriger une mauvaise déduction OCR": "DELETE /api/debug/net-income-analysis?id=<id> puis POST /api/tax-engine/calculate",
      "T4 box 44 union_dues": "Seulement si tu as payé des cotisations à un syndicat. L'OCR peut l'extraire même si la case est à 0 sur le vrai feuillet.",
    },
  });
}
