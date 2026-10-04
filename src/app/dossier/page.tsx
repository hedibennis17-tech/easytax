"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { NavClient } from "@/components/NavClient";
import { useApp } from "@/components/ThemeProvider";

// ─── Types ────────────────────────────────────────────────────
type PipelineStep = "idle" | "uploading" | "ocr" | "extraction" | "validation" | "calculation" | "done" | "error";

interface DocEntry {
  slotId:       string;
  typeCode:     string;
  typeLabel:    string;
  fileName:     string;
  file:         File;
  step:         PipelineStep;
  progress:     number;      // 0–100
  documentId?:  string;      // après upload S3
  taxReturnId?: string;      // après upload
  entriesCreated?: number;   // après sync OCR
  extractedFields?: Array<{ code: string; label: string | null; value: string | null }>;
  error?:       string;
}

// ─── Constantes ───────────────────────────────────────────────
const DOC_TYPES = [
  { code: "T4",       label: "T4",       desc: "Rémunération d'emploi",    hint: "Case 14, 16, 18, 22..." },
  { code: "RL-1",     label: "RL-1",     desc: "Relevé 1 (Québec emploi)", hint: "Case A, B, C, E..." },
  { code: "T4A",      label: "T4A",      desc: "Autres revenus",           hint: "CNESST, pension, bourses" },
  { code: "T4E",      label: "T4E",      desc: "Assurance-emploi",         hint: "Prestations AE" },
  { code: "T5",       label: "T5",       desc: "Revenus de placements",    hint: "Intérêts, dividendes" },
  { code: "T3",       label: "T3",       desc: "Fiducie / fonds",          hint: "Fonds communs" },
  { code: "T4RSP",    label: "T4RSP",    desc: "Retrait REER",             hint: "Montant retiré" },
  { code: "REER",     label: "Reçu REER",desc: "Cotisation REER",          hint: "Déduction REER 2025" },
  { code: "T2202",    label: "T2202",    desc: "Frais de scolarité",       hint: "Université, cégep" },
  { code: "RL-2",     label: "RL-2",     desc: "Retraite (Québec)",        hint: "Revenus de retraite" },
  { code: "T5008",    label: "T5008",    desc: "Gains en capital",         hint: "Vente de placements" },
  { code: "DONATION", label: "Reçu don", desc: "Dons de bienfaisance",     hint: "Organismes reconnus" },
  { code: "MEDICAL",  label: "Médical",  desc: "Reçus médicaux",           hint: "Ordonnances, dentiste" },
  { code: "OTHER",    label: "Autre",    desc: "Autre document fiscal",    hint: "Classification IA" },
];

const STEPS: { key: PipelineStep; label: string; labelEn: string }[] = [
  { key: "uploading",    label: "Upload",     labelEn: "Upload" },
  { key: "ocr",         label: "OCR",        labelEn: "OCR" },
  { key: "extraction",  label: "Extraction", labelEn: "Extraction" },
  { key: "validation",  label: "Validation", labelEn: "Validation" },
  { key: "calculation", label: "Calcul",     labelEn: "Calculation" },
  { key: "done",        label: "Terminé",    labelEn: "Done" },
];

const STEP_ORDER: PipelineStep[] = ["idle","uploading","ocr","extraction","validation","calculation","done"];
function stepIndex(s: PipelineStep) { return STEP_ORDER.indexOf(s); }

// ─── Helpers visuels ──────────────────────────────────────────
function StepBubble({ step, current, label }: { step: PipelineStep; current: PipelineStep; label: string }) {
  const ci = stepIndex(current);
  const si = stepIndex(step);
  const done    = ci > si && current !== "error";
  const active  = ci === si;
  const error   = current === "error";
  const bg = done ? "#0b6b67" : active ? (error ? "#dc2626" : "#0b6b67") : "#e5ede9";
  const textColor = (done || active) ? "#fff" : "#9db8b3";
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", margin: "0 auto 5px", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: textColor, boxShadow: active ? "0 0 0 3px rgba(11,107,103,0.2)" : "none" }}>
        {done ? "✓" : error && active ? "✕" : STEP_ORDER.indexOf(step)}
      </div>
      <div style={{ fontSize: 9, color: done || active ? "#0b6b67" : "#a0b4b0", fontWeight: active ? 700 : 400, whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
}

// ─── Carte document dans le pipeline ─────────────────────────
function DocCard({
  doc, lang, onValidateAll, onRetry, onRemove,
}: {
  doc: DocEntry; lang: string;
  onValidateAll: (slotId: string) => void;
  onRetry: (slotId: string) => void;
  onRemove: (slotId: string) => void;
}) {
  const T = (fr: string, en: string) => lang === "en" ? en : fr;
  const isDone  = doc.step === "done";
  const isError = doc.step === "error";
  const isActive= !isDone && !isError && doc.step !== "idle";

  const borderColor = isDone ? "#9fd4cc" : isError ? "#fca5a5" : isActive ? "#b6ddd6" : "#dde8e5";
  const bg = isDone ? "rgba(11,107,103,0.04)" : isError ? "rgba(220,38,38,0.04)" : "#fff";

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: 14, background: bg, padding: "14px 16px", marginBottom: 10, transition: "all 300ms" }}>
      {/* En-tête carte */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#0b6b67", background: "rgba(11,107,103,0.1)", padding: "2px 7px", borderRadius: 6 }}>
              {doc.typeCode}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0f1f1e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
              {doc.fileName}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#7a9c97", marginTop: 3 }}>{doc.typeLabel}</div>
        </div>
        <button onClick={() => onRemove(doc.slotId)} style={{ border: 0, background: "transparent", color: "#a0b4b0", cursor: "pointer", fontSize: 16, padding: "0 4px", flexShrink: 0 }}>✕</button>
      </div>

      {/* Pipeline visuel */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10, gap: 0 }}>
        {STEPS.map((s, i) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <StepBubble step={s.key} current={doc.step} label={lang === "en" ? s.labelEn : s.label} />
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: stepIndex(doc.step) > stepIndex(s.key) ? "#0b6b67" : "#e5ede9", transition: "background 400ms" }} />
            )}
          </div>
        ))}
      </div>

      {/* Barre progression */}
      {isActive && (
        <div style={{ height: 3, background: "#e5ede9", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ height: "100%", width: `${doc.progress}%`, background: "#0b6b67", borderRadius: 3, transition: "width 400ms ease" }} />
        </div>
      )}

      {/* Message d'état */}
      {isActive && (
        <div style={{ fontSize: 12, color: "#0b6b67", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#0b6b67", animation: "pulse 1s infinite" }} />
          {doc.step === "uploading"    && T("Envoi du fichier vers S3...","Uploading file to S3...")}
          {doc.step === "ocr"         && T("Lecture OCR du document...","Running OCR on document...")}
          {doc.step === "extraction"  && T("Extraction des cases fiscales...","Extracting tax fields...")}
          {doc.step === "validation"  && T("Validation des données extraites...","Validating extracted data...")}
          {doc.step === "calculation" && T("Calcul fiscal en cours...","Running tax calculation...")}
        </div>
      )}

      {/* Résultat: succès */}
      {isDone && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#059669", fontWeight: 600, marginBottom: 6 }}>
            ✓ {T("Traitement complet","Processing complete")}
            {(doc.entriesCreated ?? 0) > 0 && (
              <span style={{ fontSize: 11, background: "rgba(5,150,105,0.1)", color: "#059669", padding: "1px 7px", borderRadius: 100, fontWeight: 700 }}>
                {doc.entriesCreated} {T("donnée(s) fiscale(s) extraite(s)","tax data extracted")}
              </span>
            )}
          </div>
          {/* Champs extraits en aperçu */}
          {(doc.extractedFields?.length ?? 0) > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6, marginTop: 8 }}>
              {doc.extractedFields!.slice(0, 8).map(f => (
                <div key={f.code} style={{ background: "#f7f9f8", border: "1px solid #dde8e5", borderRadius: 8, padding: "6px 8px" }}>
                  <div style={{ fontSize: 9, color: "#9fd4cc", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
                    {f.label ?? f.code}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f1f1e", fontFamily: "monospace", marginTop: 2 }}>
                    {f.value ?? "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Bouton valider tout */}
          {(doc.entriesCreated ?? 0) > 0 && (
            <button onClick={() => onValidateAll(doc.slotId)}
              style={{ marginTop: 10, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "#0b6b67", color: "#fff", border: "none", cursor: "pointer", width: "100%" }}>
              {T("✓ Confirmer les données extraites","✓ Confirm extracted data")}
            </button>
          )}
        </div>
      )}

      {/* Résultat: erreur */}
      {isError && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
          <span style={{ fontSize: 12, color: "#dc2626", flex: 1 }}>⚠ {doc.error ?? T("Erreur de traitement","Processing error")}</span>
          <button onClick={() => onRetry(doc.slotId)} style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700, background: "transparent", color: "#0b6b67", border: "1px solid #0b6b67", cursor: "pointer" }}>
            {T("Réessayer","Retry")}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════
export default function DossierPage() {
  const router = useRouter();
  const { lang } = useApp();
  const T = (fr: string, en: string) => lang === "en" ? en : fr;

  const [docs,          setDocs]          = useState<DocEntry[]>([]);
  const [showPicker,    setShowPicker]    = useState(false);
  const [taxReturnId,   setTaxReturnId]   = useState<string | null>(null);
  const [calcDone,      setCalcDone]      = useState(false);
  const [calcResult,    setCalcResult]    = useState<{ balance: number; isRefund: boolean } | null>(null);
  const [existingDocs,  setExistingDocs]  = useState<Array<{ id: string; filename: string; typeCode: string | null; status: string; entriesCreated?: number }>>([]);
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Charger les docs existants au démarrage ──────────────
  useEffect(() => {
    fetch("/api/resume")
      .then(r => r.ok ? r.json() : null)
      .then((d: { meta?: { taxReturnId?: string }; documents?: typeof existingDocs; calculation?: { totalBalanceCents?: number; isRefund?: boolean } } | null) => {
        if (!d) return;
        if (d.meta?.taxReturnId) setTaxReturnId(d.meta.taxReturnId);
        if (d.documents) setExistingDocs(d.documents);
        if (d.calculation) {
          setCalcDone(true);
          setCalcResult({ balance: d.calculation.totalBalanceCents ?? 0, isRefund: d.calculation.isRefund ?? false });
        }
      })
      .catch(() => {});
  }, []);

  // ── Pipeline complet pour un document ────────────────────
  const runPipeline = useCallback(async (slotId: string, file: File, typeCode: string) => {

    const setStep = (step: PipelineStep, progress: number, extra?: Partial<DocEntry>) =>
      setDocs(ds => ds.map(d => d.slotId === slotId ? { ...d, step, progress, ...extra } : d));

    try {
      // ── ÉTAPE 1: UPLOAD ───────────────────────────────────
      setStep("uploading", 15);
      const form = new FormData();
      form.append("file", file);
      form.append("documentTypeCode", typeCode);

      const upRes = await fetch("/api/documents/upload", { method: "POST", body: form });

      if (!upRes.ok) {
        const err = await upRes.json().catch(() => ({})) as { error?: string; existingDocumentId?: string };
        if (err.error === "duplicate_detected") {
          // Doublon — traiter quand même comme done
          setStep("done", 100, { documentId: err.existingDocumentId, entriesCreated: 0, error: T("Document déjà présent — données récupérées","Document already exists — data recovered") });
          return;
        }
        throw new Error(err.error ?? "Erreur upload");
      }

      const upData = await upRes.json() as { id: string; taxReturnId?: string };
      const documentId = upData.id;
      if (upData.taxReturnId) setTaxReturnId(upData.taxReturnId);

      setStep("uploading", 40, { documentId });

      // ── ÉTAPE 2: OCR ──────────────────────────────────────
      setStep("ocr", 50);

      const ocrRes = await fetch(`/api/documents/${documentId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear: 2025 }),
      });

      const ocrData = ocrRes.ok ? await ocrRes.json().catch(() => ({})) as { entriesCreated?: number; extractionId?: string } : {};

      // ── ÉTAPE 3: EXTRACTION ───────────────────────────────
      setStep("extraction", 65);

      // Récupérer les champs extraits pour aperçu visuel
      let extractedFields: DocEntry["extractedFields"] = [];
      if (documentId) {
        const resumeRes = await fetch("/api/resume").catch(() => null);
        if (resumeRes?.ok) {
          const resumeData = await resumeRes.json() as { slips?: Array<{ documentId: string; fields: Array<{ code: string; label: string | null; value: string | null }> }> };
          const slip = resumeData.slips?.find(s => s.documentId === documentId);
          if (slip) extractedFields = slip.fields;
        }
      }

      setStep("extraction", 75, { extractedFields });

      // ── ÉTAPE 4: VALIDATION AUTO ──────────────────────────
      // Valider automatiquement les données OCR avec confiance élevée
      setStep("validation", 82);

      const syncRes = await fetch("/api/resume/sync-from-docs", { method: "POST" }).catch(() => null);
      const syncData = syncRes?.ok ? await syncRes.json().catch(() => ({})) as { totalCreated?: number } : {};
      const entriesCreated = (ocrData.entriesCreated ?? 0) + (syncData.totalCreated ?? 0);

      // Auto-valider les entries issues de ce document
      if (documentId && entriesCreated > 0) {
        await fetch("/api/resume/edit", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "validate_all_from_doc", documentId }),
        }).catch(() => {});
      }

      setStep("validation", 88, { entriesCreated });

      // ── ÉTAPE 5: CALCUL FISCAL AUTO ───────────────────────
      setStep("calculation", 93);

      const currentTaxReturnId = upData.taxReturnId ?? taxReturnId;
      if (currentTaxReturnId) {
        const calcRes = await fetch("/api/tax-engine/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taxReturnId: currentTaxReturnId }),
        }).catch(() => null);

        if (calcRes?.ok) {
          const calcData = await calcRes.json().catch(() => ({})) as { result?: { totalBalanceCents?: number; isRefund?: boolean } };
          if (calcData.result) {
            setCalcDone(true);
            setCalcResult({
              balance: calcData.result.totalBalanceCents ?? 0,
              isRefund: (calcData.result.totalBalanceCents ?? 0) < 0,
            });
          }
        }
      }

      // ── DONE ──────────────────────────────────────────────
      setStep("done", 100, { entriesCreated, extractedFields });

      // Rafraîchir la liste des docs existants
      fetch("/api/resume")
        .then(r => r.ok ? r.json() : null)
        .then((d: { documents?: typeof existingDocs } | null) => { if (d?.documents) setExistingDocs(d.documents); })
        .catch(() => {});

    } catch (err) {
      setStep("error", 0, { error: err instanceof Error ? err.message : "Erreur inconnue" });
    }
  }, [taxReturnId, lang]);

  // ── Sélectionner un type et ouvrir le file picker ────────
  const pickFile = (typeCode: string, typeLabel: string) => {
    const slotId = `${typeCode}-${Date.now()}`;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.jpg,.jpeg,.png,.heic,.webp";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const entry: DocEntry = { slotId, typeCode, typeLabel, fileName: file.name, file, step: "idle", progress: 0 };
      setDocs(ds => [...ds, entry]);
      setShowPicker(false);
      runPipeline(slotId, file, typeCode);
    };
    input.click();
  };

  // ── Retry ─────────────────────────────────────────────────
  const handleRetry = useCallback((slotId: string) => {
    const doc = docs.find(d => d.slotId === slotId);
    if (!doc) return;
    setDocs(ds => ds.map(d => d.slotId === slotId ? { ...d, step: "idle", progress: 0, error: undefined } : d));
    runPipeline(slotId, doc.file, doc.typeCode);
  }, [docs, runPipeline]);

  // ── Supprimer ─────────────────────────────────────────────
  const handleRemove = useCallback((slotId: string) => {
    setDocs(ds => ds.filter(d => d.slotId !== slotId));
  }, []);

  // ── Valider toutes les données d'un doc ───────────────────
  const handleValidateAll = useCallback(async (slotId: string) => {
    const doc = docs.find(d => d.slotId === slotId);
    if (!doc?.documentId) return;
    await fetch("/api/resume/validate-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: doc.documentId }),
    }).catch(() => {});
    // Recalculer après validation
    if (taxReturnId) {
      await fetch("/api/tax-engine/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxReturnId }),
      }).then(r => r.ok ? r.json() : null)
        .then((d: { result?: { totalBalanceCents?: number } } | null) => {
          if (d?.result) {
            setCalcDone(true);
            setCalcResult({ balance: d.result.totalBalanceCents ?? 0, isRefund: (d.result.totalBalanceCents ?? 0) < 0 });
          }
        }).catch(() => {});
    }
  }, [docs, taxReturnId]);

  const docsInProgress = docs.filter(d => d.step !== "idle" && d.step !== "done" && d.step !== "error");
  const docsDone       = docs.filter(d => d.step === "done");
  const totalEntries   = docs.reduce((s, d) => s + (d.entriesCreated ?? 0), 0);

  // ── Style animé ──────────────────────────────────────────
  const CSS = `@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`;

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <NavClient />
      <style>{CSS}</style>

      <main style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 80px" }}>

        {/* ── En-tête ─────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: "Georgia,serif", fontSize: "clamp(1.5rem,4vw,2rem)", margin: "0 0 4px", color: "var(--text-primary)" }}>
            {T("Mon dossier fiscal 2025","My 2025 Tax File")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
            {T("Uploadez vos feuillets — le système extrait, valide et calcule automatiquement.",
               "Upload your slips — the system extracts, validates and calculates automatically.")}
          </p>
        </div>

        {/* ── Résultat fiscal (si calcul fait) ────────────── */}
        {calcDone && calcResult && (
          <div onClick={() => router.push("/resume")} style={{ background: calcResult.isRefund ? "rgba(5,150,105,0.06)" : "rgba(220,38,38,0.06)", border: `1px solid ${calcResult.isRefund ? "rgba(5,150,105,0.3)" : "rgba(220,38,38,0.3)"}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: calcResult.isRefund ? "#059669" : "#dc2626", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                🔢 {T("Résultat fiscal préliminaire","Preliminary tax result")}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace", color: calcResult.isRefund ? "#059669" : "#dc2626" }}>
                {calcResult.isRefund ? "▲ " : "▼ "}{(Math.abs(calcResult.balance) / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2 })} $
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {calcResult.isRefund ? T("Remboursement estimé","Estimated refund") : T("Solde dû estimé","Estimated balance owing")} · {T("Voir le résumé →","See summary →")}
              </div>
            </div>
            <span style={{ fontSize: 24, color: calcResult.isRefund ? "#059669" : "#dc2626" }}>
              {calcResult.isRefund ? "💚" : "📊"}
            </span>
          </div>
        )}

        {/* ── Documents en cours de traitement ────────────── */}
        {docs.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {docs.map(doc => (
              <DocCard key={doc.slotId} doc={doc} lang={lang}
                onValidateAll={handleValidateAll}
                onRetry={handleRetry}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}

        {/* ── Stats rapides ────────────────────────────────── */}
        {(docsDone.length > 0 || existingDocs.length > 0) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { label: T("Docs traités","Docs processed"), value: docsDone.length + existingDocs.filter(d => d.status === "ready_for_tax_return").length },
              { label: T("Données extraites","Data extracted"), value: totalEntries + existingDocs.reduce((s, d) => s + (d.entriesCreated ?? 0), 0) },
              { label: T("Statut calcul","Calc status"), value: calcDone ? T("✓ Fait","✓ Done") : T("En attente","Pending") },
            ].map(stat => (
              <div key={stat.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Ajouter un document ──────────────────────────── */}
        {!showPicker ? (
          <button onClick={() => setShowPicker(true)} style={{ width: "100%", padding: "16px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, background: "var(--bg-card)", color: "#0b6b67", border: "1.5px dashed #9fd4cc", cursor: "pointer", marginBottom: 14 }}>
            + {T("Ajouter un feuillet ou document fiscal","Add a slip or tax document")}
          </button>
        ) : (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                {T("Choisir le type de document","Choose document type")}
              </span>
              <button onClick={() => setShowPicker(false)} style={{ border: 0, background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {DOC_TYPES.map(t => (
                <button key={t.code} onClick={() => pickFile(t.code, t.label)}
                  style={{ padding: "10px 12px", borderRadius: 10, textAlign: "left", background: "var(--bg-base)", border: "1px solid var(--border)", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "#9fd4cc")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0b6b67", marginBottom: 2 }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.3 }}>{t.desc}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{t.hint}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Docs existants (traités avant) ──────────────── */}
        {existingDocs.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              {T("Documents de ce dossier","Documents in this file")}
            </div>
            {existingDocs.map(doc => (
              <div key={doc.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#0b6b67", background: "rgba(11,107,103,0.08)", padding: "1px 6px", borderRadius: 5, marginRight: 6 }}>{doc.typeCode ?? "?"}</span>
                  <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{doc.filename}</span>
                </div>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, fontWeight: 600,
                  background: doc.status === "ready_for_tax_return" ? "rgba(5,150,105,0.1)" : "rgba(245,158,11,0.1)",
                  color: doc.status === "ready_for_tax_return" ? "#059669" : "#92400e" }}>
                  {doc.status === "ready_for_tax_return" ? T("✓ Extrait","✓ Extracted") : T("⏳ Traitement","⏳ Processing")}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--border)", margin: "20px 0" }} />

        {/* ── Actions ──────────────────────────────────────── */}
        <div style={{ display: "grid", gap: 8 }}>
          {/* Questions complémentaires */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                📝 {T("Questions complémentaires","Supplemental questions")}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {T("Bureau à domicile, véhicule, famille — ce qui ne figure pas sur les feuillets.",
                   "Home office, vehicle, family — what's not on the slips.")}
              </div>
            </div>
            <button onClick={() => router.push("/questionnaire")} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "#0b6b67", color: "#fff", border: "none", cursor: "pointer", flexShrink: 0 }}>
              {T("Commencer →","Start →")}
            </button>
          </div>

          {/* Résumé fiscal */}
          <button onClick={() => router.push("/resume")} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, cursor: "pointer", width: "100%", textAlign: "left" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                📊 {T("Résumé fiscal","Tax summary")}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {calcDone
                  ? T("Voir le détail des calculs préliminaires","View preliminary calculation details")
                  : T("Disponible après traitement des documents","Available after document processing")}
              </div>
            </div>
            <span style={{ fontSize: 18, color: calcDone ? "#0b6b67" : "var(--text-muted)" }}>
              {calcDone ? "✓" : "→"}
            </span>
          </button>
        </div>

        <div style={{ marginTop: 20, fontSize: 11, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
          {T("EasyTax produit des résultats préliminaires. Aucune déclaration n'est transmise sans votre validation explicite.",
             "EasyTax produces preliminary results. No return is filed without your explicit approval.")}
        </div>

      </main>
    </div>
  );
}
