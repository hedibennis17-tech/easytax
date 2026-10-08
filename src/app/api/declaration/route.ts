import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { taxProfiles, taxReturns, taxYears, incomeEntries, deductionEntries, creditEntries, taxCalculations } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { normalizeProvinceCode } from "@/lib/provinces";
import type { QuestionnaireProgress } from "@/lib/questionnaire-progress";
import { getAllQuestionsWithProvince, INDIVIDUAL_SECTIONS, type Question } from "@/lib/questionnaire-individual";

import path from "path";
import fs from "fs";

type DictT1Line  = { label_fr: string; label_en?: string; section: string };
type DictTP1Line = { label_fr: string; section: string };
type DictType    = { t1_lines: Record<string, DictT1Line>; tp1_lines: Record<string, DictTP1Line> };
type QuestionnaireAnswerSummary = {
  id: string;
  section: string;
  sectionFr: string;
  sectionEn: string;
  questionFr: string;
  questionEn: string;
  type: string;
  value: unknown;
  displayValue: string;
  validated: boolean;
};
type NoticeReference = {
  taxYear: number;
  noticeDate: string | null;
  lines: Record<string, { amountCents: number; creditDebit: string; labelFr: string; labelEn: string }>;
  rrsp: unknown;
  flags: { refundHeldForGstHstReturn: boolean; noBalanceOwing: boolean };
} | null;

function loadDict(): DictType {
  const p = path.join(process.cwd(), "src/lib/ocr/dictionnaire-fiscal-complet-2025.json");
  return JSON.parse(fs.readFileSync(p, "utf-8")) as DictType;
}

function cents(v: number | null | undefined) { return v ?? 0; }

function readQuestionnaireProgress(raw: string | null | undefined): QuestionnaireProgress | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { questionnaireProgress?: QuestionnaireProgress };
    return parsed.questionnaireProgress ?? null;
  } catch {
    return null;
  }
}

function readQuestionnaireAnswers(raw: string | null | undefined, province: string): QuestionnaireAnswerSummary[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as { questionnaireAnswers?: Record<string, unknown>; questionnaireValidated?: Record<string, boolean> };
    const answers = data.questionnaireAnswers ?? {};
    const validated = data.questionnaireValidated ?? {};
    const questions = new Map<string, Question>(getAllQuestionsWithProvince().map(question => [question.id, question]));
    const sections = new Map(INDIVIDUAL_SECTIONS.map(section => [section.code, section]));
    return Object.entries(answers)
      .filter(([id, value]) => value !== undefined && value !== null && value !== "" && !["triage_done", "profil_done", "revenus_validated", "credits_validated", "credits_selected", "revenus_total_cents"].includes(id))
      .map(([id, value]) => {
        const question = questions.get(id);
        const sectionCode = question?.section ?? "declaration";
        const section = sections.get(sectionCode);
        return {
          id,
          section: sectionCode,
          sectionFr: section?.fr ?? "Autres réponses",
          sectionEn: section?.en ?? "Other answers",
          questionFr: question?.fr ?? id,
          questionEn: question?.en ?? id,
          type: question?.type ?? "TEXT",
          value,
          displayValue: typeof value === "object" ? JSON.stringify(value) : String(value),
          validated: Boolean(validated[id]),
        };
      })
      .filter(answer => answer.section !== "ma_province" || (questions.get(answer.id)?.provinceOnly ?? []).includes(province));
  } catch {
    return [];
  }
}

function readNoticeReference(raw: string | null | undefined): NoticeReference {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { noticeOfAssessment?: NoticeReference };
    return data.noticeOfAssessment ?? null;
  } catch {
    return null;
  }
}

type QuestionnaireDatabaseSummary = {
  sessionId: string;
  questionnaireType: string;
  status: string;
  currentStep: string | null;
  progressPct: number;
  syncedEntries: number;
  pendingEntries: number;
} | null;

async function readQuestionnaireDatabaseSummary(userId: string, taxReturnId?: string): Promise<QuestionnaireDatabaseSummary> {
  if (!taxReturnId) return null;
  try {
    const rows = await db.execute(sql`
      SELECT id::text AS "sessionId", questionnaire_type AS "questionnaireType",
             status, current_step AS "currentStep", COALESCE(progress_pct, 0) AS "progressPct"
      FROM q_sessions
      WHERE user_id = ${userId} AND tax_return_id = ${taxReturnId}
      ORDER BY updated_at DESC
      LIMIT 1
    `) as unknown as Array<Record<string, unknown>>;
    const session = rows[0];
    if (!session) return null;
    const syncRows = await db.execute(sql`
      SELECT status, COUNT(*)::int AS count
      FROM q_entry_sync
      WHERE session_id = ${String(session.sessionId)}
      GROUP BY status
    `) as unknown as Array<{ status: string; count: number }>;
    const syncedEntries = syncRows.find(row => row.status === "synchronise")?.count ?? 0;
    const pendingEntries = syncRows.filter(row => ["en_attente", "erreur"].includes(row.status)).reduce((sum, row) => sum + row.count, 0);
    return {
      sessionId: String(session.sessionId),
      questionnaireType: String(session.questionnaireType ?? "particulier"),
      status: String(session.status ?? "brouillon"),
      currentStep: session.currentStep ? String(session.currentStep) : null,
      progressPct: Number(session.progressPct ?? 0),
      syncedEntries,
      pendingEntries,
    };
  } catch {
    return null;
  }
}

// Mapping catégorie incomeEntries → ligne T1
const CAT_T1: Record<string, string> = {
  employment: "10100", oas: "11300", cpp_benefits: "11400", pension: "11500",
  ei_benefits: "11900", interest: "12100", rental: "12600", capital_gains: "12700",
  rrsp_withdrawal: "12900", scholarships: "13010", self_employment: "13500",
  workers_comp: "14400", social_assistance: "14500", other_income: "13000", dividends_eligible: "12000",
  dividends_ineligible: "12000", gis: "14600",
};
const CAT_TP1: Record<string, string> = {
  employment: "101", pension: "122", cpp_benefits: "119", oas: "114",
  ei_benefits: "111", interest: "130", dividends_eligible: "128",
  dividends_ineligible: "128", workers_comp: "148", other_income: "154",
  self_employment: "164", rental: "136", capital_gains: "139",
};
const CAT_DED_T1: Record<string, string> = {
  rrsp: "20800", union_dues: "21200", childcare: "21400",
  moving_expenses: "21900", employment_expenses: "22900", other_deductions: "23200",
};
const CAT_DED_TP1: Record<string, string> = {
  rrsp: "214", union_dues: "210", childcare: "214", other_deductions: "250",
};
// Seules ces catégories peuvent réduire le revenu net 23600. Les anciennes
// entrées OCR classées « other_deductions » (notamment T4/RL-1 B/C, RPC/RRQ,
// AE/RQAP) restent visibles/auditables mais ne réduisent plus le revenu.
const NET_INCOME_DEDUCTION_CATEGORIES = new Set([
  "rrsp", "union_dues", "childcare", "moving_expenses",
  "employment_expenses", "carrying_charges",
]);
const CAT_CREDIT_T1: Record<string, string> = {
  cpp_employee: "30800", ei_employee: "31200", tuition: "32300", donations: "34900",
  disability: "31600", medical: "33099",
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const [profile] = await db.select().from(taxProfiles).where(eq(taxProfiles.userId, userId)).limit(1);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const [taxReturn] = await db.select({ id: taxReturns.id, taxYearId: taxReturns.taxYearId })
    .from(taxReturns).where(eq(taxReturns.profileId, profile.id))
    .orderBy(desc(taxReturns.updatedAt)).limit(1);
  const [taxYearRow] = taxReturn
    ? await db.select({ year: taxYears.year }).from(taxYears).where(eq(taxYears.id, taxReturn.taxYearId)).limit(1)
    : [undefined];
  const declarationYear = taxYearRow?.year ?? 2025;

  const province = normalizeProvinceCode(profile.fiscalResidence ?? profile.province) ?? "QC";
  const isQC = province === "QC";
  const questionnaireProgress = readQuestionnaireProgress(profile.pancanadianData);
  const questionnaireDatabase = await readQuestionnaireDatabaseSummary(userId, taxReturn?.id);
  const questionnaireAnswers = readQuestionnaireAnswers(profile.pancanadianData, province);
  const noticeOfAssessment = readNoticeReference(profile.pancanadianData);

  // Données DB
  const incomes    = taxReturn ? await db.select().from(incomeEntries).where(and(eq(incomeEntries.userId, userId), eq(incomeEntries.taxReturnId, taxReturn.id))) : [];
  const deductions = taxReturn ? await db.select().from(deductionEntries).where(and(eq(deductionEntries.userId, userId), eq(deductionEntries.taxReturnId, taxReturn.id))) : [];
  const creds      = taxReturn ? await db.select().from(creditEntries).where(and(eq(creditEntries.userId, userId), eq(creditEntries.taxReturnId, taxReturn.id))) : [];
  const [calc]     = taxReturn ? await db.select().from(taxCalculations).where(and(eq(taxCalculations.userId, userId), eq(taxCalculations.taxReturnId, taxReturn.id))).orderBy(desc(taxCalculations.calculatedAt)).limit(1) : [undefined];

  // Construire les montants par ligne
  const t1Amounts: Record<string, { cents: number; source: string }> = {};
  const tp1Amounts: Record<string, { cents: number; source: string }> = {};

  const addT1 = (line: string, c: number, src: string) => {
    if (!line || c === 0) return;
    t1Amounts[line] = { cents: (t1Amounts[line]?.cents ?? 0) + c, source: src };
  };
  const addTp1 = (line: string, c: number, src: string) => {
    if (!line || c === 0 || !isQC) return;
    tp1Amounts[line] = { cents: (tp1Amounts[line]?.cents ?? 0) + c, source: src };
  };

  // Revenus
  for (const inc of incomes) {
    const t1l = CAT_T1[inc.category ?? "other_income"];
    const tp1l = CAT_TP1[inc.category ?? "other_income"];
    if (t1l) addT1(t1l, cents(inc.amountCents), "ocr");
    if (tp1l) addTp1(tp1l, cents(inc.amountCents), "ocr");
  }

  // Déductions
  for (const ded of deductions) {
    // RRQ/RPC, RQAP/AE : crédit de paie, jamais déduction du revenu net.
    if (/(?:cotisations?|contributions?).*(?:rrq|rpc|qpp|cpp|rqap|qpip|ae|assurance[- ]emploi)|(?:rrq|rpc|qpp|cpp)\s*\/\s*(?:rrq|rpc|qpp|cpp)|(?:t4|rl[- ]?1).*(?:case|box|caisse)\s*(?:16|18|b|c)\b|(?:case|box)\s*(?:16|18|b|c)\b.*(?:t4|rl[- ]?1)/i.test(ded.description ?? "")) {
      continue;
    }
    // Retenues fédérales
    // Retenue fédérale — T4 case 22 → ligne 43700
    // Descriptions possibles : "Impôt sur le revenu retenu (T4 case 22)", "Impôt fédéral retenu", "federal income tax withheld", etc.
    if (/impôt sur le revenu retenu|impôt fédéral|federal income tax withheld|income tax deducted/i.test(ded.description ?? "")) {
      addT1("43700", cents(ded.amountCents), "ocr"); continue;
    }
    // Retenue provinciale — RL-1 case E → ligne 451 (Québec)
    if (/impôt du québec|impôt provincial|provincial income tax withheld|provincial tax withheld/i.test(ded.description ?? "")) {
      addTp1("451", cents(ded.amountCents), "ocr"); continue;
    }
    if (!NET_INCOME_DEDUCTION_CATEGORIES.has(ded.category ?? "")) continue;
    const t1l  = CAT_DED_T1[ded.category ?? "other_deductions"];
    const tp1l = CAT_DED_TP1[ded.category ?? "other_deductions"];
    if (t1l) addT1(t1l, cents(ded.amountCents), "ocr");
    if (tp1l) addTp1(tp1l, cents(ded.amountCents), "ocr");
  }

  // Crédits non remboursables
  for (const cr of creds) {
    const description = cr.description ?? "";
    const t1l = /RPC|RRQ|CPP|QPP/i.test(description) ? "30800"
      : /AE|assurance-emploi|EI/i.test(description) ? "31200"
      : CAT_CREDIT_T1[cr.category ?? "other_credits"];
    if (t1l) addT1(t1l, cents(cr.claimedAmountCents), "ocr");
  }

  // Montant personnel de base (automatique)
  addT1("30000", 1612900, "calculated"); // 16 129 $ × 100
  if (isQC) addTp1("350", 1857100, "calculated"); // 18 571 $ × 100

  // Depuis le moteur fiscal (si disponible)
  // ── RÈGLEMENT FÉDÉRAL : chaîne officielle T1 2025 ─────────────────────────
  // Variables settlement hoistées pour être accessibles dans le calcul du solde
  let s43500 = 0, s43700 = 0, s45300 = 0, s48200 = 0, s48400 = 0, s48500 = 0;
  if (calc) {
    // Parser calculationDetails.settlement pour avoir les lignes exactes du moteur
    let settlement: Record<string, number | string> = {};
    try {
      const details = typeof calc.calculationDetails === "string"
        ? JSON.parse(calc.calculationDetails)
        : (calc.calculationDetails as Record<string, unknown> | null);
      if (details?.settlement) settlement = details.settlement as Record<string, number | string>;
    } catch { /* no-op */ }

    // ── Ligne 43500 : impôt fédéral net à payer ──────────────────────────────
    s43500 = (settlement.line43500 as number | undefined) ?? cents(calc.federalTaxPayableCents);

    // ── Ligne 43700 : retenues à la source ───────────────────────────────────
    // Source de vérité : deductions OCR déjà accumulées dans t1Amounts["43700"]
    // Le settlement peut être corrompu (ancien calcul avec regex manquant → line43700=0)
    // Règle : utiliser MAX(settlement, OCR) pour ne jamais sous-estimer les retenues.
    const ocrWithheld43700 = t1Amounts["43700"]?.cents ?? 0;
    const settlementWithheld43700 = (settlement.line43700 as number | undefined) ?? cents(calc.federalTaxWithheldCents);
    s43700 = Math.max(ocrWithheld43700, settlementWithheld43700);
    // Forcer t1Amounts["43700"] à la valeur réelle (évite double-count si addT1 ci-dessous)
    t1Amounts["43700"] = { cents: s43700, source: s43700 === ocrWithheld43700 ? "ocr" : "calculated" };

    // ── Ligne 45300 : ACT / CWB ──────────────────────────────────────────────
    s45300 = (settlement.line45300 as number | undefined) ?? cents(calc.federalRefundableCreditsCents);

    // ── Ligne 48200 : total des crédits et retenues (règlement T1 2025) ──────
    // 48200 = 43700 + 45300 (+ autres crédits remboursables)
    // Si le settlement stocké a line43700=0 mais qu'on a des retenues OCR réelles :
    // le settlement est corrompu (ancien calcul pré-regex-fix) → recalculer.
    // Si settlement.line48200 est 0 ou ne reflète pas les vraies retenues → recalculer.
    const settlementLine43700 = settlement.line43700 as number | undefined;
    const settlementCorrupted = (settlementLine43700 !== undefined && settlementLine43700 === 0 && s43700 > 0)
      || ((settlement.line48200 as number | undefined) === 0 && s43700 > 0);
    s48200 = settlementCorrupted
      ? s43700 + s45300
      : ((settlement.line48200 as number | undefined) || (s43700 + s45300));

    // ── Lignes 48400 / 48500 : remboursement ou solde à payer ────────────────
    s48400 = Math.max(0, s48200 - s43500);
    s48500 = Math.max(0, s43500 - s48200);

    // ── Alimenter le formulaire T1 ───────────────────────────────────────────
    // Certains anciens calculs ne remplissaient pas federalNonRefundableCreditsCents
    // alors que le moteur avait bien calculé le BPA et les autres crédits.
    // La ligne 35000 doit rester cohérente avec la carte de calcul.
    let detailLine35000 = 0;
    try {
      const details = typeof calc.calculationDetails === "string"
        ? JSON.parse(calc.calculationDetails) as { lines?: Record<string, number> }
        : null;
      detailLine35000 = Number(details?.lines?.["35000"] ?? 0);
    } catch { /* ancien calcul sans détails exploitables */ }
    const nonRefundableCredits = cents(calc.federalNonRefundableCreditsCents) || detailLine35000;
    addT1("35000", nonRefundableCredits, "calculated");
    if (s43500 > 0) {
      t1Amounts["42000"] = { cents: s43500, source: "calculated" };
      t1Amounts["43500"] = { cents: s43500, source: "calculated" };
    }
    // 43700 déjà forcé ci-dessus
    if (s45300 > 0) t1Amounts["45300"] = { cents: s45300, source: "calculated" };
    // 48200 = total des crédits — toujours calculé, même si 43700 ou 45300 individuellem. sont 0
    t1Amounts["48200"] = { cents: s48200, source: "calculated" };
    if (s48400 > 0) t1Amounts["48400"] = { cents: s48400, source: "calculated" };
    if (s48500 > 0) t1Amounts["48500"] = { cents: s48500, source: "calculated" };

    if (cents(calc.provincialTaxPayableCents) > 0 && isQC) addTp1("430", cents(calc.provincialTaxPayableCents), "calculated");
  } else {
    // Pas de calcul moteur — alimenter 43700 depuis OCR uniquement
    s43700 = t1Amounts["43700"]?.cents ?? 0;
    s48200 = s43700; // pas de CWB sans moteur
  }

  // Totaux calculés
  const totalRevenu = Object.entries(t1Amounts)
    .filter(([l]) => parseInt(l) >= 10000 && parseInt(l) <= 14999)
    .reduce((s, [, v]) => s + v.cents, 0);
  const totalDed = Object.entries(t1Amounts)
    .filter(([l]) => parseInt(l) >= 20600 && parseInt(l) <= 25999)
    .reduce((s, [, v]) => s + v.cents, 0);
  const revenuNet = Math.max(0, totalRevenu - totalDed);
  const revenuImposable = revenuNet;

  if (totalRevenu > 0)     addT1("15000", totalRevenu, "calculated");
  if (revenuNet > 0)       addT1("23600", revenuNet, "calculated");
  if (revenuImposable > 0) addT1("26000", revenuImposable, "calculated");

  // TP-1 totaux
  if (isQC) {
    const tp1Revenu = Object.entries(tp1Amounts)
      .filter(([l]) => parseInt(l) >= 100 && parseInt(l) <= 199)
      .reduce((s, [, v]) => s + v.cents, 0);
    if (tp1Revenu > 0) addTp1("199", tp1Revenu, "calculated");
    const tp1Ded = Object.entries(tp1Amounts)
      .filter(([l]) => parseInt(l) >= 200 && parseInt(l) <= 299 && parseInt(l) !== 275 && parseInt(l) !== 299)
      .reduce((s, [, v]) => s + v.cents, 0);
    const tp1Net = Math.max(0, tp1Revenu - tp1Ded);
    if (tp1Net > 0)        addTp1("275", tp1Net, "calculated");
    if (tp1Net > 0)        addTp1("299", tp1Net, "calculated");
  }

  // Solde fédéral
  // fedBalance = ligne 43500 (impôt net) - ligne 48200 (retenues + crédits remboursables)
  // Quand le moteur a tourné, utiliser les lignes settlement exactes (s43500, s48200)
  // Sinon fallback sur les colonnes brutes du calc
  const fedTax = calc ? s43500 : 0;
  const fedWithheld = calc ? s43700 : (t1Amounts["43700"]?.cents ?? 0);
  const fedTotalCredits = calc ? s48200 : fedWithheld; // 48200 = 43700 + 45300
  const fedBalance = fedTax - fedTotalCredits;

  // Solde QC
  const provWithheld = calc ? cents(calc.provincialTaxWithheldCents) : (tp1Amounts["451"]?.cents ?? 0);
  const provTax = cents(calc?.provincialTaxPayableCents);
  const provBalance = provTax - provWithheld;

  // Construire les tableaux de lignes complets (toutes les lignes du dictionnaire)
  const buildLines = (
    dict: Record<string, { label_fr: string; label_en?: string; section: string }>,
    amounts: Record<string, { cents: number; source: string }>,
    form: "t1" | "tp1"
  ) => Object.entries(dict).map(([line, info]) => {
    const a = amounts[line];
    const isTotal = ["15000","23600","26000","199","275","299"].includes(line);
    const isSolde = ["48400","48500","474","475"].includes(line);
    return {
      line,
      label_fr: info.label_fr,
      label_en: (info as { label_fr: string; label_en?: string; section: string }).label_en ?? info.label_fr,
      section: info.section,
      amountCents: a?.cents ?? 0,
      isEditable: !isTotal,
      source: (a?.source ?? "empty") as "ocr" | "manual" | "calculated" | "empty",
      bold: isTotal || isSolde,
      isTotal,
    };
  }).sort((a, b) => parseInt(a.line) - parseInt(b.line));

  const _dict = loadDict();
  const t1Lines  = buildLines(_dict.t1_lines, t1Amounts, "t1");
  const tp1Lines = isQC ? buildLines(
    _dict.tp1_lines as Record<string, DictT1Line>,
    tp1Amounts,
    "tp1"
  ) : [];

  // Provinces
  const PROVINCE_INFO: Record<string, { name: string; form: string; authority: string }> = {
    QC: { name: "Québec", form: "TP-1", authority: "Revenu Québec" },
    ON: { name: "Ontario", form: "ON428", authority: "Agence du revenu du Canada" },
    AB: { name: "Alberta", form: "AB428", authority: "Agence du revenu du Canada" },
    BC: { name: "Colombie-Britannique", form: "BC428", authority: "Agence du revenu du Canada" },
    SK: { name: "Saskatchewan", form: "SK428", authority: "Agence du revenu du Canada" },
    MB: { name: "Manitoba", form: "MB428", authority: "Agence du revenu du Canada" },
    NB: { name: "Nouveau-Brunswick", form: "NB428", authority: "Agence du revenu du Canada" },
    NS: { name: "Nouvelle-Écosse", form: "NS428", authority: "Agence du revenu du Canada" },
    PE: { name: "Île-du-Prince-Édouard", form: "PE428", authority: "Agence du revenu du Canada" },
    NL: { name: "Terre-Neuve-et-Labrador", form: "NL428", authority: "Agence du revenu du Canada" },
    NT: { name: "Territoires du Nord-Ouest", form: "NT428", authority: "Agence du revenu du Canada" },
    NU: { name: "Nunavut", form: "NU428", authority: "Agence du revenu du Canada" },
    YT: { name: "Yukon", form: "YT428", authority: "Agence du revenu du Canada" },
  };
  const provinceInfo = PROVINCE_INFO[province] ?? { name: province, form: `${province}428`, authority: "Agence du revenu du Canada" };

  return NextResponse.json({
    meta: {
      taxYear: declarationYear,
      province,
      provinceName: provinceInfo.name,
      form: `T1 + ${provinceInfo.form}`,
      provincialForm: provinceInfo.form,
      provincialAuthority: provinceInfo.authority,
      isQC,
      profileName: `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || "—",
      sinLastFour: profile.sinLastFour,
      address: [profile.address, profile.city, province, profile.postalCode].filter(Boolean).join(", "),
      isPreliminary: true,
      taxReturnId: taxReturn?.id ?? null,
    },
    questionnaireProgress,
    questionnaireDatabase,
    questionnaireAnswers,
    noticeOfAssessment,
    t1: t1Lines,
    tp1: tp1Lines,
    summary: {
      totalRevenuCents: totalRevenu,
      revenuNetCents: revenuNet,
      revenuImposableCents: revenuImposable,
      federal: {
        taxBeforeCredits: cents(calc?.federalTaxBeforeCreditsCents),
        nonRefundableCredits: cents(calc?.federalNonRefundableCreditsCents),
        refundableCredits: cents(calc?.federalRefundableCreditsCents),
        // withheld = ligne 43700 (retenues T4 seulement) — pour l'affichage ligne par ligne
        taxPayable: fedTax, withheld: fedWithheld,
        // totalCredits48200 = ligne 48200 (43700 + 45300 CWB) — utilisé pour le solde
        totalCredits48200: fedTotalCredits,
        balance: fedBalance, isRefund: fedBalance < 0,
      },
      provincial: {
        taxBeforeCredits: cents(calc?.provincialTaxBeforeCreditsCents),
        nonRefundableCredits: cents(calc?.provincialNonRefundableCreditsCents),
        refundableCredits: cents(calc?.provincialRefundableCreditsCents),
        taxPayable: provTax, withheld: provWithheld, balance: provBalance, isRefund: provBalance < 0,
      },
      totalBalance: calc ? cents(calc.totalBalanceCents) : fedBalance + provBalance,
      isRefund: (calc ? cents(calc.totalBalanceCents) : fedBalance + provBalance) < 0,
    },
  });
}
