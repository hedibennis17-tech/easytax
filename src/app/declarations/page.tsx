"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { NavClient } from "@/components/NavClient";
import { useApp } from "@/components/ThemeProvider";
import { OcrUpload } from "./OcrUpload";

// ─── Types ────────────────────────────────────────────────
interface SlipField { code: string; label: string | null; value: string | null; validated: boolean; confidence: number | null }
interface SlipData { documentId: string; filename: string; typeCode: string | null; typeName: string | null; fields: SlipField[] }
interface Calculation {
  calculatedAt: string; isPreliminary: boolean;
  federal: { taxBeforeCredits: string; credits: string; taxPayable: string; withheld: string; balance: string; balanceCents: number; isRefund: boolean }
  provincial: { taxBeforeCredits: string; credits: string; taxPayable: string; withheld: string; balance: string; balanceCents: number; isRefund: boolean }
  totalBalance: string; totalBalanceCents: number; isRefund: boolean;
}
interface ResumeData {
  meta: { taxYear: number; province: string; provinceNameFr: string; provinceNameEn: string; declarationForm: string; profileName: string; taxReturnId: string | null }
  slips: SlipData[];
  calculation: Calculation | null;
}
interface ProvinceInfo {
  code: string; nameFr: string; nameEn: string; form: string; bpaCents: number | null;
  brackets: Array<{ minCents: number; maxCents: number | null; rateBasisPoints: number }>;
  hasSurtax: boolean; creditRateBP: number | null;
}

// Reports de lignes — même référentiel que le prototype pancanadien
const T4A_LINES: Record<string, string> = {
  box_016: "11500", box_018: "13000", box_020: "13000", box_022: "43700", box_024: "13000", box_048: "13500",
};
const T4A_BOX_LABELS: Record<string, string> = {
  box_016: "016 · Pension/rente", box_018: "018 · Forfaitaire", box_020: "020 · Commissions",
  box_022: "022 · Impôt retenu", box_024: "024 · Rentes", box_048: "048 · Honoraires",
};
const T4_LINES: Record<string, string> = {
  box_14: "10100", box_22: "43700", box_26: "30800", box_44: "21200",
};
const T4_BOX_LABELS: Record<string, string> = {
  box_14: "14 · Revenus", box_22: "22 · Impôt retenu", box_26: "26 · RPC/RRQ", box_44: "44 · Syndicat",
};

const fmtMoney = (cents: number | null | undefined): string => {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
};
const parseVal = (v: string | null): number | null => {
  if (!v) return null;
  const n = parseFloat(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

export default function DeclarationPage() {
  const router = useRouter();
  const { lang } = useApp();
  const T = (fr: string, en: string) => (lang === "en" ? en : fr);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<ResumeData | null>(null);
  const [provinces, setProvinces] = useState<ProvinceInfo[]>([]);
  const [savingProvince, setSavingProvince] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/resume"),
        fetch("/api/tax-engine/provinces?taxYear=2025"),
      ]);
      if (!r1.ok) { setError(T("Erreur de chargement", "Loading error")); return; }
      setData(await r1.json());
      if (r2.ok) setProvinces((await r2.json()).provinces ?? []);
    } catch { setError(T("Erreur réseau", "Network error")); }
    finally { setLoading(false); }
  }, [lang]);

  useEffect(() => { load(); }, [load]);

  const changeProvince = async (code: string) => {
    if (!code || code === data?.meta.province) return;
    setSavingProvince(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscalResidence: code }),
      });
      if (!res.ok) { setError(T("Province non enregistrée", "Province not saved")); return; }
      await load();
      if (data?.meta.taxReturnId) {
        setCalculating(true);
        await fetch("/api/tax-engine/calculate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taxReturnId: data.meta.taxReturnId }),
        });
        setCalculating(false);
        await load();
      }
    } finally { setSavingProvince(false); }
  };

  const runCalculation = async () => {
    if (!data?.meta.taxReturnId) return;
    setCalculating(true);
    await fetch("/api/tax-engine/calculate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taxReturnId: data.meta.taxReturnId }),
    });
    await load();
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

  if (error || !data) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <NavClient />
      <div style={{ maxWidth: 580, margin: "40px auto", padding: "0 20px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <p style={{ color: "#dc2626", fontSize: 15 }}>{error || T("Données introuvables", "Data not found")}</p>
        <button onClick={() => router.push("/dossier")} style={{ marginTop: 16, padding: "10px 20px", background: "#0b6b67", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 700 }}>
          {T("← Mon dossier", "← My file")}
        </button>
      </div>
    </div>
  );

  const { meta, slips, calculation } = data;
  const isQC = meta.province === "QC";
  const activeProvince = provinces.find((p) => p.code === meta.province);
  const t4aSlips = slips.filter((s) => s.typeCode === "T4A");
  const t5007Slips = slips.filter((s) => s.typeCode === "T5007");
  const t4Slips = slips.filter((s) => s.typeCode === "T4");
  const rl5Slips = slips.filter((s) => s.typeCode === "RL-5");
  const rl1Slips = slips.filter((s) => s.typeCode === "RL-1");
  const genericSlips = slips.filter((s) => !["T4A", "T5007", "T4", "RL-5", "RL-1"].includes(s.typeCode ?? ""));
  // Hors Québec, les relevés s'affichent en tableau générique dans la section B
  const otherSlips = isQC ? genericSlips : [...genericSlips, ...rl5Slips, ...rl1Slips];

  const card: React.CSSProperties = { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", marginBottom: 18 };
  const h2: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: "1.25rem", margin: "0 0 4px", color: "var(--text-primary)" };
  const sub: React.CSSProperties = { color: "var(--text-secondary)", fontSize: 13, margin: "0 0 14px" };
  const th: React.CSSProperties = { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-secondary)", padding: "8px 10px", borderBottom: "2px solid var(--border)" };
  const td: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid var(--border)", fontSize: 14 };
  const fieldVal = (s: SlipData, code: string) => s.fields.find((f) => f.code === code)?.value ?? null;

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <NavClient />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 80px" }}>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: "Georgia,serif", fontSize: "clamp(1.6rem,4vw,2.2rem)", margin: "0 0 4px", color: "var(--text-primary)" }}>
            {T("Déclaration pancanadienne", "Pan-Canadian return")} {meta.taxYear}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>
            {meta.profileName} · {T("données OCR alimentées automatiquement", "OCR data fed automatically")}
          </p>
          <div style={{ marginTop: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#92400e", display: "flex", gap: 8 }}>
            <span>⚠️</span>
            <span>{T("Résultats PRÉLIMINAIRES — à titre indicatif seulement. Aucune déclaration n'a été transmise à l'ARC", "PRELIMINARY results — for information only. No return has been filed with the CRA")}{isQC && T(" ou à Revenu Québec", " or Revenu Québec")}.</span>
          </div>
        </div>

        {/* ═══ STEPPER WORKFLOW ═══ */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {[
            { n: 1, label: T("Province", "Province"), done: true },
            { n: 2, label: T("Feuillets (OCR)", "Slips (OCR)"), done: slips.length > 0 },
            { n: 3, label: T("Questionnaire", "Questionnaire"), done: false, href: "/questionnaire" },
            { n: 4, label: T("Calcul", "Calculation"), done: !!calculation },
          ].map((s) => (
            <div key={s.n} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 20,
              background: s.done ? "#0b6b67" : "var(--bg-card)", color: s.done ? "#fff" : "var(--text-secondary)",
              border: "1px solid var(--border)", fontSize: 13, fontWeight: 700,
              cursor: s.href ? "pointer" : "default",
            }} onClick={s.href ? () => router.push(s.href!) : undefined}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: s.done ? "#fff" : "var(--border)", color: s.done ? "#0b6b67" : "var(--text-secondary)", fontSize: 12,
              }}>{s.done ? "✓" : s.n}</span>
              {s.label}
            </div>
          ))}
        </div>

        {/* ═══ OCR EN HAUT ═══ */}
        <OcrUpload taxReturnId={meta.taxReturnId} taxYear={meta.taxYear} onValidated={load} />

        {/* ═══ A. PROVINCE D'ABORD ═══ */}
        <section style={card}>
          <h2 style={h2}>📍 {T("A. Province / territoire de résidence au 31 déc.", "A. Province / territory of residence on Dec. 31")} {meta.taxYear} <span style={{ fontSize: 12, color: "#0b6b67" }}>{T("— à choisir en premier", "— choose first")}</span></h2>
          <p style={sub}>{T("Le volet provincial (section C) et le calcul provincial s'adaptent automatiquement. Le fédéral (T1) est identique partout au Canada.", "The provincial section (C) and provincial calculation adapt automatically. Federal (T1) is the same across Canada.")}</p>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={meta.province}
              disabled={savingProvince}
              onChange={(e) => changeProvince(e.target.value)}
              style={{ padding: "12px 14px", fontSize: 16, fontWeight: 700, borderRadius: 10, border: "2px solid #0b6b67", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer", minWidth: 280 }}
            >
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>{p.nameFr} ({p.form})</option>
              ))}
            </select>
            {savingProvince && <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>⏳ {T("Enregistrement…", "Saving…")}</span>}
            {activeProvince && (
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {T("Formulaire provincial", "Provincial form")}: <strong style={{ color: "#0b6b67" }}>{activeProvince.form}</strong>
                {activeProvince.bpaCents != null && <> · {T("base", "BPA")}: <strong>{fmtMoney(activeProvince.bpaCents)}</strong></>}
              </span>
            )}
          </div>
        </section>

        {/* ═══ B. FEUILLETS FÉDÉRAUX (OCR) ═══ */}
        <section style={card}>
          <h2 style={h2}>🧾 {T("B. Feuillets et revenus — Fédéral", "B. Slips and income — Federal")} <span style={{ fontSize: 11, background: "#0b6b67", color: "#fff", borderRadius: 6, padding: "2px 8px", verticalAlign: "middle" }}>T1</span></h2>
          <p style={sub}>{T("Extraits automatiquement de tes feuillets téléversés. Les reports vers les lignes de la T1 sont indiqués.", "Automatically extracted from your uploaded slips. Line mappings to the T1 are shown.")}</p>

          {t4aSlips.length === 0 && t5007Slips.length === 0 && t4Slips.length === 0 && otherSlips.length === 0 && (
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              {T("Aucun feuillet validé pour l'instant.", "No validated slips yet.")}{" "}
              <button onClick={() => router.push("/dossier")} style={{ background: "none", border: "none", color: "#0b6b67", fontWeight: 700, cursor: "pointer", fontSize: 14, padding: 0 }}>
                {T("→ Téléverser des feuillets", "→ Upload slips")}
              </button>
            </p>
          )}

          {t4aSlips.map((s) => (
            <div key={s.documentId} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, margin: "0 0 8px", color: "var(--text-primary)" }}>T4A — {s.filename}</h3>
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  {Object.keys(T4A_BOX_LABELS).map((code) => <th key={code} style={th}>{T4A_BOX_LABELS[code]}<br /><span style={{ fontWeight: 400 }}>→ {T4A_LINES[code]}</span></th>)}
                </tr></thead>
                <tbody><tr>
                  {Object.keys(T4A_BOX_LABELS).map((code) => {
                    const v = fieldVal(s, code);
                    return <td key={code} style={{ ...td, fontWeight: 700 }}>{v ? fmtMoney(parseVal(v)) : <span style={{ color: "#b0b0b0" }}>—</span>}</td>;
                  })}
                </tr></tbody>
              </table>
              </div>
            </div>
          ))}

          {t5007Slips.map((s) => (
            <div key={s.documentId} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, margin: "0 0 8px", color: "var(--text-primary)" }}>T5007 — {s.filename} <span style={{ fontWeight: 400, color: "var(--text-secondary)", fontSize: 12 }}>→ {T("lignes", "lines")} 14400 + 25000</span></h3>
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>{T("Case 10 · Indemnités", "Box 10 · Benefits")}</th><th style={th}>{T("Inclusion (14400)", "Inclusion (14400)")}</th><th style={th}>{T("Déduction (25000)", "Deduction (25000)")}</th></tr></thead>
                <tbody><tr>
                  <td style={{ ...td, fontWeight: 700 }}>{fieldVal(s, "box_10") ? fmtMoney(parseVal(fieldVal(s, "box_10"))) : "—"}</td>
                  <td style={td}>{fieldVal(s, "box_10") ? fmtMoney(parseVal(fieldVal(s, "box_10"))) : "—"}</td>
                  <td style={td}>{fieldVal(s, "box_10") ? fmtMoney(parseVal(fieldVal(s, "box_10"))) : "—"}</td>
                </tr></tbody>
              </table>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 0" }}>{T("Inclus au revenu puis déduit intégralement — aucun impôt sur ces indemnités.", "Included in income then fully deducted — no tax on these benefits.")}</p>
            </div>
          ))}

          {t4Slips.map((s) => (
            <div key={s.documentId} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, margin: "0 0 8px", color: "var(--text-primary)" }}>T4 — {s.filename}</h3>
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  {Object.keys(T4_BOX_LABELS).map((code) => <th key={code} style={th}>{T4_BOX_LABELS[code]}<br /><span style={{ fontWeight: 400 }}>→ {T4_LINES[code]}</span></th>)}
                </tr></thead>
                <tbody><tr>
                  {Object.keys(T4_BOX_LABELS).map((code) => {
                    const v = fieldVal(s, code);
                    return <td key={code} style={{ ...td, fontWeight: 700 }}>{v ? fmtMoney(parseVal(v)) : <span style={{ color: "#b0b0b0" }}>—</span>}</td>;
                  })}
                </tr></tbody>
              </table>
              </div>
            </div>
          ))}

          {otherSlips.map((s) => (
            <div key={s.documentId} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, margin: "0 0 8px", color: "var(--text-primary)" }}>
                {s.typeCode ?? T("Feuillet", "Slip")} — {s.filename}
                <span style={{ fontWeight: 400, color: "var(--text-secondary)", fontSize: 12 }}> · {s.typeName ?? ""}</span>
              </h3>
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={th}>{T("Case", "Box")}</th>
                  <th style={th}>{T("Montant", "Amount")}</th>
                </tr></thead>
                <tbody>
                  {s.fields.filter((f) => f.value).map((f) => (
                    <tr key={f.code}>
                      <td style={td}>{f.label ?? f.code}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{fmtMoney(parseVal(f.value))}</td>
                    </tr>
                  ))}
                  {s.fields.filter((f) => f.value).length === 0 && (
                    <tr><td style={td} colSpan={2}>{T("Aucune valeur extraite.", "No extracted values.")}</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          ))}
        </section>

        {/* ═══ C. VOLET PROVINCIAL ═══ */}
        <section style={card}>
          {isQC ? (
            <>
              <h2 style={h2}>⚜️ {T("C. Relevés — Québec", "C. Slips — Quebec")} <span style={{ fontSize: 11, background: "#0b6b67", color: "#fff", borderRadius: 6, padding: "2px 8px", verticalAlign: "middle" }}>TP-1</span></h2>
              <p style={sub}>{T("Pendant des feuillets fédéraux pour la déclaration du Québec.", "Quebec counterpart of the federal slips.")}</p>
              {rl5Slips.length === 0 && rl1Slips.length === 0 && (
                <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{T("Aucun relevé Québec validé pour l'instant.", "No validated Quebec slips yet.")}</p>
              )}
              {rl5Slips.map((s) => (
                <div key={s.documentId} style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, margin: "0 0 8px", color: "var(--text-primary)" }}>Relevé 5 — {s.filename} <span style={{ fontWeight: 400, color: "var(--text-secondary)", fontSize: 12 }}>C → {T("lignes", "lines")} 148 + 295</span></h3>
                  <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      <th style={th}>C<br />{T("Indemnités", "Benefits")}</th><th style={th}>E<br />{T("Civisme", "Civic")}</th>
                      <th style={th}>M<br />{T("Redressement", "Adjustment")}</th><th style={th}>O<br />{T("Années pass.", "Prior yrs")}</th><th style={th}>P<br />{T("Rembours.", "Repay.")}</th>
                    </tr></thead>
                    <tbody><tr>
                      {["case_c", "case_e", "case_m", "case_o", "case_p"].map((code) => {
                        const v = fieldVal(s, code);
                        return <td key={code} style={{ ...td, fontWeight: 700 }}>{v ? fmtMoney(parseVal(v)) : <span style={{ color: "#b0b0b0" }}>—</span>}</td>;
                      })}
                    </tr></tbody>
                  </table>
                  </div>
                </div>
              ))}
              {rl1Slips.map((s) => (
                <div key={s.documentId} style={{ marginBottom: 12, fontSize: 14 }}>
                  <strong>Relevé 1</strong> — {s.filename}
                  <span style={{ color: "var(--text-secondary)", fontSize: 12 }}> · {s.fields.filter((f) => f.value).length}/{s.fields.length} {T("champs", "fields")}</span>
                </div>
              ))}
            </>
          ) : (
            <>
              <h2 style={h2}>🏛️ {T("C. Volet provincial", "C. Provincial section")} <span style={{ fontSize: 11, background: "#0b6b67", color: "#fff", borderRadius: 6, padding: "2px 8px", verticalAlign: "middle" }}>{activeProvince?.form ?? "428"}</span></h2>
              <p style={sub}>{T("Crédits d'impôt non remboursables de la province — le revenu imposable provincial (hors Québec) égale le revenu imposable fédéral (ligne 26000).", "Provincial non-refundable tax credits — provincial taxable income (outside Quebec) equals federal taxable income (line 26000).")}</p>
              {activeProvince ? (
                <>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{T("Montant personnel de base", "Basic personal amount")} — {activeProvince.nameFr}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#0b6b67" }}>{fmtMoney(activeProvince.bpaCents)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{T("Taux du crédit (le plus bas)", "Credit rate (lowest)")}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>{activeProvince.creditRateBP != null ? (activeProvince.creditRateBP / 100).toLocaleString("fr-CA", { maximumFractionDigits: 2 }) + " %" : "—"}</div>
                    </div>
                    {activeProvince.hasSurtax && (
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{T("Surtaxe", "Surtax")}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>⚠️ {T("surtaxe provinciale applicable", "provincial surtax applies")}</div>
                      </div>
                    )}
                  </div>
                  <h3 style={{ fontSize: 14, margin: "0 0 8px", color: "var(--text-primary)" }}>{T("Paliers d'imposition provinciaux 2025", "2025 provincial tax brackets")}</h3>
                  <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th style={th}>{T("Tranche", "Bracket")}</th><th style={th}>{T("Taux", "Rate")}</th></tr></thead>
                    <tbody>
                      {activeProvince.brackets.map((b, i) => (
                        <tr key={i}>
                          <td style={td}>{fmtMoney(b.minCents)} — {b.maxCents ? fmtMoney(b.maxCents) : "∞"}</td>
                          <td style={{ ...td, fontWeight: 700 }}>{(b.rateBasisPoints / 100).toLocaleString("fr-CA", { maximumFractionDigits: 2 })} %</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{T("Règles provinciales non disponibles.", "Provincial rules unavailable.")}</p>
              )}
            </>
          )}
        </section>

        {/* ═══ G. RÉSUMÉ ═══ */}
        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
            <h2 style={{ ...h2, margin: 0 }}>📊 {T("G. Résumé et estimation", "G. Summary and estimate")} — {meta.taxYear}</h2>
            <button onClick={runCalculation} disabled={calculating || !meta.taxReturnId}
              style={{ padding: "10px 18px", background: calculating ? "#dde8e5" : "#0b6b67", color: calculating ? "#9fd4cc" : "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              {calculating ? "⏳ " : "🔢 "}{T("Recalculer", "Recalculate")}
            </button>
          </div>
          {calculation ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 12 }}>
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>🇨🇦 {T("Fédéral (T1)", "Federal (T1)")}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: calculation.federal.isRefund ? "#0b6b67" : "#dc2626" }}>
                    {calculation.federal.isRefund ? "+" : "−"}{calculation.federal.balance.replace("-", "")}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{calculation.federal.isRefund ? T("remboursement", "refund") : T("solde dû", "balance owing")}</div>
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>📍 {activeProvince?.nameFr ?? meta.province} ({activeProvince?.form ?? ""})</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: calculation.provincial.isRefund ? "#0b6b67" : "#dc2626" }}>
                    {calculation.provincial.isRefund ? "+" : "−"}{calculation.provincial.balance.replace("-", "")}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{calculation.provincial.isRefund ? T("remboursement", "refund") : T("solde dû", "balance owing")}</div>
                </div>
                <div style={{ border: "2px solid #0b6b67", borderRadius: 10, padding: 14, background: "rgba(11,107,103,0.05)" }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{T("Total combiné", "Combined total")}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: calculation.isRefund ? "#0b6b67" : "#dc2626" }}>
                    {calculation.isRefund ? "+" : "−"}{calculation.totalBalance.replace("-", "")}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{calculation.isRefund ? T("remboursement total", "total refund") : T("solde total dû", "total balance owing")}</div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                {T("Calculé le", "Calculated on")} {new Date(calculation.calculatedAt).toLocaleString("fr-CA")}
                {calculation.isPreliminary && <> · {T("PRÉLIMINAIRE", "PRELIMINARY")}</>}
              </p>
            </>
          ) : (
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              {T("Aucun calcul pour l'instant — clique sur « Recalculer ».", "No calculation yet — click “Recalculate”.")}
            </p>
          )}
          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => router.push("/resume")} style={{ padding: "10px 18px", background: "var(--bg-card)", color: "#0b6b67", border: "1px solid #0b6b67", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              {T("→ Voir le résumé détaillé", "→ View detailed summary")}
            </button>
            <button onClick={() => router.push("/dossier")} style={{ padding: "10px 18px", background: "var(--bg-card)", color: "#0b6b67", border: "1px solid #0b6b67", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              {T("→ Gérer mes feuillets", "→ Manage my slips")}
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
