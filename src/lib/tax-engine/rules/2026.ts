import config from "../tax-config-2026.json";
import type { JurisdictionCode, TaxBracket, TaxRulesForYear } from "../types";

type SimulatorBracket = { min: number; max: number | null; rate: number };
type SimulatorProvince = { brackets: SimulatorBracket[]; bpa: number; abatement?: number; healthPremium?: boolean };

const provinceKeys: Record<Exclude<JurisdictionCode, "CA">, keyof typeof config.provinces> = {
  QC: "quebec", ON: "ontario", AB: "alberta", BC: "british_columbia", MB: "manitoba",
  SK: "saskatchewan", NS: "nova_scotia", NB: "new_brunswick", NL: "newfoundland",
  PE: "prince_edward_island", NT: "northwest_territories", NU: "nunavut", YT: "yukon",
};

const dollarsToCents = (value: number) => Math.round(value * 100);
const brackets = (items: SimulatorBracket[]): TaxBracket[] => items.map((item) => ({
  minCents: dollarsToCents(item.min),
  maxCents: item.max === null ? null : dollarsToCents(item.max),
  rateBasisPoints: Math.round(item.rate * 10000),
}));
const emptyCreditRate = (rate: number) => ({ baseRateBP: Math.round(rate * 10000) });

const federalBrackets = brackets(config.federal.brackets);
const federalBpa = dollarsToCents(config.federal.bpa);

function makeRules(province: JurisdictionCode): TaxRulesForYear {
  const simulatorProvince: SimulatorProvince = province === "CA"
    ? { brackets: config.federal.brackets, bpa: config.federal.bpa }
    : config.provinces[provinceKeys[province]];
  const provincialBrackets = province === "CA" ? [] : brackets(simulatorProvince.brackets);
  const provincialRate = simulatorProvince.brackets[0]?.rate ?? 0;
  return {
    taxYear: 2026,
    jurisdiction: province,
    rulesVersion: "2026.simulator.1.0",
    federalBasicPersonalConfig: { fullAmountCents: federalBpa },
    provincialBasicPersonalConfig: { fullAmountCents: dollarsToCents(simulatorProvince.bpa) },
    federalBasicPersonalCents: federalBpa,
    provincialBasicPersonalCents: dollarsToCents(simulatorProvince.bpa),
    federalBrackets,
    provincialBrackets,
    federalCreditRate: emptyCreditRate(config.federal.brackets[0].rate),
    provincialCreditRate: emptyCreditRate(provincialRate),
    filingDeadline: "2027-04-30",
    paymentDeadline: "2027-04-30",
    provincialForm: province === "QC" ? "TP-1" : province === "CA" ? "T1" : `${province}428`,
    hasOwnAgency: province === "QC",
    agencyFr: province === "QC" ? "Revenu Québec" : "Agence du revenu du Canada",
    agencyEn: province === "QC" ? "Revenu Québec" : "Canada Revenue Agency",
    pensionPlanCode: province === "QC" ? "QPP" : "CPP",
    hasRQAP: province === "QC",
  };
}

export const RULES_REGISTRY_2026: Record<string, TaxRulesForYear> = {
  ...Object.fromEntries((["CA", ...Object.keys(provinceKeys)] as JurisdictionCode[]).map((province) => [`2026_${province}`, makeRules(province)])),
};

export function getRulesFor2026(province: string): TaxRulesForYear | null {
  return RULES_REGISTRY_2026[`2026_${province}`] ?? null;
}
