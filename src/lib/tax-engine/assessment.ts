/**
 * Avis de cotisation ARC — données normalisées et rapprochement.
 * Toutes les valeurs monétaires sont en cents. Le document de l’ARC sert de
 * référence de contrôle; il ne remplace pas les données validées d’une année.
 */

export type AssessmentLineCode =
  | "15000" | "23600" | "26000" | "35000" | "42000" | "43500"
  | "43700" | "45300" | "48200";

export type AssessmentLine = {
  code: AssessmentLineCode;
  amountCents: number;
  creditDebit: "credit" | "debit" | "none";
  labelFr: string;
  labelEn: string;
  page?: number;
};

export type RrspAssessment = {
  unusedRoomEnd2025Cents: number;
  newRoomEarned2025Cents: number;
  availableRoom2026Cents: number;
  employeePrpp2025Cents: number;
  rrspDeduction2025Cents: number;
  pensionAdjustment2025Cents: number;
};

export type NoticeOfAssessment = {
  documentType: "NOA";
  authority: "CRA";
  taxYear: number;
  noticeDate: string | null;
  lines: Partial<Record<AssessmentLineCode, AssessmentLine>>;
  rrsp: RrspAssessment | null;
  flags: {
    refundHeldForGstHstReturn: boolean;
    noBalanceOwing: boolean;
  };
  source: "ocr" | "manual";
  extractionVersion: string;
};

export type AssessmentReconciliation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checks: Array<{ code: string; expectedCents: number; actualCents: number; ok: boolean }>;
};

const LABELS: Record<AssessmentLineCode, [string, string]> = {
  "15000": ["Revenu total", "Total income"],
  "23600": ["Revenu net", "Net income"],
  "26000": ["Revenu imposable", "Taxable income"],
  "35000": ["Total des crédits d’impôt non remboursables", "Total non-refundable tax credits"],
  "42000": ["Impôt fédéral net", "Net federal tax"],
  "43500": ["Total à payer", "Total payable"],
  "43700": ["Impôt total retenu", "Total income tax deducted"],
  "45300": ["Allocation canadienne pour les travailleurs", "Canada Workers Benefit"],
  "48200": ["Total des crédits", "Total credits"],
};

function parseMoneyToken(value: string): number | null {
  const normalized = value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const match = normalized.match(/(?:\d{1,3}(?:[ ,]\d{3})*|\d+)(?:[.,]\d{2})?/);
  if (!match) return null;
  const numeric = match[0].replace(/ /g, "").replace(/,/g, ".");
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function lastMoneyIn(value: string): number | null {
  const matches = value.match(/(?:\d{1,3}(?:[ ,]\d{3})*|\d+)(?:[.,]\d{2})?/g) ?? [];
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const parsed = parseMoneyToken(matches[index]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function findAmountAfterLabel(text: string, line: string): number | null {
  const escaped = line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`(?:^|\\n)\\s*${escaped}[^\\n]*`, "i"));
  if (!match || match.index === undefined) return null;
  const following = text.slice(match.index).split("\\n").slice(0, 4).join(" ");
  return lastMoneyIn(following);
}

function assessmentLine(code: AssessmentLineCode, amountCents: number, text: string): AssessmentLine {
  const [labelFr, labelEn] = LABELS[code];
  const creditDebit = /CT\s*$/i.test(text) ? "credit" : /DT\s*$/i.test(text) ? "debit" : "none";
  return { code, amountCents, creditDebit, labelFr, labelEn };
}

export function parseNoticeOfAssessment(text: string, source: "ocr" | "manual" = "ocr"): NoticeOfAssessment {
  const normalized = text.replace(/\r/g, "");
  const year = normalized.match(/(?:Année d’imposition|Année d'imposition|Tax year)\s+(20\d{2})/i)?.[1];
  const date = normalized.match(/(?:Date de l’avis|Date de l'avis|Notice date)\s+([^\n]+)/i)?.[1]?.trim() ?? null;
  const lines = {} as Partial<Record<AssessmentLineCode, AssessmentLine>>;
  for (const code of Object.keys(LABELS) as AssessmentLineCode[]) {
    const codeMatch = normalized.match(new RegExp(`^\\s*${code}\\s+([^\\n]{0,180})`, "mi"));
    const row = codeMatch?.[1] ?? "";
    const amount = lastMoneyIn(row);
    if (amount !== null) lines[code] = assessmentLine(code, amount, row);
  }

  const rrspValue = (label: string) => findAmountAfterLabel(normalized, label) ?? 0;
  const rrspFinal = (pattern: RegExp) => {
    const match = normalized.match(pattern);
    if (!match || match.index === undefined) return 0;
    return lastMoneyIn(normalized.slice(match.index).split("\n").slice(0, 1).join(" ")) ?? 0;
  };
  const rrsp = /maximum déductible au titre des REER pour 2026|RRSP deduction limit for 2026/i.test(normalized) ? {
    unusedRoomEnd2025Cents: rrspFinal(/Égale\s*:\s*vos déductions inutilisées au titre des REER à la fin de 2025/i) || rrspValue("déductions inutilisées au titre des REER à la fin de 2025"),
    newRoomEarned2025Cents: rrspFinal(/Égale\s*:\s*maximum déductible au titre des REER supplémentaire que vous avez gagné en/i),
    availableRoom2026Cents: rrspFinal(/Voici vos droits de cotisation REER pour 2026/i),
    employeePrpp2025Cents: rrspFinal(/cotisations de l’employeur à un RPAC pour 2025/i),
    rrspDeduction2025Cents: rrspFinal(/cotisations admissibles au REER que vous avez déduites pour 2025/i),
    pensionAdjustment2025Cents: rrspFinal(/facteur d’équivalence \(FE\) pour 2025/i),
  } : null;

  return {
    documentType: "NOA", authority: "CRA", taxYear: Number(year ?? 0), noticeDate: date,
    lines, rrsp,
    flags: {
      refundHeldForGstHstReturn: /remboursement.*retenu[\s\S]{0,140}TPS\/TVH|refund.*held[\s\S]{0,140}GST\/HST/i.test(normalized),
      noBalanceOwing: /aucun montant à payer|no balance owing/i.test(normalized),
    },
    source, extractionVersion: "NOA-2025.v1",
  };
}

export function reconcileAssessment(assessment: NoticeOfAssessment, calculated: Partial<Record<AssessmentLineCode, number>>): AssessmentReconciliation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: AssessmentReconciliation["checks"] = [];
  const check = (code: AssessmentLineCode) => {
    const expected = assessment.lines[code]?.amountCents;
    const actual = calculated[code];
    if (expected === undefined || actual === undefined) return;
    const ok = expected === actual;
    checks.push({ code, expectedCents: expected, actualCents: actual, ok });
    if (!ok) errors.push(`Ligne ${code}: avis ${expected} cents, calcul ${actual} cents.`);
  };
  (Object.keys(LABELS) as AssessmentLineCode[]).forEach(check);
  const total = assessment.lines["48200"]?.amountCents;
  const withheld = assessment.lines["43700"]?.amountCents ?? 0;
  const refundable = assessment.lines["45300"]?.amountCents ?? 0;
  if (total !== undefined && calculated["35000"] !== undefined && calculated["35000"] > total) warnings.push("Les crédits non remboursables dépassent le total des crédits de l’avis; vérifier le mapping.");
  if (assessment.flags.refundHeldForGstHstReturn) warnings.push("L’avis indique que le remboursement est retenu pour une déclaration TPS/TVH en attente.");
  if (withheld === 0 && refundable === 0) warnings.push("Aucune retenue ni prestation ACT détectée dans l’avis.");
  return { ok: errors.length === 0, errors, warnings, checks };
}
