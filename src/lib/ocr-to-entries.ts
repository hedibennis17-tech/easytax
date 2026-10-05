/**
 * ocr-to-entries.ts
 * ─────────────────────────────────────────────────────────────────
 * Traduit les champs extraits par OCR (extraction_fields) en
 * incomeEntries / deductionEntries / creditEntries validés.
 *
 * Appelé automatiquement à la fin du pipeline OCR pour chaque document.
 * Logique idempotente : vérifie d'abord si une entrée existe déjà
 * pour ce document afin d'éviter les doublons.
 *
 * Mapping T4 ARC officiel (cases → catégories EasyTax):
 *   box_14  → income.employment         (Case 14 — Revenus d'emploi)
 *   box_16  → deduction.cpp_employee    (RPC employé — via credit côté T1)
 *   box_18  → deduction.ei_employee     (AE employé)
 *   box_22  → withheld federal          (Impôt retenu — stocké sur taxReturn)
 *   box_44  → deduction.union_dues      (Cotisations syndicales)
 *   box_46  → credit.donations          (Dons de bienfaisance)
 *   box_52  → (info facteur équivalence — pas de déduction directe)
 *
 * Mapping RL-1 Revenu Québec:
 *   case_a  → income.employment         (Case A — Revenus d'emploi)
 *   case_b  → deduction.rrq_employee    (RRQ employé)
 *   case_c  → deduction.rqap_employee   (RQAP employé)
 *   case_e  → withheld provincial       (Impôt retenu QC)
 *   case_j  → deduction.union_dues      (Cotisations syndicales)
 *
 * Mapping T5:
 *   box_11  → income.dividends_eligible   (Dividendes déterminés)
 *   box_25  → income.dividends_ineligible (Dividendes non déterminés)
 *   box_13  → income.interest             (Intérêts)
 */

import { db } from "@/lib/db";
import {
  incomeEntries, deductionEntries, creditEntries,
  taxReturns, taxYears, taxProfiles, extractionFields,
  documentExtractions, fiscalDocuments,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getExtractor } from "@/lib/extractors/t4";

// ── Types ──────────────────────────────────────────────────────
type IncomeCategory =
  | "employment" | "self_employment" | "pension" | "ei_benefits"
  | "social_assistance" | "interest" | "dividends_eligible"
  | "dividends_ineligible" | "capital_gains" | "rental"
  | "foreign_income" | "other_income";

type DeductionCategory =
  | "rrsp" | "union_dues" | "childcare" | "moving_expenses"
  | "employment_expenses" | "carrying_charges" | "other_deductions";

type CreditCategory =
  | "basic_personal" | "age" | "spouse_or_cp" | "caregiver"
  | "disability" | "tuition" | "medical" | "donations"
  | "home_buyers" | "first_home_savings" | "climate_action" | "other_credits";

// ── Helper: parser un montant OCR ──────────────────────────────
export function parseMoneyCents(raw: string | null | undefined): number | null {
  if (!raw) return null;
  // Les feuillets québécois utilisent souvent « 7 201,32 » tandis que les
  // feuillets fédéraux emploient « 7,201.32 ». La virgule est décimale
  // seulement lorsqu’aucun point décimal n’est déjà présent.
  const cellSplitAmount = raw.replace(/\u00a0/g, " ").trim().match(/^([0-9]{1,3}(?:[, ]\d{3})+)\s+(\d{2})$/);
  if (cellSplitAmount) {
    const dollars = Number(cellSplitAmount[1].replace(/[, ]/g, ""));
    const cents = Number(cellSplitAmount[2]);
    return Number.isFinite(dollars) && Number.isFinite(cents) ? dollars * 100 + cents : null;
  }
  let cleaned = raw.replace(/[$\s]/g, "");
  if (cleaned.includes(",") && !cleaned.includes(".")) cleaned = cleaned.replace(",", ".");
  else cleaned = cleaned.replace(/,/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
}

// ── Helper: extraire le nom de l'employeur du texte OCR ─────────
function extractEmployerName(ocrText: string): string | null {
  // Patterns courants pour le nom de l'employeur dans un T4
  const patterns = [
    /employer['']?s?\s+name[:\s]+([A-Z][^\n]{2,60})/i,
    /nom\s+de\s+l['']?employeur[:\s]+([A-Z][^\n]{2,60})/i,
    /([A-Z]{2,}[A-Z\s&.'-]{2,40}(?:INC|LTÉE?|LTD|CORP|SA|SAS|LLC)?\.?)\s*$/im,
  ];
  for (const p of patterns) {
    const m = ocrText.match(p);
    if (m?.[1]) return m[1].trim().substring(0, 255);
  }
  return null;
}

// ── Mapping cases → income/deduction/credit ────────────────────
interface FieldMapping {
  type: "income" | "income_and_offset" | "deduction" | "credit" | "withheld_federal" | "withheld_provincial" | "skip";
  category?: IncomeCategory | DeductionCategory | CreditCategory;
  labelFr: string;
  labelEn: string;
}

const T4_FIELD_MAP: Record<string, FieldMapping> = {
  // Revenus
  box_14:   { type: "income",              category: "employment",          labelFr: "Revenus d'emploi (T4 case 14)",          labelEn: "Employment income (T4 box 14)" },
  // Retenues (stockées comme withheld sur le taxReturn)
  box_22:   { type: "withheld_federal",    labelFr: "Impôt fédéral retenu (T4 case 22)",      labelEn: "Federal income tax withheld (T4 box 22)" },
  // Déductions
  box_16:   { type: "deduction",           category: "other_deductions",    labelFr: "Cotisations RPC/RRQ employé (T4 case 16)", labelEn: "CPP/QPP employee contributions (T4 box 16)" },
  box_18:   { type: "deduction",           category: "other_deductions",    labelFr: "Cotisations AE employé (T4 case 18)",     labelEn: "EI premiums employee (T4 box 18)" },
  box_44:   { type: "deduction",           category: "union_dues",          labelFr: "Cotisations syndicales (T4 case 44)",     labelEn: "Union dues (T4 box 44)" },
  // Crédits
  box_46:   { type: "credit",              category: "donations",           labelFr: "Dons de bienfaisance (T4 case 46)",       labelEn: "Charitable donations (T4 box 46)" },
  // Skip — informatif seulement
  box_24:   { type: "skip", labelFr: "Gains assurables AE", labelEn: "EI insurable earnings" },
  box_26:   { type: "skip", labelFr: "Gains ouvrant droit pension", labelEn: "CPP pensionable earnings" },
  box_52:   { type: "skip", labelFr: "Facteur d'équivalence", labelEn: "Pension adjustment" },
  employer: { type: "skip", labelFr: "Employeur", labelEn: "Employer" },
};

const RL1_FIELD_MAP: Record<string, FieldMapping> = {
  case_a: { type: "income",             category: "employment",       labelFr: "Revenus d'emploi (RL-1 case A)",        labelEn: "Employment income (RL-1 box A)" },
  case_e: { type: "withheld_provincial",                              labelFr: "Impôt provincial retenu (RL-1 case E)", labelEn: "Provincial income tax withheld (RL-1 box E)" },
  case_b: { type: "deduction",          category: "other_deductions", labelFr: "Cotisations RRQ (RL-1 case B)",         labelEn: "QPP contributions (RL-1 box B)" },
  case_c: { type: "deduction",          category: "other_deductions", labelFr: "Cotisations RQAP (RL-1 case C)",        labelEn: "QPIP premiums (RL-1 box C)" },
  case_j: { type: "deduction",          category: "union_dues",       labelFr: "Cotisations syndicales (RL-1 case J)",  labelEn: "Union dues (RL-1 box J)" },
};

const T5_FIELD_MAP: Record<string, FieldMapping> = {
  box_11: { type: "income", category: "dividends_eligible",   labelFr: "Dividendes déterminés (T5 case 11)",   labelEn: "Eligible dividends (T5 box 11)" },
  box_25: { type: "income", category: "dividends_ineligible", labelFr: "Dividendes non déterminés (T5 case 25)", labelEn: "Non-eligible dividends (T5 box 25)" },
  box_13: { type: "income", category: "interest",             labelFr: "Intérêts (T5 case 13)",                 labelEn: "Interest (T5 box 13)" },
};

const T4A_FIELD_MAP: Record<string, FieldMapping> = {
  box_016: { type: "income", category: "pension",          labelFr: "Pension ou rente (T4A case 16)",                    labelEn: "Pension or superannuation (T4A box 16)" },
  box_018: { type: "income", category: "other_income",     labelFr: "Paiement forfaitaire (T4A case 18)",                labelEn: "Lump-sum payment (T4A box 18)" },
  box_020: { type: "income", category: "self_employment",  labelFr: "Commissions de travail indépendant (T4A case 20)", labelEn: "Self-employed commissions (T4A box 20)" },
  box_022: { type: "withheld_federal",                       labelFr: "Impôt fédéral retenu (T4A case 22)",               labelEn: "Federal income tax withheld (T4A box 22)" },
  box_024: { type: "income", category: "pension",          labelFr: "Rentes (T4A case 24)",                              labelEn: "Annuities (T4A box 24)" },
  box_048: { type: "income", category: "self_employment",  labelFr: "Honoraires pour services (T4A case 48)",           labelEn: "Fees for services (T4A box 48)" },
  box_105: { type: "income", category: "other_income",     labelFr: "Bourses ou subventions (T4A case 105)",            labelEn: "Scholarships or grants (T4A box 105)" },
};

// Les indemnités CNESST / accidents du travail sont déclarées comme revenu,
// puis déduites entièrement : elles ne deviennent jamais un revenu imposable.
const BENEFIT_FIELD_MAP: Record<string, FieldMapping> = {
  box_10: { type: "income_and_offset", category: "social_assistance", labelFr: "Indemnités non imposables (T5007 case 10)", labelEn: "Non-taxable benefits (T5007 box 10)" },
  case_c: { type: "income_and_offset", category: "social_assistance", labelFr: "Indemnités CNESST non imposables (RL-5 case C)", labelEn: "Non-taxable CNESST benefits (RL-5 box C)" },
};

const DOCUMENT_FIELD_MAPS: Record<string, Record<string, FieldMapping>> = {
  "T4":    T4_FIELD_MAP,
  "RL-1":  RL1_FIELD_MAP,
  "T5":    T5_FIELD_MAP,
  "T4A":   T4A_FIELD_MAP,
  "T4E":   { box_14: { type: "income", category: "ei_benefits", labelFr: "Prestations AE (T4E)", labelEn: "EI benefits (T4E)" } },
  "T5007": BENEFIT_FIELD_MAP,
  "RL-5":  BENEFIT_FIELD_MAP,
};

export function hasTaxMappingForDocumentType(documentTypeCode: string): boolean {
  return Boolean(getExtractor(documentTypeCode))
    && Object.values(DOCUMENT_FIELD_MAPS[documentTypeCode] ?? {}).some(mapping => mapping.type !== "skip");
}

// ── Fonction principale ────────────────────────────────────────
export async function syncOcrToEntries(params: {
  extractionId: string;
  documentId: string;
  userId: string;
  taxReturnId: string;
  documentTypeCode: string;
  ocrText?: string;
}): Promise<{ created: number; skipped: number; errors: string[] }> {
  const { extractionId, documentId, userId, taxReturnId, documentTypeCode, ocrText } = params;
  const errors: string[] = [];
  let created = 0;
  let skipped = 0;

  // Récupérer taxProfileId et taxYearId depuis le taxReturn
  const [taxReturn] = await db.select({
    profileId: taxReturns.profileId,
    taxYearId: taxReturns.taxYearId,
  }).from(taxReturns).where(eq(taxReturns.id, taxReturnId)).limit(1);

  if (!taxReturn) { return { created: 0, skipped: 0, errors: ["taxReturn introuvable"] }; }

  const taxProfileId = taxReturn.profileId;
  const taxYearId = taxReturn.taxYearId;

  // Récupérer les champs extraits
  const fields = await db.select().from(extractionFields)
    .where(eq(extractionFields.extractionId, extractionId));

  if (fields.length === 0) return { created: 0, skipped: 0, errors: ["Aucun champ extrait"] };

  // Map des champs disponibles
  const fieldMap = DOCUMENT_FIELD_MAPS[documentTypeCode] ?? {};
  const employerName = ocrText ? extractEmployerName(ocrText) : null;

  for (const field of fields) {
    const mapping = fieldMap[field.fieldCode];
    if (!mapping || mapping.type === "skip") { skipped++; continue; }

    // Valeur finale (validée > brute)
    const rawValue = field.validatedValue ?? field.rawOcrValue;
    const amountCents = parseMoneyCents(rawValue);

    // Ignorer les montants nuls ou invalides (sauf si champ requis)
    if (amountCents === null || amountCents === 0) { skipped++; continue; }

    try {
      if (mapping.type === "income" || mapping.type === "income_and_offset") {
        // Vérifier doublon
        const existing = await db.select({ id: incomeEntries.id })
          .from(incomeEntries)
          .where(and(
            eq(incomeEntries.userId, userId),
            eq(incomeEntries.taxReturnId, taxReturnId),
            eq(incomeEntries.sourceDocumentId, documentId),
            eq(incomeEntries.category, mapping.category as IncomeCategory),
          )).limit(1);

        if (existing.length > 0) { skipped++; continue; }

        // Auto-validation: les données T4/RL-1 sont des documents officiels émis par l'employeur.
        // Case 14 (revenus d'emploi) = validée automatiquement.
        const autoValidate = ["employment", "pension", "ei_benefits"].includes(mapping.category as string);
        await db.insert(incomeEntries).values({
          userId, taxProfileId, taxYearId,
          taxReturnId,
          category: mapping.category as IncomeCategory,
          sourceDocumentId: documentId,
          sourceType: "validated_ocr",
          amountCents,
          description: mapping.labelFr,
          employerName: employerName ?? undefined,
          isValidated: autoValidate,
        });
        created++;

        if (mapping.type === "income_and_offset") {
          const offsetLabel = `Déduction compensatoire — ${mapping.labelFr}`;
          const [existingOffset] = await db.select({ id: deductionEntries.id })
            .from(deductionEntries)
            .where(and(
              eq(deductionEntries.userId, userId),
              eq(deductionEntries.taxReturnId, taxReturnId),
              eq(deductionEntries.sourceDocumentId, documentId),
              eq(deductionEntries.description, offsetLabel),
            )).limit(1);
          if (!existingOffset) {
            await db.insert(deductionEntries).values({
              userId, taxProfileId, taxYearId,
              taxReturnId,
              category: "other_deductions",
              sourceDocumentId: documentId,
              sourceType: "validated_ocr",
              amountCents,
              description: offsetLabel,
              isValidated: true,
            });
            created++;
          }
        }

      } else if (mapping.type === "deduction") {
        const existing = await db.select({ id: deductionEntries.id })
          .from(deductionEntries)
          .where(and(
            eq(deductionEntries.userId, userId),
            eq(deductionEntries.taxReturnId, taxReturnId),
            eq(deductionEntries.sourceDocumentId, documentId),
            eq(deductionEntries.category, mapping.category as DeductionCategory),
          )).limit(1);

        if (existing.length > 0) { skipped++; continue; }

        await db.insert(deductionEntries).values({
          userId, taxProfileId, taxYearId,
          taxReturnId,
          category: mapping.category as DeductionCategory,
          sourceDocumentId: documentId,
          sourceType: "validated_ocr",
          amountCents,
          description: mapping.labelFr,
          isValidated: true, // Cotisations RPC/RRQ/AE = faits légaux auto-validés
        });
        created++;

      } else if (mapping.type === "credit") {
        const existing = await db.select({ id: creditEntries.id })
          .from(creditEntries)
          .where(and(
            eq(creditEntries.userId, userId),
            eq(creditEntries.taxReturnId, taxReturnId),
            eq(creditEntries.sourceDocumentId, documentId),
            eq(creditEntries.category, mapping.category as CreditCategory),
          )).limit(1);

        if (existing.length > 0) { skipped++; continue; }

        await db.insert(creditEntries).values({
          userId, taxProfileId, taxYearId,
          taxReturnId,
          category: mapping.category as CreditCategory,
          sourceDocumentId: documentId,
          sourceType: "validated_ocr",
          claimedAmountCents: amountCents,
          description: mapping.labelFr,
          isValidated: false,
        });
        created++;

      } else if (mapping.type === "withheld_federal") {
        // Mettre à jour estimatedFederalRefund sur taxReturn comme proxy
        // (le champ dédié withheld n'est pas sur taxReturns — on stocke en deduction_entries comme "retenue")
        const existing = await db.select({ id: deductionEntries.id })
          .from(deductionEntries)
          .where(and(
            eq(deductionEntries.userId, userId),
            eq(deductionEntries.taxReturnId, taxReturnId),
            eq(deductionEntries.sourceDocumentId, documentId),
            eq(deductionEntries.description, mapping.labelFr),
          )).limit(1);

        if (existing.length > 0) { skipped++; continue; }

        await db.insert(deductionEntries).values({
          userId, taxProfileId, taxYearId,
          taxReturnId,
          category: "other_deductions",
          sourceDocumentId: documentId,
          sourceType: "validated_ocr",
          amountCents,
          description: mapping.labelFr,
          isValidated: true, // Les retenues sont des faits, pas des déductions à valider
        });
        created++;

      } else if (mapping.type === "withheld_provincial") {
        const existing = await db.select({ id: deductionEntries.id })
          .from(deductionEntries)
          .where(and(
            eq(deductionEntries.userId, userId),
            eq(deductionEntries.taxReturnId, taxReturnId),
            eq(deductionEntries.sourceDocumentId, documentId),
            eq(deductionEntries.description, mapping.labelFr),
          )).limit(1);

        if (existing.length > 0) { skipped++; continue; }

        await db.insert(deductionEntries).values({
          userId, taxProfileId, taxYearId,
          taxReturnId,
          category: "other_deductions",
          sourceDocumentId: documentId,
          sourceType: "validated_ocr",
          amountCents,
          description: mapping.labelFr,
          isValidated: true,
        });
        created++;
      }

    } catch (e) {
      errors.push(`${field.fieldCode}: ${e instanceof Error ? e.message : "erreur"}`);
    }
  }

  // Marquer le document comme ready_for_tax_return si des entrées ont été créées
  if (created > 0) {
    await db.update(fiscalDocuments)
      .set({ status: "ready_for_tax_return", updatedAt: new Date() })
      .where(eq(fiscalDocuments.id, documentId));
  }

  return { created, skipped, errors };
}
