"use client";

export interface ResultBreakdown {
  taxBeforeCredits: number;
  nonRefundableCredits: number;
  refundableCredits: number;
  taxPayable: number;
  withheld: number;
  balance: number;
  isRefund: boolean;
}

interface ResultsNoticesProps {
  lang: string;
  taxYear: number;
  provinceName: string;
  provincialForm: string;
  provincialAuthority: string;
  totalIncomeCents: number;
  netIncomeCents: number;
  taxableIncomeCents: number;
  federal: ResultBreakdown;
  provincial: ResultBreakdown;
  t1Lines: Array<{ line: string; label_fr: string; label_en: string; amountCents: number }>;
}

function money(cents: number): string {
  return (Math.abs(cents) / 100).toLocaleString("fr-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " $";
}

function NoticeRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        padding: "9px 0",
        borderBottom: "1px solid #e7edf4",
      }}
    >
      <span style={{ fontSize: 13, color: strong ? "#12233d" : "#506078", fontWeight: strong ? 700 : 400 }}>
        {label}
      </span>
      <span
        style={{
          color: "#12233d",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: strong ? 15 : 13,
          fontWeight: strong ? 800 : 600,
          whiteSpace: "nowrap",
        }}
      >
        {money(value)}
      </span>
    </div>
  );
}

function AssessmentSummaryTable({ lines, federal, isEn }: { lines: ResultsNoticesProps["t1Lines"]; federal: ResultBreakdown; isEn: boolean }) {
  const byCode = new Map(lines.map(line => [line.line, line]));
  const value = (code: string) => byCode.get(code)?.amountCents ?? 0;
  const rows = [
    ["15000", isEn ? "Total income" : "Revenu total", value("15000")],
    ["23600", isEn ? "Net income" : "Revenu net", value("23600")],
    ["26000", isEn ? "Taxable income" : "Revenu imposable", value("26000")],
    ["35000", isEn ? "Total non-refundable tax credits" : "Total des crédits d'impôt non remboursables", value("35000")],
    ["42000", isEn ? "Net federal tax" : "Impôt fédéral net", value("42000")],
    ["43500", isEn ? "Total payable" : "Total à payer", value("43500")],
    ["43700", isEn ? "Total income tax deducted" : "Impôt total retenu", value("43700")],
    ["45300", isEn ? "Canada Workers Benefit" : "Allocation canadienne pour les travailleurs", value("45300")],
    ["48200", isEn ? "Total credits" : "Total des crédits", value("48200")],
  ] as const;
  const afterCredits = value("43500") - value("48200");
  const signed = (amount: number) => `${(Math.abs(amount) / 100).toLocaleString(isEn ? "en-CA" : "fr-CA", { minimumFractionDigits: 2 })} $`;
  return <section style={{ border: "1px solid #cbd8e8", borderRadius: 12, overflow: "hidden", marginBottom: 14, background: "#fff" }}>
    <div style={{ background: "#12233d", color: "#fff", padding: "12px 14px", fontWeight: 800, fontSize: 13 }}>{isEn ? "Assessment summary" : "Sommaire de cotisation"}</div>
    <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#f2f6fb", color: "#506078", textAlign: "left" }}><th style={{ padding: "8px 10px" }}>Ligne</th><th style={{ padding: "8px 10px" }}>Description</th><th style={{ padding: "8px 10px", textAlign: "right" }}>{isEn ? "Final amount $" : "Montant final $"}</th><th style={{ padding: "8px 10px", textAlign: "center" }}>CT/DT</th></tr></thead><tbody>
      {rows.map(([code, label, amount]) => <tr key={code} style={{ borderTop: "1px solid #e7edf4" }}><td style={{ padding: "8px 10px", color: "#2764a8", fontWeight: 700 }}>{code}</td><td style={{ padding: "8px 10px", color: "#334155" }}>{label}</td><td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700 }}>{signed(amount)}</td><td style={{ padding: "8px 10px", textAlign: "center" }}>—</td></tr>)}
      <tr style={{ borderTop: "1px solid #e7edf4" }}><td style={{ padding: "8px 10px" }}>—</td><td style={{ padding: "8px 10px", color: "#334155" }}>{isEn ? "Total payable less total credits" : "Total à payer moins Total des crédits"}</td><td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700 }}>{signed(afterCredits)}</td><td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700 }}>{afterCredits < 0 ? "CT" : afterCredits > 0 ? "DT" : "—"}</td></tr>
      <tr style={{ borderTop: "1px solid #e7edf4", background: "#f8fafc" }}><td style={{ padding: "8px 10px" }}>—</td><td style={{ padding: "8px 10px", fontWeight: 800, color: "#12233d" }}>{isEn ? "Assessment balance" : "Solde de cette cotisation"}</td><td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800 }}>{signed(federal.balance)}</td><td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800 }}>{federal.balance < 0 ? "CT" : federal.balance > 0 ? "DT" : "—"}</td></tr>
    </tbody></table></div>
  </section>;
}

function NoticeCard({
  eyebrow,
  title,
  subtitle,
  income,
  netIncome,
  taxableIncome,
  result,
  labels,
  accent,
  isEn,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  income: number;
  netIncome: number;
  taxableIncome: number;
  result: ResultBreakdown;
  labels: {
    totalIncome: string;
    netIncome: string;
    taxableIncome: string;
    taxBeforeCredits: string;
    credits: string;
    taxPayable: string;
    withheld: string;
    refundableCredits: string;
    refund: string;
    owing: string;
  };
  accent: string;
  isEn: boolean;
}) {
  const hasRefund = result.balance < 0;
  const balanceColor = hasRefund ? "#057a55" : result.balance > 0 ? "#b42318" : "#506078";
  const balanceBackground = hasRefund ? "#ecfdf3" : result.balance > 0 ? "#fff4ed" : "#f4f7fa";
  const balanceLabel = hasRefund ? labels.refund : result.balance > 0 ? labels.owing : "—";

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #d8e2ed",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 5px 18px rgba(18,35,61,0.06)",
        marginBottom: 14,
      }}
    >
      <div style={{ background: "#12233d", color: "#fff", padding: "14px 16px" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.08em", fontWeight: 800, color: "#b8cce6", textTransform: "uppercase" }}>
          {eyebrow}
        </div>
        <div style={{ marginTop: 3, fontSize: 18, fontFamily: "Georgia, serif", fontWeight: 700 }}>{title}</div>
        <div style={{ marginTop: 3, color: "#d7e4f4", fontSize: 12 }}>{subtitle}</div>
      </div>

      <div style={{ padding: "4px 16px 16px" }}>
        <div style={{ margin: "12px 0 3px", color: accent, fontWeight: 800, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {isEn ? "Return calculation" : "Calcul de la déclaration"}
        </div>
        <NoticeRow label={labels.totalIncome} value={income} />
        <NoticeRow label={labels.netIncome} value={netIncome} />
        <NoticeRow label={labels.taxableIncome} value={taxableIncome} strong />

        <div style={{ margin: "16px 0 3px", color: accent, fontWeight: 800, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {isEn ? "Estimated assessment" : "Cotisation estimée"}
        </div>
        <NoticeRow label={labels.taxBeforeCredits} value={result.taxBeforeCredits} />
        <NoticeRow label={labels.credits} value={result.nonRefundableCredits} />
        <NoticeRow label={labels.taxPayable} value={result.taxPayable} strong />
        <NoticeRow label={labels.withheld} value={result.withheld} />
        {result.refundableCredits !== 0 && <NoticeRow label={labels.refundableCredits} value={result.refundableCredits} />}

        <div
          style={{
            marginTop: 14,
            background: balanceBackground,
            border: `1px solid ${balanceColor}33`,
            borderLeft: `5px solid ${balanceColor}`,
            borderRadius: 10,
            padding: "12px 13px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <div style={{ color: balanceColor, fontWeight: 800, fontSize: 14 }}>{balanceLabel}</div>
            <div style={{ color: "#667085", fontSize: 10, marginTop: 2 }}>
              {isEn ? "Preliminary result — not filed" : "Résultat préliminaire — non transmis"}
            </div>
          </div>
          <div style={{ color: balanceColor, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 19, fontWeight: 800, whiteSpace: "nowrap" }}>
            {money(result.balance)}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ResultsNotices({
  lang,
  taxYear,
  provinceName,
  provincialForm,
  provincialAuthority,
  totalIncomeCents,
  netIncomeCents,
  taxableIncomeCents,
  federal,
  provincial,
  t1Lines,
}: ResultsNoticesProps) {
  const isEn = lang === "en";
  const federalLabels = isEn
    ? {
        totalIncome: "Total income (line 15000)", netIncome: "Net income (line 23600)", taxableIncome: "Taxable income (line 26000)",
        taxBeforeCredits: "Federal tax before credits", credits: "Non-refundable tax credits", taxPayable: "Net federal tax payable",
        withheld: "Income tax withheld", refundableCredits: "Refundable credits", refund: "Estimated federal refund", owing: "Estimated federal balance owing",
      }
    : {
        totalIncome: "Revenu total (ligne 15000)", netIncome: "Revenu net (ligne 23600)", taxableIncome: "Revenu imposable (ligne 26000)",
        taxBeforeCredits: "Impôt fédéral avant crédits", credits: "Crédits d'impôt non remboursables", taxPayable: "Impôt fédéral net à payer",
        withheld: "Impôt sur le revenu retenu", refundableCredits: "Crédits remboursables", refund: "Remboursement fédéral estimé", owing: "Solde fédéral estimé à payer",
      };
  const provincialLabels = isEn
    ? {
        totalIncome: "Total income used for provincial calculation", netIncome: "Net income", taxableIncome: "Taxable income",
        taxBeforeCredits: "Provincial tax before credits", credits: "Non-refundable tax credits", taxPayable: "Net provincial tax payable",
        withheld: "Provincial tax withheld / instalments", refundableCredits: "Refundable credits", refund: "Estimated provincial refund", owing: "Estimated provincial balance owing",
      }
    : {
        totalIncome: "Revenu total utilisé au calcul provincial", netIncome: "Revenu net", taxableIncome: "Revenu imposable",
        taxBeforeCredits: "Impôt provincial avant crédits", credits: "Crédits d'impôt non remboursables", taxPayable: "Impôt provincial net à payer",
        withheld: "Impôt provincial retenu / acomptes", refundableCredits: "Crédits remboursables", refund: "Remboursement provincial estimé", owing: "Solde provincial estimé à payer",
      };

  return (
    <div>
      <div style={{ margin: "2px 0 12px", color: "#526865", fontSize: 12, lineHeight: 1.55 }}>
        {isEn
          ? `Two preliminary ${taxYear} summaries, calculated from your validated information.`
          : `Deux résumés préliminaires ${taxYear}, calculés à partir de vos informations validées.`}
      </div>
      <AssessmentSummaryTable lines={t1Lines} federal={federal} isEn={isEn} />
      <NoticeCard
        eyebrow={isEn ? "Canada Revenue Agency" : "Agence du revenu du Canada"}
        title={isEn ? "Federal assessment-style result" : "Résultat fédéral — style avis de cotisation"}
        subtitle={`T1 · ${taxYear}`}
        income={totalIncomeCents}
        netIncome={netIncomeCents}
        taxableIncome={taxableIncomeCents}
        result={federal}
        labels={federalLabels}
        accent="#2764a8"
        isEn={isEn}
      />
      <NoticeCard
        eyebrow={provincialAuthority}
        title={isEn ? `${provinceName} provincial result` : `Résultat provincial — ${provinceName}`}
        subtitle={`${provincialForm} · ${taxYear}`}
        income={totalIncomeCents}
        netIncome={netIncomeCents}
        taxableIncome={taxableIncomeCents}
        result={provincial}
        labels={provincialLabels}
        accent="#0b6b67"
        isEn={isEn}
      />
      <div style={{ margin: "4px 2px 15px", color: "#748197", fontSize: 10, lineHeight: 1.55 }}>
        {isEn
          ? "EasyTax provides a preliminary calculation only. This is not an official notice of assessment and no return is filed from this screen."
          : "EasyTax fournit un calcul préliminaire seulement. Ce n’est pas un avis de cotisation officiel et aucune déclaration n’est transmise depuis cet écran."}
      </div>
    </div>
  );
}

interface ProvincialResultNoticeProps {
  lang: string;
  taxYear: number;
  provinceName: string;
  provincialForm: string;
  provincialAuthority: string;
  totalIncomeCents: number;
  netIncomeCents: number;
  taxableIncomeCents: number;
  provincial: ResultBreakdown;
}

/** Résultat provincial seul : affiché dans l’onglet de la province fiscale du profil. */
export function ProvincialResultNotice({
  lang,
  taxYear,
  provinceName,
  provincialForm,
  provincialAuthority,
  totalIncomeCents,
  netIncomeCents,
  taxableIncomeCents,
  provincial,
}: ProvincialResultNoticeProps) {
  const isEn = lang === "en";
  const labels = isEn
    ? {
        totalIncome: "Total income used for provincial calculation", netIncome: "Net income", taxableIncome: "Taxable income",
        taxBeforeCredits: "Provincial tax before credits", credits: "Non-refundable tax credits", taxPayable: "Net provincial tax payable",
        withheld: "Provincial tax withheld / instalments", refundableCredits: "Refundable credits", refund: "Estimated provincial refund", owing: "Estimated provincial balance owing",
      }
    : {
        totalIncome: "Revenu total utilisé au calcul provincial", netIncome: "Revenu net", taxableIncome: "Revenu imposable",
        taxBeforeCredits: "Impôt provincial avant crédits", credits: "Crédits d'impôt non remboursables", taxPayable: "Impôt provincial net à payer",
        withheld: "Impôt provincial retenu / acomptes", refundableCredits: "Crédits remboursables", refund: "Remboursement provincial estimé", owing: "Solde provincial estimé à payer",
      };

  return (
    <div>
      <div style={{ margin: "2px 0 12px", color: "#526865", fontSize: 12, lineHeight: 1.55 }}>
        {isEn
          ? `Provincial calculation for ${provinceName}, using the ${provincialForm} form.`
          : `Calcul provincial pour ${provinceName}, à partir du formulaire ${provincialForm}.`}
      </div>
      <NoticeCard
        eyebrow={provincialAuthority}
        title={isEn ? `${provinceName} provincial result` : `Résultat provincial — ${provinceName}`}
        subtitle={`${provincialForm} · ${taxYear}`}
        income={totalIncomeCents}
        netIncome={netIncomeCents}
        taxableIncome={taxableIncomeCents}
        result={provincial}
        labels={labels}
        accent="#0b6b67"
        isEn={isEn}
      />
      <div style={{ margin: "4px 2px 15px", color: "#748197", fontSize: 10, lineHeight: 1.55 }}>
        {isEn
          ? "This provincial calculation is preliminary and does not submit a return."
          : "Ce calcul provincial est préliminaire et ne transmet aucune déclaration."}
      </div>
    </div>
  );
}
