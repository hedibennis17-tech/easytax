// ═══════════════════════════════════════════════════════════════
// TAX ENGINE — Types centraux
// Toutes les valeurs monétaires sont en CENTS (integer)
// Jamais de float pour l'argent
// ═══════════════════════════════════════════════════════════════

export type TaxYear = 2024 | 2025 | 2026;

export type JurisdictionCode =
  | "CA"  // Fédéral
  | "QC" | "ON" | "BC" | "AB" | "SK" | "MB"
  | "NB" | "NS" | "PE" | "NL" | "NT" | "NU" | "YT";

// Entrées validées uniquement — le moteur refuse les données non validées
export interface ValidatedIncome {
  category: string;
  amountCents: number;  // entier, jamais float
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

// Input du Tax Engine
export interface TaxEngineInput {
  taxYear: number;
  province: JurisdictionCode;
  incomes: ValidatedIncome[];
  deductions: ValidatedDeduction[];
  credits: ValidatedCredit[];
  taxWithheldFederalCents: number;     // retenues fédérales (T4 case 22)
  taxWithheldProvincialCents: number;  // retenues provinciales (T4 case 22 provincial)
  hasSpouse: boolean;
  spouseNetIncomeCents?: number;
}

// Paliers d'imposition
export interface TaxBracket {
  minCents: number;
  maxCents: number | null;
  rateBasisPoints: number;  // 1500 = 15.00%
}

// Règles fiscales versionnées
export interface TaxRulesForYear {
  taxYear: number;
  jurisdiction: JurisdictionCode;
  rulesVersion: string;
  // Montants des crédits personnels de base (cents)
  federalBasicPersonalCents: number;
  provincialBasicPersonalCents: number;
  // Paliers fédéraux
  federalBrackets: TaxBracket[];
  // Paliers provinciaux
  provincialBrackets: TaxBracket[];
}

// Résultat du calcul (cents, jamais float)
export interface TaxCalculationResult {
  taxYear: number;
  province: JurisdictionCode;
  isPreliminary: boolean;
  rulesVersion: string;

  // Revenus
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
  federalBalanceCents: number;  // < 0 = remboursement

  // Provincial
  provincialTaxBeforeCreditsCents: number;
  provincialBasicPersonalCreditCents: number;
  provincialOtherCreditsCents: number;
  provincialTaxPayableCents: number;
  provincialTaxWithheldCents: number;
  provincialBalanceCents: number;

  // Total
  totalBalanceCents: number;

  // Breakdown lisible (pour UI "Pourquoi ce montant?")
  breakdown: CalculationBreakdown;
}

export interface CalculationBreakdown {
  incomeByCategory: { category: string; amountCents: number }[];
  deductionByCategory: { category: string; amountCents: number }[];
  federalBracketApplication: BracketApplication[];
  provincialBracketApplication: BracketApplication[];
  creditsApplied: { name: string; amountCents: number }[];
}

export interface BracketApplication {
  label: string;
  incomeCents: number;
  rateBasisPoints: number;
  taxCents: number;
}
