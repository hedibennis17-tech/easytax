"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { NavClient } from "@/components/NavClient";
import { useApp } from "@/components/ThemeProvider";

// ─── Types ────────────────────────────────────────────────
interface IncomeEntry  { id:string; category:string; amountCents:number; amount:string; description:string|null; employerName:string|null; sourceType:string; isValidated:boolean; sourceDocumentId:string|null }
interface DeductionEntry { id:string; category:string; amountCents:number; amount:string; description:string|null; sourceType:string; isValidated:boolean }
interface CreditEntry  { id:string; category:string; amountCents:number; amount:string; description:string|null; sourceType:string; isValidated:boolean }
interface SlipField    { code:string; label:string|null; value:string|null; validated:boolean; confidence:number|null }
interface SlipData     { documentId:string; filename:string; typeCode:string|null; typeName:string|null; fields:SlipField[] }
interface DocSummary   { id:string; filename:string; typeCode:string|null; typeName:string|null; status:string; uploadedAt:string; hasExtraction:boolean }
interface Calculation  {
  calculatedAt:string; isPreliminary:boolean; rulesVersion:string|null;
  federal: { taxBeforeCredits:string; credits:string; taxPayable:string; withheld:string; balance:string; balanceCents:number; isRefund:boolean }
  provincial: { taxBeforeCredits:string; credits:string; taxPayable:string; withheld:string; balance:string; balanceCents:number; isRefund:boolean }
  totalBalance:string; totalBalanceCents:number; isRefund:boolean;
}
interface ResumeData {
  meta: { taxYear:number; province:string; provinceNameFr:string; provinceNameEn:string; declarationForm:string; profileName:string; sinLastFour:string|null; maritalStatus:string; isPreliminary:boolean; taxReturnId:string|null; lastUpdated:string|null }
  incomes: IncomeEntry[]
  deductions: DeductionEntry[]
  credits: CreditEntry[]
  slips: SlipData[]
  documents: DocSummary[]
  questionAnswers: Array<{code:string; label:string|null; section:string|null; value:string|null; updatedAt:string}>
  totals: { income:string; incomeCents:number; deductions:string; deductionsCents:number; credits:string; creditsCents:number; netIncome:string; netIncomeCents:number; incomeCount:number; validatedIncomeCount:number; docCount:number; docWithExtractionCount:number }
  calculation: Calculation|null
}

// ─── Helpers ─────────────────────────────────────────────
const INCOME_LABELS: Record<string,{fr:string;en:string}> = {
  employment:         { fr:"Revenus d'emploi",         en:"Employment income" },
  self_employment:    { fr:"Travail autonome",          en:"Self-employment" },
  rental:             { fr:"Revenus locatifs",          en:"Rental income" },
  investment:         { fr:"Revenus de placement",      en:"Investment income" },
  pension:            { fr:"Pension / retraite",        en:"Pension / retirement" },
  rrsp_withdrawal:    { fr:"Retrait REER",              en:"RRSP withdrawal" },
  government_benefit: { fr:"Prestations gouvernementales", en:"Government benefits" },
  foreign:            { fr:"Revenus étrangers",         en:"Foreign income" },
  other:              { fr:"Autres revenus",            en:"Other income" },
};
const DEDUCTION_LABELS: Record<string,{fr:string;en:string}> = {
  rrsp:              { fr:"Cotisation REER",            en:"RRSP contribution" },
  childcare:         { fr:"Frais de garde",             en:"Childcare expenses" },
  moving:            { fr:"Frais de déménagement",      en:"Moving expenses" },
  union_dues:        { fr:"Cotisations syndicales",     en:"Union dues" },
  employment_exp:    { fr:"Dépenses d'emploi",         en:"Employment expenses" },
  northern:          { fr:"Déduction nordique",        en:"Northern deduction" },
  other:             { fr:"Autres déductions",          en:"Other deductions" },
};
const CREDIT_LABELS: Record<string,{fr:string;en:string}> = {
  basic_personal:    { fr:"Montant personnel de base", en:"Basic personal amount" },
  age:               { fr:"Montant en raison de l'âge", en:"Age amount" },
  spouse:            { fr:"Conjoint(e)",               en:"Spouse amount" },
  disability:        { fr:"Crédit pour invalidité",   en:"Disability credit" },
  medical:           { fr:"Frais médicaux",           en:"Medical expenses" },
  donations:         { fr:"Dons de bienfaisance",     en:"Charitable donations" },
  tuition:           { fr:"Frais de scolarité",       en:"Tuition" },
  other:             { fr:"Autres crédits",           en:"Other credits" },
};
const MARITAL_LABELS: Record<string,{fr:string;en:string}> = {
  single:       { fr:"Célibataire", en:"Single" },
  married:      { fr:"Marié(e)",    en:"Married" },
  common_law:   { fr:"Conjoint(e) de fait", en:"Common-law" },
  separated:    { fr:"Séparé(e)",   en:"Separated" },
  divorced:     { fr:"Divorcé(e)",  en:"Divorced" },
  widowed:      { fr:"Veuf/veuve",  en:"Widowed" },
};
function fmtCents(c:number): string {
  const abs = Math.abs(c)/100;
  return abs.toLocaleString("fr-CA", { minimumFractionDigits:2, maximumFractionDigits:2 }) + " $";
}

// ─── Composant édition inline ─────────────────────────────
function EditableAmount({ value, onSave, lang }: { value: number; onSave:(v:number)=>Promise<void>; lang:string }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(value/100));
  const [saving, setSaving] = useState(false);
  if (!editing) return (
    <span onClick={() => setEditing(true)} title={lang==="en"?"Click to edit":"Cliquer pour modifier"}
      style={{ cursor:"pointer", borderBottom:"1px dashed #9fd4cc", color:"var(--text-primary)", fontWeight:600, fontFamily:"monospace" }}>
      {fmtCents(value)}
    </span>
  );
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
      <input autoFocus value={raw} onChange={e=>setRaw(e.target.value)} onKeyDown={async e=>{
        if (e.key==="Enter") { setSaving(true); await onSave(Math.round(parseFloat(raw||"0")*100)); setEditing(false); setSaving(false); }
        if (e.key==="Escape") setEditing(false);
      }} style={{ width:90, padding:"3px 6px", borderRadius:5, border:"1px solid #0b6b67", fontFamily:"monospace", fontSize:13 }} />
      <button disabled={saving} onClick={async()=>{ setSaving(true); await onSave(Math.round(parseFloat(raw||"0")*100)); setEditing(false); setSaving(false); }}
        style={{ padding:"3px 7px", borderRadius:5, background:"#0b6b67", color:"#fff", border:"none", cursor:"pointer", fontSize:11 }}>✓</button>
      <button onClick={()=>setEditing(false)} style={{ padding:"3px 7px", borderRadius:5, background:"transparent", color:"#526865", border:"1px solid #dde8e5", cursor:"pointer", fontSize:11 }}>✕</button>
    </span>
  );
}

// ─── Bloc résultat solde ──────────────────────────────────
function BalanceBadge({ label, balanceCents, isRefund }: { label:string; balanceCents:number; isRefund:boolean }) {
  const color = isRefund ? "#059669" : balanceCents === 0 ? "#526865" : "#dc2626";
  const bg    = isRefund ? "rgba(5,150,105,0.08)" : balanceCents === 0 ? "rgba(82,104,101,0.08)" : "rgba(220,38,38,0.08)";
  return (
    <div style={{ background:bg, border:`1px solid ${color}`, borderRadius:10, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <span style={{ fontSize:13, color:"var(--text-secondary)" }}>{label}</span>
      <div style={{ textAlign:"right" }}>
        <div style={{ fontWeight:700, fontSize:16, fontFamily:"monospace", color }}>
          {isRefund ? "▲ " : balanceCents > 0 ? "▼ " : ""}{fmtCents(Math.abs(balanceCents))}
        </div>
        <div style={{ fontSize:11, color }}>{isRefund ? (label.includes("fédéral")||label.includes("federal") ? "Remboursement / Refund" : "Remboursement / Refund") : balanceCents > 0 ? "Solde dû / Balance owing" : "—"}</div>
      </div>
    </div>
  );
}

// ─── PAGE PRINCIPALE ─────────────────────────────────────
export default function ResumePage() {
  const router = useRouter();
  const { lang } = useApp();
  const T = (fr:string, en:string) => lang==="en" ? en : fr;

  const [data, setData] = useState<ResumeData|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview"|"incomes"|"deductions"|"credits"|"slips"|"calculation">("overview");
  const [calculating, setCalculating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/resume");
      if (!res.ok) { setError(T("Erreur de chargement","Loading error")); return; }
      const d = await res.json() as ResumeData;
      setData(d);
    } catch { setError(T("Erreur réseau","Network error")); }
    finally { setLoading(false); }
  }, [lang]);

  useEffect(() => { load(); }, [load]);

  const patchEntry = useCallback(async (type:string, id:string, patch:Record<string,unknown>) => {
    await fetch("/api/resume/edit", { method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ type, id, ...patch }) });
    await load();
  }, [load]);

  const runCalculation = async () => {
    if (!data?.meta.taxReturnId) return;
    setCalculating(true);
    await fetch("/api/tax-engine/calculate", { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ taxReturnId: data.meta.taxReturnId }) });
    await load();
    setCalculating(false);
    setActiveTab("calculation");
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"var(--bg-base)" }}>
      <NavClient />
      <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"60vh" }}>
        <div style={{ width:36, height:36, border:"4px solid #dde8e5", borderTopColor:"#0b6b67", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight:"100vh", background:"var(--bg-base)" }}>
      <NavClient />
      <div style={{ maxWidth:580, margin:"40px auto", padding:"0 20px", textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
        <p style={{ color:"#dc2626", fontSize:15 }}>{error || T("Données introuvables","Data not found")}</p>
        <button onClick={()=>router.push("/dossier")} style={{ marginTop:16, padding:"10px 20px", background:"#0b6b67", color:"#fff", border:"none", borderRadius:9, cursor:"pointer", fontWeight:700 }}>
          {T("← Mon dossier","← My file")}
        </button>
      </div>
    </div>
  );

  const { meta, incomes, deductions, credits, slips, documents, totals, calculation } = data;
  const isQC = meta.province === "QC";
  const totalBalance = (calculation?.federal.balanceCents ?? 0) + (calculation?.provincial.balanceCents ?? 0);

  const TABS = [
    { id:"overview",     label: T("Vue d'ensemble","Overview"),   icon:"📊" },
    { id:"incomes",      label: T("Revenus","Income"),            icon:"💰", count: incomes.length },
    { id:"deductions",   label: T("Déductions","Deductions"),     icon:"📉", count: deductions.length },
    { id:"credits",      label: T("Crédits","Credits"),           icon:"🎯", count: credits.length },
    { id:"slips",        label: T("Feuillets","Slips"),           icon:"📄", count: documents.length },
    { id:"calculation",  label: T("Calcul fiscal","Tax calc"),    icon:"🔢" },
  ] as const;

  return (
    <div style={{ background:"var(--bg-base)", minHeight:"100vh" }}>
      <NavClient />

      <div style={{ maxWidth:860, margin:"0 auto", padding:"20px 16px 80px" }}>

        {/* En-tête */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
            <div>
              <h1 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(1.6rem,4vw,2.4rem)", margin:"0 0 4px", color:"var(--text-primary)" }}>
                {T("Résumé fiscal","Tax Summary")} {meta.taxYear}
              </h1>
              <p style={{ color:"var(--text-secondary)", fontSize:14, margin:0 }}>
                {meta.profileName} · {isQC ? meta.provinceNameFr : (lang==="en" ? meta.provinceNameEn : meta.provinceNameFr)} · {meta.declarationForm}
                {meta.sinLastFour && <span style={{ color:"#9fd4cc" }}> · NAS •••• {meta.sinLastFour}</span>}
                {" "}· {MARITAL_LABELS[meta.maritalStatus]?.[lang] ?? meta.maritalStatus}
              </p>
            </div>
            <button onClick={runCalculation} disabled={calculating||!meta.taxReturnId}
              style={{ padding:"10px 18px", background:calculating?"#dde8e5":"#0b6b67", color:calculating?"#9fd4cc":"#fff", border:"none", borderRadius:9, fontWeight:700, cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", gap:6 }}>
              {calculating ? "⏳ " : "🔢 "}{T("Calculer l'impôt","Calculate tax")}
            </button>
          </div>

          {/* Bandeau avertissement PRÉLIMINAIRE */}
          <div style={{ marginTop:12, background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#92400e", display:"flex", gap:8 }}>
            <span>⚠️</span>
            <span>
              {T("Résultats PRÉLIMINAIRES — à titre indicatif seulement. Aucune déclaration n'a été transmise à l'ARC","PRELIMINARY results — for information only. No return has been filed with the CRA")}
              {isQC && T(" ou à Revenu Québec"," or Revenu Québec")}.
            </span>
          </div>
        </div>

        {/* Onglets */}
        <div style={{ display:"flex", gap:6, overflowX:"auto", marginBottom:16, paddingBottom:4, scrollbarWidth:"none" }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
              style={{ flexShrink:0, padding:"8px 14px", borderRadius:8, fontSize:13, fontWeight:activeTab===tab.id?700:400, cursor:"pointer",
                background:activeTab===tab.id?"#0b6b67":"var(--bg-card)",
                color:activeTab===tab.id?"#fff":"var(--text-secondary)",
                border:`1px solid ${activeTab===tab.id?"#0b6b67":"var(--border)"}`,
                whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5 }}>
              {tab.icon} {tab.label}
              {"count" in tab && (tab.count as number) > 0 && (
                <span style={{ background:activeTab===tab.id?"rgba(255,255,255,0.25)":"rgba(11,107,103,0.12)", color:activeTab===tab.id?"#fff":"#0b6b67", borderRadius:100, fontSize:10, fontWeight:700, padding:"1px 6px" }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── VUE D'ENSEMBLE ────────────────────────────────── */}
        {activeTab==="overview" && (
          <div style={{ display:"grid", gap:14 }}>
            {/* Carte solde principal */}
            {calculation ? (
              <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:14, padding:"20px 20px 14px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#9fd4cc", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:14 }}>
                  {T("Résultat fiscal estimé","Estimated tax result")} — {T("Préliminaire","Preliminary")}
                </div>
                <div style={{ display:"grid", gap:8 }}>
                  <BalanceBadge label={T("Fédéral (T1)","Federal (T1)")} balanceCents={calculation.federal.balanceCents} isRefund={calculation.federal.isRefund} />
                  {isQC && <BalanceBadge label="Québec (TP-1)" balanceCents={calculation.provincial.balanceCents} isRefund={calculation.provincial.isRefund} />}
                  {!isQC && <BalanceBadge label={lang==="en" ? `Provincial (${meta.province})` : `Provincial (${meta.province})`} balanceCents={calculation.provincial.balanceCents} isRefund={calculation.provincial.isRefund} />}
                  <BalanceBadge label={T("TOTAL","TOTAL")} balanceCents={totalBalance} isRefund={totalBalance<0} />
                </div>
                <p style={{ fontSize:11, color:"#a0b4b0", marginTop:10, textAlign:"right" }}>
                  {T("Calculé le","Calculated")} {new Date(calculation.calculatedAt).toLocaleString(lang==="en"?"en-CA":"fr-CA")}
                  {calculation.rulesVersion && ` · v${calculation.rulesVersion}`}
                </p>
              </div>
            ) : (
              <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:14, padding:20, textAlign:"center" }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📊</div>
                <p style={{ color:"var(--text-muted)", fontSize:14, marginBottom:12 }}>
                  {T("Aucun calcul fiscal effectué pour l'instant.","No tax calculation yet.")}
                </p>
                <button onClick={runCalculation} disabled={calculating}
                  style={{ padding:"10px 20px", background:"#0b6b67", color:"#fff", border:"none", borderRadius:9, fontWeight:700, cursor:"pointer", fontSize:13 }}>
                  🔢 {T("Lancer le calcul","Run calculation")}
                </button>
              </div>
            )}

            {/* Résumé financier */}
            <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:14, padding:"18px 20px" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#9fd4cc", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:14 }}>
                {T("Résumé financier","Financial summary")}
              </div>
              {[
                { label: T("Revenu total","Total income"), value: totals.income, cents: totals.incomeCents },
                { label: T("Déductions totales","Total deductions"), value: totals.deductions, cents: totals.deductionsCents },
                { label: T("Revenu net","Net income"), value: totals.netIncome, cents: totals.netIncomeCents, bold: true },
              ].map(row => (
                <div key={row.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
                  <span style={{ fontSize:13, color:"var(--text-secondary)", fontWeight:row.bold?700:400 }}>{row.label}</span>
                  <span style={{ fontFamily:"monospace", fontWeight:row.bold?700:600, fontSize:row.bold?16:14, color:row.bold?"#0b6b67":"var(--text-primary)" }}>{row.value}</span>
                </div>
              ))}
              {totals.incomeCents === 0 && (
                <p style={{ fontSize:12, color:"#a0b4b0", marginTop:10, textAlign:"center" }}>
                  {T("Aucun revenu enregistré. Complétez votre questionnaire ou uploadez vos feuillets.","No income recorded. Complete your questionnaire or upload your slips.")}
                </p>
              )}
            </div>

            {/* Statut des feuillets */}
            <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:14, padding:"18px 20px" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#9fd4cc", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:14 }}>
                {T("Feuillets & documents","Slips & documents")}
              </div>
              {documents.length === 0 ? (
                <div style={{ textAlign:"center", padding:"16px 0" }}>
                  <p style={{ color:"var(--text-muted)", fontSize:13, marginBottom:10 }}>
                    {T("Aucun document uploadé.","No documents uploaded.")}
                  </p>
                  <button onClick={()=>router.push("/dossier")} style={{ padding:"8px 16px", background:"transparent", color:"#0b6b67", border:"1px solid #0b6b67", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 }}>
                    {T("→ Uploader des feuillets","→ Upload slips")}
                  </button>
                </div>
              ) : documents.map(doc => (
                <div key={doc.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid var(--border)", gap:8 }}>
                  <div>
                    <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>
                      📎 {doc.typeName ?? doc.typeCode ?? T("Feuillet","Slip")}
                    </span>
                    <span style={{ fontSize:11, color:"#a0b4b0", marginLeft:6 }}>{doc.filename}</span>
                  </div>
                  <span style={{ fontSize:11, padding:"2px 8px", borderRadius:100, fontWeight:600,
                    background: doc.hasExtraction ? "rgba(5,150,105,0.1)" : "rgba(245,158,11,0.1)",
                    color: doc.hasExtraction ? "#059669" : "#92400e" }}>
                    {doc.hasExtraction ? T("✓ Extrait","✓ Extracted") : T("⏳ En attente","⏳ Pending")}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions rapides */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                { label: T("Questionnaire individuel","Individual questionnaire"), href:"/questionnaire", icon:"📝" },
                { label: T("Uploader des feuillets","Upload slips"), href:"/dossier", icon:"📎" },
                { label: T("Mon profil","My profile"), href:"/profil", icon:"🪪" },
                { label: T("Mes documents","My documents"), href:"/documents", icon:"🗂️" },
              ].map(a => (
                <button key={a.href} onClick={()=>router.push(a.href)}
                  style={{ padding:"12px 14px", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:12, textAlign:"left", cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontSize:13, color:"var(--text-secondary)", fontWeight:500 }}>
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── REVENUS ───────────────────────────────────────── */}
        {activeTab==="incomes" && (
          <div style={{ display:"grid", gap:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
              <h2 style={{ fontFamily:"Georgia,serif", fontSize:18, margin:0, color:"var(--text-primary)" }}>
                {T("Revenus déclarés","Declared income")} — {totals.income}
              </h2>
              <span style={{ fontSize:12, color:"var(--text-muted)" }}>{totals.validatedIncomeCount}/{totals.incomeCount} {T("validés","validated")}</span>
            </div>

            {incomes.length === 0 ? (
              <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:14, padding:"28px 20px", textAlign:"center" }}>
                <div style={{ fontSize:32, marginBottom:8 }}>💰</div>
                <p style={{ color:"var(--text-muted)", fontSize:14 }}>{T("Aucun revenu enregistré.","No income recorded.")}</p>
              </div>
            ) : incomes.map(inc => (
              <div key={inc.id} style={{ background:"var(--bg-card)", border:`1px solid ${inc.isValidated ? "rgba(5,150,105,0.3)" : "var(--border)"}`, borderRadius:12, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)", marginBottom:2 }}>
                      {INCOME_LABELS[inc.category]?.[lang] ?? inc.category}
                    </div>
                    {inc.employerName && <div style={{ fontSize:12, color:"var(--text-muted)" }}>{inc.employerName}</div>}
                    {inc.description && <div style={{ fontSize:11, color:"#a0b4b0", marginTop:2 }}>{inc.description}</div>}
                    <div style={{ fontSize:11, color:"#a0b4b0", marginTop:4, display:"flex", gap:8 }}>
                      <span style={{ padding:"1px 6px", borderRadius:100, background:inc.sourceType==="validated_ocr"?"rgba(11,107,103,0.1)":"rgba(82,104,101,0.1)", color:inc.sourceType==="validated_ocr"?"#0b6b67":"#526865" }}>
                        {inc.sourceType==="validated_ocr" ? "📄 OCR" : inc.sourceType==="manual" ? T("✏️ Manuel","✏️ Manual") : inc.sourceType}
                      </span>
                      {inc.isValidated
                        ? <span style={{ color:"#059669" }}>✓ {T("Validé","Validated")}</span>
                        : <span style={{ color:"#92400e" }}>⚠ {T("Non validé","Unvalidated")}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <EditableAmount value={inc.amountCents} lang={lang}
                      onSave={v=>patchEntry("income", inc.id, { amountCents:v })} />
                    {!inc.isValidated && (
                      <button onClick={()=>patchEntry("income", inc.id, { isValidated:true })}
                        style={{ display:"block", marginTop:4, padding:"3px 8px", fontSize:10, background:"rgba(11,107,103,0.1)", color:"#0b6b67", border:"1px solid rgba(11,107,103,0.3)", borderRadius:6, cursor:"pointer", fontWeight:600 }}>
                        {T("Valider","Validate")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── DÉDUCTIONS ────────────────────────────────────── */}
        {activeTab==="deductions" && (
          <div style={{ display:"grid", gap:10 }}>
            <h2 style={{ fontFamily:"Georgia,serif", fontSize:18, margin:"0 0 4px", color:"var(--text-primary)" }}>
              {T("Déductions","Deductions")} — {totals.deductions}
            </h2>
            {deductions.length === 0 ? (
              <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:14, padding:"28px 20px", textAlign:"center" }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📉</div>
                <p style={{ color:"var(--text-muted)", fontSize:14 }}>{T("Aucune déduction enregistrée.","No deductions recorded.")}</p>
              </div>
            ) : deductions.map(d => (
              <div key={d.id} style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:12, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>
                      {DEDUCTION_LABELS[d.category]?.[lang] ?? d.category}
                    </div>
                    {d.description && <div style={{ fontSize:11, color:"#a0b4b0", marginTop:2 }}>{d.description}</div>}
                    <span style={{ fontSize:11, color: d.isValidated?"#059669":"#92400e", marginTop:4, display:"block" }}>
                      {d.isValidated ? T("✓ Validée","✓ Validated") : T("⚠ Non validée","⚠ Unvalidated")}
                    </span>
                  </div>
                  <EditableAmount value={d.amountCents} lang={lang}
                    onSave={v=>patchEntry("deduction", d.id, { amountCents:v })} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CRÉDITS ───────────────────────────────────────── */}
        {activeTab==="credits" && (
          <div style={{ display:"grid", gap:10 }}>
            <h2 style={{ fontFamily:"Georgia,serif", fontSize:18, margin:"0 0 4px", color:"var(--text-primary)" }}>
              {T("Crédits d'impôt","Tax credits")} — {totals.credits}
            </h2>
            {credits.length === 0 ? (
              <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:14, padding:"28px 20px", textAlign:"center" }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🎯</div>
                <p style={{ color:"var(--text-muted)", fontSize:14 }}>{T("Aucun crédit enregistré.","No credits recorded.")}</p>
              </div>
            ) : credits.map(c => (
              <div key={c.id} style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:12, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>
                      {CREDIT_LABELS[c.category]?.[lang] ?? c.category}
                    </div>
                    {c.description && <div style={{ fontSize:11, color:"#a0b4b0", marginTop:2 }}>{c.description}</div>}
                    <span style={{ fontSize:11, color: c.isValidated?"#059669":"#92400e", marginTop:4, display:"block" }}>
                      {c.isValidated ? T("✓ Validé","✓ Validated") : T("⚠ Non validé","⚠ Unvalidated")}
                    </span>
                  </div>
                  <EditableAmount value={c.amountCents} lang={lang}
                    onSave={v=>patchEntry("credit", c.id, { amountCents:v })} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── FEUILLETS / SLIPS ─────────────────────────────── */}
        {activeTab==="slips" && (
          <div style={{ display:"grid", gap:14 }}>
            <h2 style={{ fontFamily:"Georgia,serif", fontSize:18, margin:"0 0 4px", color:"var(--text-primary)" }}>
              {T("Feuillets fiscaux","Tax slips")} — {documents.length} {T("document(s)","document(s)")}
            </h2>

            {documents.length === 0 ? (
              <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:14, padding:"28px 20px", textAlign:"center" }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📄</div>
                <p style={{ color:"var(--text-muted)", fontSize:14, marginBottom:12 }}>
                  {T("Aucun feuillet uploadé. Vos T4, T5, RL-1 et autres feuillets apparaîtront ici une fois uploadés et traités.","No slips uploaded. Your T4, T5, RL-1 and other slips will appear here once uploaded and processed.")}
                </p>
                <button onClick={()=>router.push("/dossier")} style={{ padding:"10px 20px", background:"#0b6b67", color:"#fff", border:"none", borderRadius:9, cursor:"pointer", fontWeight:700, fontSize:13 }}>
                  {T("→ Uploader mes feuillets","→ Upload my slips")}
                </button>
              </div>
            ) : slips.map(slip => (
              <div key={slip.documentId} style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
                <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(11,107,103,0.04)" }}>
                  <div>
                    <span style={{ fontWeight:700, fontSize:14, color:"var(--text-primary)" }}>
                      📄 {slip.typeName ?? slip.typeCode ?? T("Feuillet","Slip")}
                    </span>
                    <span style={{ fontSize:11, color:"#a0b4b0", marginLeft:8 }}>{slip.filename}</span>
                  </div>
                  <span style={{ fontSize:11, padding:"2px 8px", borderRadius:100, background:"rgba(5,150,105,0.1)", color:"#059669", fontWeight:600 }}>
                    ✓ {slip.fields.length} {T("champs extraits","fields extracted")}
                  </span>
                </div>
                <div style={{ padding:"12px 16px" }}>
                  {slip.fields.length === 0 ? (
                    <p style={{ color:"#a0b4b0", fontSize:13, textAlign:"center", padding:"8px 0" }}>{T("Aucun champ extrait.","No fields extracted.")}</p>
                  ) : (
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:8 }}>
                      {slip.fields.map(f => (
                        <div key={f.code} style={{ background:"var(--bg-base)", border:"1px solid var(--border)", borderRadius:8, padding:"8px 10px" }}>
                          <div style={{ fontSize:10, color:"#9fd4cc", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:3 }}>
                            {f.label ?? f.code}
                            {f.confidence !== null && f.confidence < 80 && <span style={{ color:"#ef4444", marginLeft:4 }}>⚠{f.confidence}%</span>}
                            {f.validated && <span style={{ color:"#059669", marginLeft:4 }}>✓</span>}
                          </div>
                          <div style={{ fontFamily:"monospace", fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>
                            {f.value ?? "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Documents sans extraction */}
            {documents.filter(d=>!d.hasExtraction).length > 0 && (
              <div style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.25)", borderRadius:14, padding:"14px 16px" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#92400e", marginBottom:8 }}>
                  ⏳ {T("Documents en attente d'extraction","Documents pending extraction")}
                </div>
                {documents.filter(d=>!d.hasExtraction).map(doc => (
                  <div key={doc.id} style={{ fontSize:12, color:"#78350f", padding:"4px 0", borderBottom:"1px solid rgba(245,158,11,0.15)" }}>
                    📎 {doc.typeName ?? doc.typeCode ?? T("Feuillet","Slip")} · {doc.filename}
                    <span style={{ marginLeft:8, padding:"1px 6px", borderRadius:100, background:"rgba(245,158,11,0.15)", fontSize:10 }}>{doc.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CALCUL FISCAL DÉTAILLÉ ────────────────────────── */}
        {activeTab==="calculation" && (
          <div style={{ display:"grid", gap:14 }}>
            {!calculation ? (
              <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:14, padding:"28px 20px", textAlign:"center" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🔢</div>
                <p style={{ color:"var(--text-muted)", fontSize:14, marginBottom:16 }}>
                  {T("Le calcul fiscal n'a pas encore été lancé.","The tax calculation has not been run yet.")}
                </p>
                <button onClick={runCalculation} disabled={calculating}
                  style={{ padding:"12px 24px", background:"#0b6b67", color:"#fff", border:"none", borderRadius:9, fontWeight:700, cursor:"pointer", fontSize:14 }}>
                  {calculating ? T("Calcul en cours...","Calculating...") : T("🔢 Lancer le calcul fiscal","🔢 Run tax calculation")}
                </button>
              </div>
            ) : (
              <>
                {/* Bandeau préliminaire */}
                <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#92400e" }}>
                  ⚠️ {T("RÉSULTATS PRÉLIMINAIRES. Ces montants sont générés par EasyTax à titre indicatif — non validés par l'ARC.",
                    "PRELIMINARY RESULTS. These amounts are generated by EasyTax for information only — not validated by the CRA.")}
                </div>

                {/* Revenus et net */}
                <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:14, padding:"18px 20px" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#9fd4cc", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>{T("Base de calcul","Tax base")}</div>
                  {[
                    { label:T("Revenu total (ligne 15000)","Total income (line 15000)"), value:totals.income },
                    { label:T("Revenu net (ligne 23600)","Net income (line 23600)"), value:totals.netIncome },
                    { label:T("Revenu imposable (ligne 26000)","Taxable income (line 26000)"), value:totals.netIncome, bold:true },
                  ].map(r=>(
                    <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid var(--border)" }}>
                      <span style={{ fontSize:13, color:"var(--text-secondary)", fontWeight:r.bold?700:400 }}>{r.label}</span>
                      <span style={{ fontFamily:"monospace", fontWeight:r.bold?700:600, color:r.bold?"#0b6b67":"var(--text-primary)" }}>{r.value}</span>
                    </div>
                  ))}
                </div>

                {/* Fédéral */}
                <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:14, padding:"18px 20px" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#9fd4cc", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>
                    {T("Impôt fédéral (T1)","Federal tax (T1)")}
                  </div>
                  {[
                    { label:T("Impôt brut (avant crédits)","Gross tax (before credits)"), value:calculation.federal.taxBeforeCredits },
                    { label:T("Crédits non remboursables","Non-refundable credits"), value:`− ${calculation.federal.credits}` },
                    { label:T("Impôt net à payer","Net tax payable"), value:calculation.federal.taxPayable, bold:true },
                    { label:T("Impôt retenu (T4 case 22)","Tax withheld (T4 box 22)"), value:`− ${calculation.federal.withheld}` },
                  ].map(r=>(
                    <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid var(--border)" }}>
                      <span style={{ fontSize:13, color:"var(--text-secondary)", fontWeight:r.bold?700:400 }}>{r.label}</span>
                      <span style={{ fontFamily:"monospace", fontWeight:r.bold?700:600, color:r.bold?"var(--text-primary)":"var(--text-secondary)" }}>{r.value}</span>
                    </div>
                  ))}
                  <BalanceBadge label={T("Solde fédéral","Federal balance")} balanceCents={calculation.federal.balanceCents} isRefund={calculation.federal.isRefund} />
                </div>

                {/* Provincial */}
                <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:14, padding:"18px 20px" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#9fd4cc", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>
                    {isQC ? T("Impôt du Québec (TP-1)","Quebec tax (TP-1)") : T(`Impôt provincial (${meta.province})`,`Provincial tax (${meta.province})`)}
                  </div>
                  {[
                    { label:T("Impôt brut","Gross tax"), value:calculation.provincial.taxBeforeCredits },
                    { label:T("Crédits non remboursables","Non-refundable credits"), value:`− ${calculation.provincial.credits}` },
                    { label:T("Impôt net à payer","Net tax payable"), value:calculation.provincial.taxPayable, bold:true },
                    { label:T("Impôt retenu","Tax withheld"), value:`− ${calculation.provincial.withheld}` },
                  ].map(r=>(
                    <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid var(--border)" }}>
                      <span style={{ fontSize:13, color:"var(--text-secondary)", fontWeight:r.bold?700:400 }}>{r.label}</span>
                      <span style={{ fontFamily:"monospace", fontWeight:r.bold?700:600, color:r.bold?"var(--text-primary)":"var(--text-secondary)" }}>{r.value}</span>
                    </div>
                  ))}
                  <BalanceBadge label={isQC ? T("Solde Québec","Quebec balance") : T("Solde provincial","Provincial balance")} balanceCents={calculation.provincial.balanceCents} isRefund={calculation.provincial.isRefund} />
                </div>

                {/* Total final */}
                <div style={{ background: totalBalance<0 ? "rgba(5,150,105,0.06)" : "rgba(220,38,38,0.06)", border:`1px solid ${totalBalance<0?"rgba(5,150,105,0.3)":"rgba(220,38,38,0.3)"}`, borderRadius:14, padding:"18px 20px" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#9fd4cc", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>
                    {T("RÉSULTAT TOTAL","TOTAL RESULT")}
                  </div>
                  <BalanceBadge label={T("Total fédéral + provincial","Total federal + provincial")} balanceCents={totalBalance} isRefund={totalBalance<0} />
                  <p style={{ fontSize:11, color:"#a0b4b0", marginTop:10, textAlign:"right" }}>
                    {T("Version règles","Rules version")} {calculation.rulesVersion ?? "2025"} ·
                    {T(" Calculé le"," Calculated")} {new Date(calculation.calculatedAt).toLocaleString(lang==="en"?"en-CA":"fr-CA")}
                  </p>
                </div>

                <button onClick={runCalculation} disabled={calculating}
                  style={{ padding:"10px 0", background:"transparent", color:"#0b6b67", border:"1px solid rgba(11,107,103,0.3)", borderRadius:9, cursor:"pointer", fontSize:13, fontWeight:600, width:"100%" }}>
                  {T("🔄 Recalculer","🔄 Recalculate")}
                </button>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
