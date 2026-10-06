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
