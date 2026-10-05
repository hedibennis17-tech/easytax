"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NavClient } from "@/components/NavClient";
import { useApp } from "@/components/ThemeProvider";

// ─── Types ───────────────────────────────────────────────────
interface T1Line {
  line: string; labelFr: string; labelEn: string; section: string;
  amountCents: number; amount: string; hasValue: boolean; bold?: boolean;
}
interface TP1Line {
  line: string; labelFr: string; section: string;
  amountCents: number; amount: string; hasValue: boolean;
}
interface DeclarationData {
  meta: {
    taxYear: number; province: string; provinceName: string;
    form: string; agency: string; isQC: boolean;
    profileName: string; sinLastFour: string | null;
    maritalStatus: string; address: string; isPreliminary: boolean; hasCalculation: boolean;
  };
  t1Lines: T1Line[];
  tp1Lines: TP1Line[];
  summary: {
    totalRevenu: string; totalDeductions: string; revenuNet: string; revenuImposable: string;
    federal: { taxPayable: string; withheld: string; balance: string; balanceCents: number; isRefund: boolean };
    provincial: { taxPayable: string; withheld: string; balance: string; balanceCents: number; isRefund: boolean };
    totalBalance: string; totalBalanceCents: number; isRefund: boolean;
  };
}

// ─── Composants ──────────────────────────────────────────────
function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "22px 0 10px", paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontFamily: "Georgia,serif", fontSize: 15, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
    </div>
  );
}

function LineRow({ line, label, amount, hasValue, bold, lang }: {
  line: string; label: string; amount: string; hasValue: boolean; bold?: boolean; lang: string;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(amount.replace(" $", "").replace(",", ""));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border)", opacity: hasValue ? 1 : 0.5 }}>
      <span style={{ fontSize: 10, color: "#9fd4cc", fontWeight: 700, minWidth: 44, fontFamily: "monospace" }}>{line}</span>
      <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", fontWeight: bold ? 700 : 400 }}>{label}</span>
      {editing ? (
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input autoFocus value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setEditing(false); }}
            style={{ width: 90, padding: "4px 7px", borderRadius: 6, border: "1px solid #0b6b67", fontFamily: "monospace", fontSize: 12, textAlign: "right" }} />
          <button onClick={() => setEditing(false)} style={{ border: 0, background: "#0b6b67", color: "#fff", borderRadius: 5, padding: "3px 7px", cursor: "pointer", fontSize: 11 }}>✓</button>
        </div>
      ) : (
        <span onClick={() => setEditing(true)}
          style={{ fontFamily: "monospace", fontSize: 13, fontWeight: bold ? 700 : 600, color: bold ? "#0b6b67" : "var(--text-primary)", cursor: "pointer", minWidth: 90, textAlign: "right", borderBottom: hasValue ? "1px dashed #9fd4cc" : "1px dashed #dde8e5" }}>
          {hasValue ? amount : "—"}
        </span>
      )}
    </div>
  );
}

function BalanceCard({ label, balanceCents, isRefund, secondary }: { label: string; balanceCents: number; isRefund: boolean; secondary?: boolean }) {
  const color = isRefund ? "#059669" : balanceCents === 0 ? "#526865" : "#dc2626";
  const bg = isRefund ? "rgba(5,150,105,0.07)" : balanceCents === 0 ? "rgba(82,104,101,0.07)" : "rgba(220,38,38,0.07)";
  const abs = Math.abs(balanceCents) / 100;
  return (
    <div style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 12, padding: secondary ? "10px 14px" : "14px 16px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: secondary ? 12 : 13, color: "var(--text-secondary)" }}>{label}</span>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: secondary ? 15 : 20, fontFamily: "monospace", color }}>
            {isRefund ? "▲ " : balanceCents > 0 ? "▼ " : ""}{abs.toLocaleString("fr-CA", { minimumFractionDigits: 2 })} $
          </div>
          <div style={{ fontSize: 10, color, marginTop: 1 }}>
            {isRefund ? "Remboursement" : balanceCents > 0 ? "Solde dû" : "Équilibre"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE ────────────────────────────────────────────────────
export default function DeclarationPage() {
  const router = useRouter();
  const { lang } = useApp();
  const T = (fr: string, en: string) => lang === "en" ? en : fr;

  const [data, setData] = useState<DeclarationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"t1" | "tp1" | "resume">("resume");
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    fetch("/api/declaration")
      .then(r => r.ok ? r.json() : null)
      .then((d: DeclarationData | null) => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  const recalculate = async () => {
    setCalculating(true);
    const trRes = await fetch("/api/tax-returns").then(r => r.ok ? r.json() : null) as { id?: string }[] | null;
    const taxReturnId = Array.isArray(trRes) ? trRes[0]?.id : null;
    if (taxReturnId) {
      await fetch("/api/tax-engine/calculate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxReturnId }),
      });
      const d = await fetch("/api/declaration").then(r => r.ok ? r.json() : null) as DeclarationData | null;
      if (d) setData(d);
    }
    setCalculating(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <NavClient />
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div style={{ width: 36, height: 36, border: "4px solid #dde8e5", borderTopColor: "#0b6b67", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <NavClient />
      <div style={{ maxWidth: 580, margin: "40px auto", padding: "0 16px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>{T("Aucune donnée disponible. Complétez d'abord le questionnaire.", "No data available. Please complete the questionnaire first.")}</p>
        <button onClick={() => router.push("/questionnaire")} style={{ padding: "10px 20px", background: "#0b6b67", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 700 }}>
          {T("← Retour au questionnaire", "← Back to questionnaire")}
        </button>
      </div>
    </div>
  );

  const { meta, t1Lines, tp1Lines, summary } = data;

  // Grouper par section
  const t1Sections: Record<string, T1Line[]> = {};
  for (const line of t1Lines) {
    if (!t1Sections[line.section]) t1Sections[line.section] = [];
    t1Sections[line.section].push(line);
  }

  const SECTION_META: Record<string, { icon: string; fr: string; en: string }> = {
    revenus:    { icon: "💰", fr: "Revenus", en: "Income" },
    deductions: { icon: "📉", fr: "Déductions", en: "Deductions" },
    credits:    { icon: "🎁", fr: "Crédits non remboursables", en: "Non-refundable credits" },
    total:      { icon: "📊", fr: "Totaux", en: "Totals" },
    withheld:   { icon: "🏦", fr: "Impôt retenu & acomptes", en: "Tax withheld & instalments" },
    other:      { icon: "📌", fr: "Autres", en: "Other" },
  };

  const TABS = [
    { id: "resume" as const, label: T("Résumé", "Summary"), icon: "📊" },
    { id: "t1" as const, label: "T1 — Fédéral", icon: "🇨🇦" },
    ...(meta.isQC ? [{ id: "tp1" as const, label: "TP-1 — Québec", icon: "⚜️" }] : []),
  ];

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <NavClient />

      <main style={{ maxWidth: 780, margin: "0 auto", padding: "16px 16px 80px" }}>

        {/* ── En-tête ──────────────────────────────────────── */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: "clamp(1.3rem,3vw,1.8rem)", color: "var(--text-primary)", margin: "0 0 4px" }}>
                📋 {T("Déclaration de revenus", "Income Tax Return")} {meta.taxYear}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {meta.profileName}
                {meta.sinLastFour && <span style={{ color: "#9fd4cc", marginLeft: 8 }}>NAS •••• {meta.sinLastFour}</span>}
                {" · "}{meta.provinceName}{" · "}{meta.form}
              </div>
              {meta.address && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{meta.address}</div>}
            </div>
            <button onClick={recalculate} disabled={calculating}
              style={{ padding: "8px 14px", background: calculating ? "var(--border)" : "#0b6b67", color: calculating ? "var(--text-muted)" : "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
              {calculating ? "⏳ " : "🔢 "}{T("Recalculer", "Recalculate")}
            </button>
          </div>

          {/* Bandeau PRÉLIMINAIRE */}
          <div style={{ marginTop: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "7px 12px", fontSize: 11, color: "#92400e" }}>
            ⚠️ {T("Résultats PRÉLIMINAIRES — à titre indicatif seulement. Aucune déclaration n'a été transmise à l'ARC",
                   "PRELIMINARY results — for information only. No return has been filed with the CRA")}
            {meta.isQC && T(" ou à Revenu Québec", " or Revenu Québec")}.
          </div>
        </div>

        {/* ── Onglets ───────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", scrollbarWidth: "none" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: tab === t.id ? 700 : 400, cursor: "pointer",
                background: tab === t.id ? "#0b6b67" : "var(--bg-card)",
                color: tab === t.id ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${tab === t.id ? "#0b6b67" : "var(--border)"}`,
                whiteSpace: "nowrap" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── RÉSUMÉ ──────────────────────────────────────────── */}
        {tab === "resume" && (
          <div>
            {/* Soldes */}
            <BalanceBadge label={T("Fédéral (T1)", "Federal (T1)")} balanceCents={summary.federal.balanceCents} isRefund={summary.federal.isRefund} secondary />
            {meta.isQC && <BalanceBadge label="Québec (TP-1)" balanceCents={summary.provincial.balanceCents} isRefund={summary.provincial.isRefund} secondary />}
            <BalanceBadge label={T("TOTAL", "TOTAL")} balanceCents={summary.totalBalanceCents} isRefund={summary.isRefund} />

            {/* Résumé financier */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9fd4cc", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                {T("Résumé financier", "Financial summary")}
              </div>
              {[
                { label: T("Revenu total (ligne 15000)", "Total income (line 15000)"), value: summary.totalRevenu, bold: false },
                { label: T("Déductions totales", "Total deductions"), value: summary.totalDeductions, bold: false },
                { label: T("Revenu net (ligne 23600)", "Net income (line 23600)"), value: summary.revenuNet, bold: true },
                { label: T("Revenu imposable (ligne 26000)", "Taxable income (line 26000)"), value: summary.revenuImposable, bold: true },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
                  <span style={{ fontFamily: "monospace", fontWeight: row.bold ? 700 : 600, fontSize: row.bold ? 15 : 13, color: row.bold ? "#0b6b67" : "var(--text-primary)" }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Détail fédéral */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9fd4cc", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                {T("Impôt fédéral (T1)", "Federal tax (T1)")}
              </div>
              {[
                { label: T("Impôt à payer", "Tax payable"), value: summary.federal.taxPayable },
                { label: T("Impôt retenu (ligne 43700)", "Tax withheld (line 43700)"), value: `− ${summary.federal.withheld}` },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{row.label}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}
              <BalanceBadge label={T("Solde fédéral", "Federal balance")} balanceCents={summary.federal.balanceCents} isRefund={summary.federal.isRefund} secondary />
            </div>

            {/* Détail QC */}
            {meta.isQC && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9fd4cc", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                  ⚜️ {T("Impôt du Québec (TP-1)", "Quebec tax (TP-1)")}
                </div>
                {[
                  { label: T("Impôt à payer", "Tax payable"), value: summary.provincial.taxPayable },
                  { label: T("Impôt retenu (ligne 451)", "Tax withheld (line 451)"), value: `− ${summary.provincial.withheld}` },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{row.label}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600 }}>{row.value}</span>
                  </div>
                ))}
                <BalanceBadge label={T("Solde Québec", "Quebec balance")} balanceCents={summary.provincial.balanceCents} isRefund={summary.provincial.isRefund} secondary />
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
              <button onClick={() => setTab("t1")} style={{ padding: "12px 0", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--text-secondary)" }}>
                🇨🇦 {T("Voir le détail T1 — ligne par ligne", "View T1 detail — line by line")}
              </button>
              {meta.isQC && (
                <button onClick={() => setTab("tp1")} style={{ padding: "12px 0", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--text-secondary)" }}>
                  ⚜️ {T("Voir le détail TP-1 Québec", "View TP-1 Quebec detail")}
                </button>
              )}
              <button onClick={() => router.push("/questionnaire")} style={{ padding: "12px 0", background: "transparent", border: "1px dashed var(--border)", borderRadius: 12, fontWeight: 500, fontSize: 13, cursor: "pointer", color: "var(--text-muted)" }}>
                ✏️ {T("Modifier mes réponses", "Edit my answers")}
              </button>
            </div>

            {/* Disclaimer */}
            <div style={{ marginTop: 16, fontSize: 11, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
              {T("EasyTax produit des résultats préliminaires à titre indicatif. La transmission officielle se fait uniquement via un logiciel homologué NETFILE (ARC) ou ImpôtNet (Revenu Québec).",
                 "EasyTax produces preliminary results for information only. Official filing is done exclusively through NETFILE-certified software (CRA) or ImpôtNet (Revenu Québec).")}
            </div>
          </div>
        )}

        {/* ── T1 — FÉDÉRAL ──────────────────────────────────── */}
        {tab === "t1" && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                🇨🇦 T1 — {T("Déclaration fédérale 2025", "Federal return 2025")}
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{meta.agency} · {meta.form}</span>
            </div>

            {Object.entries(t1Sections).map(([section, lines]) => (
              <div key={section}>
                <SectionHeader
                  icon={SECTION_META[section]?.icon ?? "📌"}
                  title={lang === "en" ? (SECTION_META[section]?.en ?? section) : (SECTION_META[section]?.fr ?? section)}
                />
                {lines.map(line => (
                  <LineRow key={line.line} line={line.line}
                    label={lang === "en" ? line.labelEn : line.labelFr}
                    amount={line.amount} hasValue={line.hasValue} bold={line.bold} lang={lang} />
                ))}
              </div>
            ))}

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "2px solid var(--border)" }}>
              <BalanceBadge label={T("Solde fédéral estimé", "Estimated federal balance")} balanceCents={summary.federal.balanceCents} isRefund={summary.federal.isRefund} />
            </div>
          </div>
        )}

        {/* ── TP-1 — QUÉBEC ─────────────────────────────────── */}
        {tab === "tp1" && meta.isQC && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                ⚜️ TP-1 — {T("Déclaration du Québec 2025", "Quebec return 2025")}
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Revenu Québec</span>
            </div>

            {tp1Lines.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: "20px 0" }}>
                {T("Aucune donnée TP-1. Complétez votre questionnaire.", "No TP-1 data. Please complete your questionnaire.")}
              </p>
            ) : (
              <>
                {tp1Lines.map(line => (
                  <LineRow key={line.line} line={line.line}
                    label={line.labelFr} amount={line.amount}
                    hasValue={line.hasValue} lang={lang} />
                ))}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "2px solid var(--border)" }}>
                  <BalanceBadge label="Solde Québec estimé" balanceCents={summary.provincial.balanceCents} isRefund={summary.provincial.isRefund} />
                </div>
              </>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

// ── BalanceBadge ─────────────────────────────────────────────
function BalanceBadge({ label, balanceCents, isRefund, secondary }: { label: string; balanceCents: number; isRefund: boolean; secondary?: boolean }) {
  const color = isRefund ? "#059669" : balanceCents === 0 ? "#526865" : "#dc2626";
  const bg    = isRefund ? "rgba(5,150,105,0.08)" : balanceCents === 0 ? "rgba(82,104,101,0.08)" : "rgba(220,38,38,0.08)";
  const abs   = Math.abs(balanceCents) / 100;
  return (
    <div style={{ background: bg, border: `1px solid ${color}40`, borderRadius: 10, padding: secondary ? "9px 12px" : "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 700, fontSize: secondary ? 14 : 18, fontFamily: "monospace", color }}>
          {isRefund ? "▲ " : balanceCents > 0 ? "▼ " : ""}{abs.toLocaleString("fr-CA", { minimumFractionDigits: 2 })} $
        </div>
        <div style={{ fontSize: 10, color }}>
          {isRefund ? "Remboursement / Refund" : balanceCents > 0 ? "Solde dû / Balance owing" : "—"}
        </div>
      </div>
    </div>
  );
}
