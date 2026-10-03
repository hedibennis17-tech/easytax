// ═══════════════════════════════════════════════════════════════
// TAX ENGINE — Types centraux
// Toutes les valeurs monétaires sont en CENTS (integer)
// Jamais de float pour l'argent
// Sources: ARC T4032 2025, budgets provinciaux 2025
// ═══════════════════════════════════════════════════════════════

export type TaxYear = 2024 | 2025 | 2026;

export type JurisdictionCode =
  | "CA"  // Fédéral
  | "QC" | "ON" | "BC" | "AB" | "SK" | "MB"
  | "NB" | "NS" | "PE" | "NL" | "NT" | "NU" | "YT";

// ─── Palier d'imposition ──────────────────────────────────────
export interface TaxBracket {
  minCents: number;
  maxCents: number | null;
  rateBasisPoints: number; // 1500 = 15.00%
}

// ─── Surtaxe provinciale (ON seulement en 2025) ──────────────
export interface ProvincialSurtax {
  // Surtaxe = % appliqué sur l'impôt de base qui DÉPASSE le seuil
  threshold1Cents: number;  // seuil 1 — au-delà: +rateBP1
  rateBP1: number;          // taux en basis points
  threshold2Cents: number | null; // seuil 2 — au-delà: +rateBP2 supplémentaire
  rateBP2: number | null;
}

// ─── BPA avec élimination progressive ────────────────────────
// MB: éliminé entre 200 000 $ et 400 000 $ de revenu net
// YT: éliminé entre 177 882 $ et 253 414 $
export interface BasicPersonalAmountConfig {
  fullAmountCents: number;    // montant complet (faible revenu)
  minAmountCents?: number;    // montant minimum (haut revenu) — si null: pas de réduction
  phaseOutStartCents?: number; // revenu où commence l'élimination
  phaseOutEndCents?: number;   // revenu où BPA atteint le minimum
}

// ─── Crédit remboursable provincial ──────────────────────────
export interface RefundableCredit {
  code: string;
  nameFr: string;
  nameEn: string;
  isRefundable: boolean;
  // Montant fixe OU formule
  fixedAmountCents?: number;
  // Phase-in / phase-out
  phaseInRateBP?: number;     // taux d'accumulation
  phaseOutRateBP?: number;    // taux de réduction
  phaseOutStartCents?: number;
  maxAmountCents?: number;
}

// ─── Taux du crédit non remboursable ─────────────────────────
// Normalement = taux du 1er palier, mais AB 2025 = 8% + 2% supplémentaire
export interface CreditRateConfig {
  baseRateBP: number;         // taux de base (= palier 1 en général)
  supplementalRateBP?: number; // AB: +200 BP sur crédits > 60 000 $
  supplementalThresholdCents?: number; // AB: 6 000 000
}

// ─── Taux sociétés ───────────────────────────────────────────
export interface CorporateTaxRates {
  generalRateBP: number;       // taux général provincial
  smallBusinessRateBP: number; // taux petites entreprises
  smallBusinessLimitCents: number; // plafond DPE provincial
  manufacturingRateBP?: number;   // M&P si différent du général
  // Changements intra-année (NS, PE 2025)
  effectiveFrom?: string;      // "2025-01-01"
  effectiveTo?: string;        // "2025-03-31"
}

// ─── Règles fiscales complètes pour une année/province ───────
export interface TaxRulesForYear {
  taxYear: number;
  jurisdiction: JurisdictionCode;
  rulesVersion: string;

  // ── BPA (peut avoir élimination progressive) ──────────────
  federalBasicPersonalConfig: BasicPersonalAmountConfig;
  provincialBasicPersonalConfig: BasicPersonalAmountConfig;

  // Rétrocompat — accès rapide en cents
  federalBasicPersonalCents: number;
  provincialBasicPersonalCents: number;

  // ── Paliers d'imposition ──────────────────────────────────
  federalBrackets: TaxBracket[];
  provincialBrackets: TaxBracket[];

  // ── Taux de crédit non remboursable ──────────────────────
  federalCreditRate: CreditRateConfig;
  provincialCreditRate: CreditRateConfig;

  // ── Surtaxe provinciale (ON seulement en 2025) ───────────
  provincialSurtax?: ProvincialSurtax;

  // ── Crédits remboursables provinciaux ────────────────────
  refundableCredits?: RefundableCredit[];

  // ── Taux sociétés ────────────────────────────────────────
  corporate?: CorporateTaxRates | CorporateTaxRates[]; // tableau si changement intra-année

  // ── Deadlines ─────────────────────────────────────────────
  filingDeadline: string;    // "2026-04-30"
  paymentDeadline: string;   // "2026-04-30"

  // ── Formulaires ───────────────────────────────────────────
  provincialForm: string;    // "TP-1", "ON428", "AB428", "AT1"...
  hasOwnAgency: boolean;     // true = QC (RQ) et AB (AT1)
  agencyFr: string;          // "Revenu Québec", "ARC"
  agencyEn: string;

  // ── Cotisations obligatoires ──────────────────────────────
  // RPC = toutes sauf QC. RRQ = QC. RQAP = QC seulement.
  pensionPlanCode: "CPP" | "QPP";
  hasRQAP: boolean; // RQAP — Québec seulement
}

// ─── Entrées validées ─────────────────────────────────────────
export interface ValidatedIncome {
  category: string;
  amountCents: number;
  sourceType: "validated_ocr" | "manual" | "profile";
  employerName?: string;
  description?: string;
}

export interface ValidatedDeduction {
  category: string;
  amountCents: number;
  sourceType: "validated_ocr" | "manual";
  description?: string;
}

export interface ValidatedCredit {
  category: string;
  claimedAmountCents: number;
  sourceType: "validated_ocr" | "manual";
  description?: string;
}

// ─── Input du moteur ─────────────────────────────────────────
export interface TaxEngineInput {
  taxYear: number;
  province: JurisdictionCode;
  incomes: ValidatedIncome[];
  deductions: ValidatedDeduction[];
  credits: ValidatedCredit[];
  taxWithheldFederalCents: number;
  taxWithheldProvincialCents: number;
  hasSpouse: boolean;
  spouseNetIncomeCents?: number;
}

// ─── Résultat du calcul ───────────────────────────────────────
export interface TaxCalculationResult {
  taxYear: number;
  province: JurisdictionCode;
  isPreliminary: boolean;
  rulesVersion: string;

  totalIncomeCents: number;
  totalDeductionsCents: number;
  netIncomeCents: number;
  taxableIncomeCents: number;

  // Fédéral
  federalTaxBeforeCreditsCents: number;
  federalBasicPersonalCreditCents: number;
  federalOtherCreditsCents: number;
  federalTaxPayableCents: number;
  federalTaxWithheldCents: number;
  federalBalanceCents: number;

  // Provincial
  provincialTaxBeforeCreditsCents: number;
  provincialSurtaxCents: number;        // 0 sauf ON
  provincialBasicPersonalCreditCents: number;
  provincialOtherCreditsCents: number;
  provincialRefundableCreditsCents: number;
  provincialTaxPayableCents: number;
  provincialTaxWithheldCents: number;
  provincialBalanceCents: number;

  totalBalanceCents: number;
  breakdown: CalculationBreakdown;
}

export interface CalculationBreakdown {
  incomeByCategory: { category: string; amountCents: number }[];
  deductionByCategory: { category: string; amountCents: number }[];
  federalBracketApplication: BracketApplication[];
  provincialBracketApplication: BracketApplication[];
  creditsApplied: { name: string; amountCents: number; isRefundable: boolean }[];
}

export interface BracketApplication {
  label: string;
  incomeCents: number;
  rateBasisPoints: number;
  taxCents: number;
}
