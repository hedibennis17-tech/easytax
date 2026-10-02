// ═══════════════════════════════════════════════════════════════
// RÈGLES FISCALES 2025 — Canada + Québec + Ontario
// Source: CRA + Revenu Québec
// VERSION: 1.0.0
// ⚠️ Taux indicatifs — calculs préliminaires non officiels
// ═══════════════════════════════════════════════════════════════

import type { TaxRulesForYear } from "../types";

export const FEDERAL_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "CA",
  rulesVersion: "2025.CA.1.0",
  federalBasicPersonalCents: 1601400,
  provincialBasicPersonalCents: 0,
  federalBrackets: [
    { minCents: 0,        maxCents: 5767500,  rateBasisPoints: 1500 },
    { minCents: 5767500,  maxCents: 11545900, rateBasisPoints: 2050 },
    { minCents: 11545900, maxCents: 15914900, rateBasisPoints: 2600 },
    { minCents: 15914900, maxCents: 24020900, rateBasisPoints: 2900 },
    { minCents: 24020900, maxCents: null,      rateBasisPoints: 3300 },
  ],
  provincialBrackets: [],
};

export const QC_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "QC",
  rulesVersion: "2025.QC.1.0",
  federalBasicPersonalCents: 1601400,
  provincialBasicPersonalCents: 1773000,
  federalBrackets: FEDERAL_RULES_2025.federalBrackets,
  provincialBrackets: [
    { minCents: 0,         maxCents: 5164500,  rateBasisPoints: 1400 },
    { minCents: 5164500,   maxCents: 10329000, rateBasisPoints: 1900 },
    { minCents: 10329000,  maxCents: 12587500, rateBasisPoints: 2400 },
    { minCents: 12587500,  maxCents: null,      rateBasisPoints: 2575 },
  ],
};

export const ON_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "ON",
  rulesVersion: "2025.ON.1.0",
  federalBasicPersonalCents: 1601400,
  provincialBasicPersonalCents: 1194100,
  federalBrackets: FEDERAL_RULES_2025.federalBrackets,
  provincialBrackets: [
    { minCents: 0,         maxCents: 5199600,  rateBasisPoints: 505  },
    { minCents: 5199600,   maxCents: 10401200, rateBasisPoints: 915  },
    { minCents: 10401200,  maxCents: 15000000, rateBasisPoints: 1116 },
    { minCents: 15000000,  maxCents: 22000000, rateBasisPoints: 1216 },
    { minCents: 22000000,  maxCents: null,      rateBasisPoints: 1316 },
  ],
};

const RULES_REGISTRY: Record<string, TaxRulesForYear> = {
  "2025_CA": FEDERAL_RULES_2025,
  "2025_QC": QC_RULES_2025,
  "2025_ON": ON_RULES_2025,
};

export function getRulesForYearAndProvince(
  taxYear: number,
  province: string
): TaxRulesForYear | null {
  return RULES_REGISTRY[`${taxYear}_${province}`] ?? RULES_REGISTRY[`${taxYear}_CA`] ?? null;
}

export function getSupportedYears(): number[] {
  return [2025];
}

export function getSupportedProvinces(taxYear: number): string[] {
  return Object.keys(RULES_REGISTRY)
    .filter((k) => k.startsWith(`${taxYear}_`))
    .map((k) => k.split("_")[1]);
}
