"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useApp } from "@/components/ThemeProvider";
import { useRouter } from "next/navigation";
import { NavClient } from "@/components/NavClient";
import { saveDraftLocal, loadDraftLocal, formatLastSaved } from "@/lib/draft";
import { normalizeProvinceCode, type ProvinceCode } from "@/lib/provinces";
import {
  ALL_INDIVIDUAL_QUESTIONS,
  getAllQuestionsWithProvince,
  INDIVIDUAL_SECTIONS,
  type Question,
} from "@/lib/questionnaire-individual";

// ── Évaluation conditions ──────────────────────────────────────────────────
function evalCond(cond: string | undefined, ans: Record<string, unknown>): boolean {
  if (!cond) return true;
  const [key, val] = cond.split("=");
  const actual = String(ans[key] ?? "");
  if (val === "true")  return actual === "true"  || actual === "oui";
  if (val === "false") return actual === "false" || actual === "non";
  return actual === val;
}

// ── Champ BOOLEAN ─────────────────────────────────────────────────────────
function FieldBoolean({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {([true, false] as const).map(v => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          style={{
            flex: 1, padding: "12px 0", borderRadius: 9, fontSize: 14, fontWeight: 600,
            border: `1.5px solid ${value === v ? (v ? "#0b6b67" : "#526865") : "#dde8e5"}`,
            background: value === v ? (v ? "#0b6b67" : "#526865") : "#fff",
            color: value === v ? "#fff" : "#526865",
            cursor: "pointer", transition: "all 120ms",
          }}
        >
          {v ? "Oui" : "Non"}
        </button>
      ))}
    </div>
  );
}

// ── Champ SINGLE_CHOICE ───────────────────────────────────────────────────
function FieldSingle({ q, value, onChange, lang = "fr" }: { q: Question; value: string; onChange: (v: string) => void; lang?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {(q.options ?? []).map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: "11px 14px", borderRadius: 9, textAlign: "left", fontSize: 14,
            border: `1.5px solid ${value === opt.value ? "#0b6b67" : "#dde8e5"}`,
            background: value === opt.value ? "#f0faf8" : "#fff",
            color: value === opt.value ? "#0b6b67" : "#0f1f1e",
            fontWeight: value === opt.value ? 600 : 400,
            cursor: "pointer", transition: "all 120ms",
          }}
        >
          {lang === "en" ? opt.en : opt.fr}
        </button>
      ))}
    </div>
  );
}

// ── Champ MULTI_CHOICE ────────────────────────────────────────────────────
function FieldMulti({ q, value, onChange, lang = "fr" }: { q: Question; value: string[]; onChange: (v: string[]) => void; lang?: string }) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {(q.options ?? []).map(opt => {
        const checked = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            style={{
              padding: "11px 14px", borderRadius: 9, textAlign: "left", fontSize: 14,
              border: `1.5px solid ${checked ? "#0b6b67" : "#dde8e5"}`,
              background: checked ? "#f0faf8" : "#fff",
              color: checked ? "#0b6b67" : "#0f1f1e",
              cursor: "pointer", transition: "all 120ms",
              display: "flex", alignItems: "center", gap: 10,
            }}
          >
            <span style={{
              width: 16, height: 16, borderRadius: 4, flexShrink: 0,
              border: `1.5px solid ${checked ? "#0b6b67" : "#dde8e5"}`,
              background: checked ? "#0b6b67" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {checked && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
            </span>
            {lang === "en" ? opt.en : opt.fr}
          </button>
        );
      })}
    </div>
  );
}

// ── Champ TEXT ────────────────────────────────────────────────────────────
function FieldText({ q, value, onChange, onConfirm }: { q: Question; value: string; onChange: (v: string) => void; onConfirm: () => void }) {
  return (
    <div>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && value.trim()) onConfirm(); }}
        placeholder={q.placeholder ?? ""}
        autoFocus
        style={{
          width: "100%", padding: "11px 13px", borderRadius: 9, fontSize: 14,
          border: "1.5px solid #dde8e5", outline: "none", marginBottom: 10,
          boxSizing: "border-box", transition: "border-color 150ms",
        }}
        onFocus={e => (e.target.style.borderColor = "#0b6b67")}
        onBlur={e => (e.target.style.borderColor = "#dde8e5")}
      />
      <button
        onClick={onConfirm} disabled={!value.trim()}
        style={{
          width: "100%", padding: "11px 0", borderRadius: 9, fontSize: 14, fontWeight: 600,
          background: value.trim() ? "#0b6b67" : "#edf2f0",
          color: value.trim() ? "#fff" : "#a0b4b0",
          border: "none", cursor: "pointer",
        }}
      >
        Continuer
      </button>
    </div>
  );
}

// ── Champ MONEY ───────────────────────────────────────────────────────────
function FieldMoney({ value, onChange, onConfirm }: { value: string; onChange: (v: string) => void; onConfirm: () => void }) {
  return (
    <div>
      <div style={{
        display: "flex", border: "1.5px solid #dde8e5", borderRadius: 9, overflow: "hidden", marginBottom: 10,
      }}>
        <span style={{
          padding: "11px 13px", background: "#f7f9f8", fontWeight: 700,
          color: "#526865", fontSize: 14, borderRight: "1px solid #dde8e5",
        }}>$</span>
        <input
          type="number" value={value} onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onConfirm(); }}
          placeholder="0,00" min={0} step="0.01" autoFocus
          style={{ flex: 1, padding: "11px 13px", border: "none", fontSize: 14, outline: "none", background: "transparent" }}
        />
      </div>
      <button
        onClick={onConfirm}
        style={{
          width: "100%", padding: "11px 0", borderRadius: 9, fontSize: 14, fontWeight: 600,
          background: "#0b6b67", color: "#fff", border: "none", cursor: "pointer",
        }}
      >
        Confirmer
      </button>
    </div>
  );
}

// ── Champ NUMBER ──────────────────────────────────────────────────────────
function FieldNumber({ q, value, onChange, onConfirm }: { q: Question; value: string; onChange: (v: string) => void; onConfirm: () => void }) {
  return (
    <div>
      <input
        type="number" value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && value) onConfirm(); }}
        placeholder={q.placeholder ?? "0"} min={0} autoFocus
        style={{
          width: "100%", padding: "11px 13px", borderRadius: 9, fontSize: 14,
          border: "1.5px solid #dde8e5", outline: "none", marginBottom: 10, boxSizing: "border-box",
        }}
        onFocus={e => (e.target.style.borderColor = "#0b6b67")}
        onBlur={e => (e.target.style.borderColor = "#dde8e5")}
      />
      <button
        onClick={onConfirm} disabled={!value}
        style={{
          width: "100%", padding: "11px 0", borderRadius: 9, fontSize: 14, fontWeight: 600,
          background: value ? "#0b6b67" : "#edf2f0",
          color: value ? "#fff" : "#a0b4b0",
          border: "none", cursor: "pointer",
        }}
      >
        Continuer
      </button>
    </div>
  );
}

// ── Champ DATE ────────────────────────────────────────────────────────────
function FieldDate({ value, onChange, onConfirm }: { value: string; onChange: (v: string) => void; onConfirm: () => void }) {
  return (
    <div>
      <input
        type="date" value={value} onChange={e => onChange(e.target.value)} autoFocus
        style={{
          width: "100%", padding: "11px 13px", borderRadius: 9, fontSize: 14,
          border: "1.5px solid #dde8e5", outline: "none", marginBottom: 10, boxSizing: "border-box",
        }}
        onFocus={e => (e.target.style.borderColor = "#0b6b67")}
        onBlur={e => (e.target.style.borderColor = "#dde8e5")}
      />
      <button
        onClick={onConfirm} disabled={!value}
        style={{
          width: "100%", padding: "11px 0", borderRadius: 9, fontSize: 14, fontWeight: 600,
          background: value ? "#0b6b67" : "#edf2f0",
          color: value ? "#fff" : "#a0b4b0",
          border: "none", cursor: "pointer",
        }}
      >
        Continuer
      </button>
    </div>
  );
}

// ── Champ ADDRESS ─────────────────────────────────────────────────────────
function FieldAddress({ required = false, initialValue, onConfirm }: { required?: boolean; initialValue?: string; onConfirm: (value: string) => void }) {
  const labels = ["Numéro et rue", "Appartement (optionnel)", "Ville", "Province / Territoire", "Code postal"];
  const [values, setValues] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(initialValue ?? "");
      return Array.isArray(parsed) ? parsed : [initialValue ?? "", "", "", "", ""];
    } catch { return [initialValue ?? "", "", "", "", ""]; }
  });
  const complete = Boolean(values[0]?.trim() && values[2]?.trim() && values[3]?.trim() && values[4]?.trim());
  return (
    <div>
      {labels.map((label, i) => (
        <input
          key={i} type="text" placeholder={label} value={values[i] ?? ""}
          onChange={e => setValues(current => current.map((v, index) => index === i ? e.target.value : v))}
          style={{ width: "100%", padding: "10px 13px", borderRadius: 9, fontSize: 13, border: "1.5px solid #dde8e5", outline: "none", marginBottom: 8, boxSizing: "border-box" }}
          onFocus={e => (e.target.style.borderColor = "#0b6b67")}
          onBlur={e => (e.target.style.borderColor = "#dde8e5")}
        />
      ))}
      <button
        onClick={() => onConfirm(JSON.stringify(values))}
        disabled={required && !complete}
        style={{ width: "100%", padding: "11px 0", borderRadius: 9, fontSize: 14, fontWeight: 600, background: required && !complete ? "#edf2f0" : "#0b6b67", color: required && !complete ? "#a0b4b0" : "#fff", border: "none", cursor: required && !complete ? "not-allowed" : "pointer", marginTop: 4 }}
      >
        Confirmer l&apos;adresse {required ? "(obligatoire)" : ""}
      </button>
    </div>
  );
}
// ── Champ PERSON ─────────────────────────────────────────────────────────
function FieldPerson({ q, onConfirm }: { q: Question; onConfirm: () => void }) {
  return (
    <div>
      {q.hint && <p style={{ fontSize: 12, color: "#7a9c97", marginBottom: 10, lineHeight: 1.4 }}>{q.hint}</p>}
      {["Nom complet", "NAS (optionnel)", "Date de naissance", "Revenu net 2025 ($)"].map((label, i) => (
        <input
          key={i} type={i === 2 ? "date" : i === 3 ? "number" : "text"} placeholder={label}
          style={{
            width: "100%", padding: "10px 13px", borderRadius: 9, fontSize: 13,
            border: "1.5px solid #dde8e5", outline: "none", marginBottom: 8, boxSizing: "border-box",
          }}
          onFocus={e => (e.target.style.borderColor = "#0b6b67")}
          onBlur={e => (e.target.style.borderColor = "#dde8e5")}
        />
      ))}
      <button
        onClick={onConfirm}
        style={{
          width: "100%", padding: "11px 0", borderRadius: 9, fontSize: 14, fontWeight: 600,
          background: "#0b6b67", color: "#fff", border: "none", cursor: "pointer", marginTop: 4,
        }}
      >
        Ajouter
      </button>
    </div>
  );
}

// ── Composant section Documents — upload inline + pipeline OCR ──────────────
function DocumentUploadSection({
  lang, ocrSlips, onPipelineDone,
}: {
  lang: string;
  ocrSlips: Array<{ typeCode: string; typeName: string | null; fields: Array<{ code: string; label: string | null; value: string | null }> }>;
  onPipelineDone: (newAnswers: Record<string, unknown>) => void;
}) {
  const T = (fr: string, en: string) => lang === "en" ? en : fr;

  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<"idle"|"uploading"|"ocr"|"done"|"error">("idle");
  const [lastFile, setLastFile] = useState<string>("");
  const [entries, setEntries] = useState(0);
  const [error, setError] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");

  const DOC_QUICK = [
    { code: "AUTO", label: T("Auto", "Auto"), desc: T("Détection automatique", "Automatic detection") },
    { code: "T4",   label: "T4",   desc: T("Rémunération d'emploi","Employment income") },
    { code: "RL-1", label: "RL-1", desc: T("Relevé 1 (Québec)","RL-1 (Quebec)") },
    { code: "T4A",  label: "T4A",  desc: T("Pension, retraite ou honoraires","Pension, retirement or fees") },
    { code: "T4E",  label: "T4E",  desc: T("Assurance-emploi","Employment insurance") },
    { code: "T5",   label: "T5",   desc: T("Placements","Investments") },
    { code: "REER", label: "REER", desc: T("Cotisation REER","RRSP contribution") },
    { code: "OTHER",label: T("Autre","Other"), desc: T("Autre document fiscal","Other tax doc") },
  ];

  const handleFile = async (file: File, typeCode: string) => {
    setUploading(true);
    setLastFile(file.name);
    setStep("uploading");
    setError("");

    try {
      // Upload
      const form = new FormData();
      form.append("file", file);
      form.append("documentTypeCode", typeCode);
      const upRes = await fetch("/api/documents/upload", { method: "POST", body: form });
      const upText = await upRes.text();
      const upData = (upText ? JSON.parse(upText) : {}) as { id?: string; existingDocumentId?: string; taxReturnId?: string; error?: string; message?: string };
      if (!upRes.ok) {
        if (upData.error !== "duplicate_detected") throw new Error(upData.message ?? upData.error ?? "Erreur upload");
      }
      const documentId = upData.id ?? upData.existingDocumentId;
      if (!documentId) throw new Error("Le serveur n’a pas retourné l’identifiant du document. Veuillez réessayer.");

      // OCR
      setStep("ocr");
      const processRes = await fetch(`/api/documents/${documentId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear: 2025 }),
      });
      const processText = await processRes.text();
      const processData = (processText ? JSON.parse(processText) : {}) as { status?: string; error?: string; detectedType?: string };
      if (!processRes.ok || processData.status === "failed") {
        throw new Error(processData.error ?? "Échec du traitement OCR");
      }
      if (processData.status === "rejected") {
        setReviewUrl(`/documents/${documentId}/extraction`);
        setStep("error");
        setError(T(`Le document a été rejeté : le type prouvé est ${processData.detectedType ?? "inconnu"}. Aucun montant n’a été ajouté.`, `Document rejected: the proven type is ${processData.detectedType ?? "unknown"}. No amount was added.`));
        return;
      }

      setStep("done");
      setEntries(0);
      setReviewUrl(`/documents/${documentId}/extraction`);

    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setUploading(false);
    }
  };

  const pickFile = (typeCode: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.jpg,.jpeg,.png,.heic,.webp";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file, typeCode);
    };
    input.click();
  };

  return (
    <div>
      {/* Feuillets déjà extraits */}
      {ocrSlips.filter(s => s.typeCode !== "OTHER" && s.fields.some(f => f.value && f.value.trim() !== "" && f.value !== "—")).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9fd4cc", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            ✓ {T("Feuillets déjà traités","Slips already processed")}
          </div>
          {ocrSlips.filter(slip =>
            slip.typeCode !== "OTHER" &&
            slip.fields.some(f => f.value && f.value !== "—" && f.value.trim() !== "")
          ).map((slip, i) => (
            <div key={i} style={{ background: "rgba(11,107,103,0.04)", border: "1px solid rgba(11,107,103,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: slip.fields.length > 0 ? 8 : 0 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#0b6b67", background: "rgba(11,107,103,0.1)", padding: "1px 7px", borderRadius: 5, marginRight: 6 }}>
                    {slip.typeCode}
                  </span>
                  <span style={{ fontSize: 12, color: "#526865" }}>{slip.typeName ?? slip.typeCode}</span>
                </div>
                <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>✓ {T("Extrait","Extracted")}</span>
              </div>
              {slip.fields.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 5 }}>
                  {slip.fields.slice(0, 6).map(f => (
                    <div key={f.code} style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 7, padding: "5px 8px" }}>
                      <div style={{ fontSize: 9, color: "#9fd4cc", textTransform: "uppercase", fontWeight: 700 }}>{f.label ?? f.code}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#0f1f1e", fontFamily: "monospace" }}>{f.value ?? "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pipeline en cours */}
      {step !== "idle" && step !== "done" && step !== "error" && (
        <div style={{ background: "#fff", border: "1px solid #b6ddd6", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#0b6b67", fontWeight: 600, marginBottom: 6 }}>
            📄 {lastFile}
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {(["uploading","ocr","done"] as const).map((s, i) => (
              <div key={s} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", margin: "0 auto 3px", background: step === s ? "#0b6b67" : i < (["uploading","ocr","done"]).indexOf(step) ? "#0b6b67" : "#e5ede9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>
                  {i < (["uploading","ocr","done"]).indexOf(step) ? "✓" : i+1}
                </div>
                <div style={{ fontSize: 9, color: step === s ? "#0b6b67" : "#a0b4b0" }}>
                  {s === "uploading" ? T("Upload","Upload") : s === "ocr" ? "OCR" : T("Sync","Sync")}
                </div>
              </div>
            ))}
          </div>
          <div style={{ height: 3, background: "#e5ede9", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: step === "uploading" ? "33%" : step === "ocr" ? "66%" : "100%", background: "#0b6b67", borderRadius: 3, transition: "width 500ms" }} />
          </div>
        </div>
      )}

      {step === "done" && (
        <div style={{ background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.25)", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#059669", fontWeight: 600 }}>
          ✓ {lastFile} — {T("analyse terminée. Confirmez les valeurs avant toute intégration au calcul.","analysis complete. Confirm values before anything is added to the calculation.")}
          {reviewUrl && <a href={reviewUrl} style={{ display: "inline-block", marginLeft: 8, color: "#0b6b67", textDecoration: "underline", fontWeight: 700 }}>{T("Vérifier maintenant →","Review now →")}</a>}
        </div>
      )}

      {step === "error" && (
        <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#dc2626" }}>
          ⚠ {error}
          {reviewUrl && <a href={reviewUrl} style={{ display: "inline-block", marginLeft: 8, color: "#b91c1c", textDecoration: "underline", fontWeight: 700 }}>{T("Voir le détail →", "View details →")}</a>}
        </div>
      )}

      {/* Boutons upload rapide */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        {DOC_QUICK.map(t => (
          <button key={t.code} onClick={() => pickFile(t.code)} disabled={uploading}
            style={{ padding: "10px 12px", borderRadius: 10, textAlign: "left", background: "#fff", border: "1px solid #dde8e5", cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.5 : 1 }}
            onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLButtonElement).style.borderColor = "#9fd4cc"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#dde8e5"; }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#0b6b67", marginBottom: 2 }}>{t.label}</div>
            <div style={{ fontSize: 11, color: "#526865" }}>{t.desc}</div>
          </button>
        ))}
      </div>

      <p style={{ fontSize: 11, color: "#a0b4b0", textAlign: "center", marginTop: 10 }}>
        {T("PDF, JPG, PNG · Les données OCR ne seront ajoutées qu’après votre validation.",
           "PDF, JPG, PNG · OCR data is added only after your validation.")}
      </p>
    </div>
  );
}

// ── MIGRATION v2: vider immédiatement les brouillons v1 ─────
// S'exécute une seule fois au chargement du module, avant tout render
if (typeof window !== "undefined") {
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("easytax_draft_")) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const p = JSON.parse(raw) as { version?: number };
          if (!p.version || p.version < 3) toDelete.push(k);
        }
      }
    }
    toDelete.forEach(k => localStorage.removeItem(k));
  } catch { /* silencieux */ }
}

// ── PAGE PRINCIPALE ────────────────────────────────────────────────────────
export default function QuestionnairePage() {
  const router = useRouter();
  const { lang } = useApp();
  const [answers,    setAnswers]    = useState<Record<string, unknown>>({});
  const [ocrAnswers, setOcrAnswers] = useState<Record<string, unknown>>({});
  const [ocrSlips,   setOcrSlips]   = useState<Array<{ typeCode: string; typeName: string | null; fields: Array<{ code: string; label: string | null; value: string | null }> }>>([]);
  const [ocrLoaded,  setOcrLoaded]  = useState(false);
  const [textVal,  setTextVal]    = useState("");
  const [numVal,   setNumVal]     = useState("");
  const [dateVal,  setDateVal]    = useState("");
  const [multiVal, setMultiVal]   = useState<string[]>([]);
  const [secIdx,   setSecIdx]     = useState(0);
  const [qIdx,     setQIdx]       = useState(0);
  const [saving,     setSaving]     = useState(false);
  const [done,       setDone]       = useState(false);
  const [lastSaved,  setLastSaved]  = useState<string>("");
  const [userId,     setUserId]     = useState<string>("guest");
  const [profileProvince, setProfileProvince] = useState<ProvinceCode | null>(null);
  const TAX_YEAR = "2025";
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Charger l'user ID
  useEffect(() => {
    fetch("/api/user/me").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.id) setUserId(d.id);
    }).catch(() => {});
    fetch("/api/profile").then(r => r.ok ? r.json() : null).then(d => {
      const province = normalizeProvinceCode(d?.fiscalResidence) ?? normalizeProvinceCode(d?.province);
      if (province) setProfileProvince(province);
      if (!d) return;
      setAnswers(prev => ({
        ...prev,
        ...(d.lastName ? { p1: d.lastName } : {}),
        ...(d.firstName ? { p2: d.firstName } : {}),
        ...(d.dateOfBirth ? { p4: String(d.dateOfBirth).slice(0, 10) } : {}),
        ...(d.address || d.city || d.province || d.postalCode ? {
          p5: JSON.stringify([d.address ?? "", "", d.city ?? "", province ?? "", d.postalCode ?? ""]),
        } : {}),
        ...(d.phone ? { p7: d.phone } : {}),
        ...(d.email ? { p8: d.email } : {}),
        ...(province ? { p14: province, profil_province: province, province } : {}),
      }));
    }).catch(() => {});
  }, []);

  // Charger le brouillon au démarrage
  useEffect(() => {
    if (userId === "guest") return;

    // ── MIGRATION v2: effacer tous les brouillons v1 (ancien workflow) ──
    // Nouveau workflow: triage→profil→famille→revenus→déductions→crédits→province→déclaration
    // L'ancien workflow (documents séparé, emploi/autonome/location séparés) est invalide
    try {
      const keysToDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("easytax_draft_")) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw) as { version?: number };
            if (!parsed.version || parsed.version < 2) keysToDelete.push(k);
          }
        }
      }
      keysToDelete.forEach(k => localStorage.removeItem(k));
      if (keysToDelete.length > 0) console.log(`[draft] Migration v2: ${keysToDelete.length} ancien(s) brouillon(s) effacé(s)`);
    } catch { /* silencieux */ }

    const draft = loadDraftLocal(userId, TAX_YEAR);
    if (draft && draft.status === "in_progress" && Object.keys(draft.answers).length > 0) {
      setAnswers(draft.answers);
      if (draft.answers["t0"] === undefined) {
        setSecIdx(0);
        setQIdx(0);
      } else {
        setSecIdx(draft.sectionIdx);
        setQIdx(0);
      }
      setLastSaved(formatLastSaved(draft.lastSavedAt));
    }

    // 1. Profil depuis le compte (nom, province, état civil...)
    fetch("/api/profile-prefill")
      .then(r => r.ok ? r.json() : null)
      .then((d: { answers?: Record<string, unknown> } | null) => {
        if (d?.answers) setAnswers(prev => ({ ...d.answers, ...prev }));
      }).catch(() => {});

    // 2. Données OCR (montants des feuillets déjà uploadés)
    fetch("/api/ocr-prefill")
      .then(r => r.ok ? r.json() : null)
      .then((d: { answers?: Record<string, unknown>; slips?: typeof ocrSlips } | null) => {
        if (!d) return;
        if (d.answers && Object.keys(d.answers).length > 0) {
          setOcrAnswers(d.answers);
          // OCR > profil, mais brouillon local > tout
          setAnswers(prev => ({ ...d.answers, ...prev }));
        }
        if (d.slips) setOcrSlips(d.slips);
        setOcrLoaded(true);
      })
      .catch(() => setOcrLoaded(true));
  }, [userId]);

  // Redirect non-INDIVIDUAL
  useEffect(() => {
    fetch("/api/user/me").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.role && !["INDIVIDUAL"].includes(d.role)) {
        const map: Record<string, string> = { ADMIN: "/admin", SUPER_ADMIN: "/admin", BUSINESS: "/business", PREPARER: "/preparer" };
        router.replace(map[d.role] ?? "/dashboard");
      }
    }).catch(() => {});
  }, [router]);

  // Priorité fiscale : résidence au 31 décembre, puis adresse du profil, puis réponse du client.
  const userProvince = profileProvince ??
                       normalizeProvinceCode(answers["p14"]) ??
                       normalizeProvinceCode(answers["q1"]) ??
                       normalizeProvinceCode(answers["taxProvince"]) ??
                       normalizeProvinceCode(answers["province"]) ??
                       normalizeProvinceCode(answers["profil_province"]);

  // Une province inconnue n'autorise jamais l'affichage des questions de toutes les provinces.
  const isQuestionApplicable = (question: Question) =>
    !question.provinceOnly || (userProvince !== null && question.provinceOnly.includes(userProvince));

  // Sections visibles (triage caché)
  const visibleSections = INDIVIDUAL_SECTIONS.filter(s =>
    s.code !== "triage" && ((s as { alwaysShow?: boolean }).alwaysShow || evalCond((s as { showIf?: string }).showIf, answers))
  );

  const currentSection = visibleSections[secIdx];

  // Questions visibles dans la section courante (incluant triage en arrière-plan)
  const ALL_QUESTIONS = getAllQuestionsWithProvince();
  const allApplicable = ALL_QUESTIONS.filter(q => evalCond(q.showIf, answers) && isQuestionApplicable(q));
  const sectionQs = ALL_QUESTIONS
    .filter(q => (q.section === currentSection?.code || q.section === "triage") && evalCond(q.showIf, answers) && isQuestionApplicable(q))
    .sort((a, b) => a.order - b.order);

  // Questions de la section courante seulement (pas triage)
  const curSectionQs = ALL_QUESTIONS
    .filter(q => q.section === currentSection?.code && answers[q.id] === undefined && evalCond(q.showIf, answers) && isQuestionApplicable(q))
    .sort((a, b) => a.order - b.order);

  // Si on est au début, montrer triage d'abord
  const triageQs = ALL_INDIVIDUAL_QUESTIONS.filter(q => q.section === "triage").sort((a, b) => a.order - b.order);
  const triageDone = triageQs.every(q => answers[q.id] !== undefined);

  // Questions à afficher : triage si pas fini, sinon section courante
  const displayQs = !triageDone ? triageQs : curSectionQs;
  const currentQ: Question | undefined = displayQs[qIdx];

  // COMPTEURS UNIFIÉS — même source que sectionProgress
  // Triage: toujours affiché (6 questions)
  const triageApplicable = triageQs.length;
  // Sections visibles seulement, questions filtrées par province + conditions
  const visibleSectionCodes = new Set(visibleSections.map(s => s.code));
  const sectionApplicable = ALL_QUESTIONS.filter(q =>
    q.section !== "triage" &&
    visibleSectionCodes.has(q.section) &&
    evalCond(q.showIf, answers) &&
    isQuestionApplicable(q)
  ).length;
  const totalApplicable = triageApplicable + sectionApplicable;
  // totalAnswered: compter seulement les réponses aux questions applicables
  const applicableIds = new Set([
    ...triageQs.map(q => q.id),
    ...ALL_QUESTIONS.filter(q =>
      q.section !== "triage" &&
      visibleSectionCodes.has(q.section) &&
      evalCond(q.showIf, answers) &&
      isQuestionApplicable(q)
    ).map(q => q.id),
  ]);
  const totalAnswered = Object.keys(answers).filter(id => applicableIds.has(id)).length;
  const globalPct = totalApplicable > 0 ? Math.min(99, Math.round((totalAnswered / totalApplicable) * 100)) : 0;

  // Progression par section (sans triage)
  // Progression triage en premier
  const triageProgress = {
    code: "triage", fr: "Triage", en: "Triage", icon: "🧭",
    total: triageQs.length,
    answered: triageQs.filter(q => answers[q.id] !== undefined).length,
    pct: triageQs.length > 0 ? Math.round((triageQs.filter(q => answers[q.id] !== undefined).length / triageQs.length) * 100) : 0,
  };

  // SOURCE UNIQUE pour tous les compteurs: getAllQuestionsWithProvince() filtré par province + conditions
  const sectionProgress = [triageProgress, ...visibleSections.map(s => {
    const sQs = ALL_QUESTIONS.filter(q =>
      q.section === s.code &&
      evalCond(q.showIf, answers) &&
      isQuestionApplicable(q)
    );
    const answered = sQs.filter(q => answers[q.id] !== undefined).length;
    return { code: s.code, fr: s.fr, en: s.en, icon: s.icon, total: sQs.length, answered, pct: sQs.length > 0 ? Math.round((answered / sQs.length) * 100) : 0 };
  })];

  const resetInput = () => { setTextVal(""); setNumVal(""); setDateVal(""); setMultiVal([]); };

  const saveAndNext = useCallback(async (qId: string, value: unknown) => {
    const newAnswers = { ...answers, [qId]: value };
    setAnswers(newAnswers);
    setSaving(true);
    resetInput();

    // Sauvegarder le brouillon localement
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveDraftLocal(userId, TAX_YEAR, {
        answers: newAnswers,
        sectionIdx: secIdx,
        questionIdx: qIdx + 1,
        triageDone: triageQs.every(q => newAnswers[q.id] !== undefined),
      });
      setLastSaved("À l'instant");
    }, 500);

    try {
      await fetch("/api/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionCode: qId, answerValue: String(value), taxReturnId: "current", taxYearId: "2025" }),
      });
    } catch { /* silencieux */ }
    setSaving(false);

    // Recalculer les questions après la réponse
    const newTriageDone = triageQs.every(q => newAnswers[q.id] !== undefined);
    const newDisplayQs = !newTriageDone ? triageQs
      : ALL_INDIVIDUAL_QUESTIONS.filter(q => q.section === currentSection?.code && newAnswers[q.id] === undefined && evalCond(q.showIf, newAnswers) && isQuestionApplicable(q)).sort((a, b) => a.order - b.order);

    const currentQPos = newDisplayQs.findIndex(q => q.id === qId);
    const nextIdx = currentQPos + 1;

    if (nextIdx < newDisplayQs.length) {
      setQIdx(nextIdx);
    } else if (newTriageDone) {
      // Passer à la section suivante
      const newVisibleSecs = INDIVIDUAL_SECTIONS.filter(s =>
        s.code !== "triage" && ((s as { alwaysShow?: boolean }).alwaysShow || evalCond((s as { showIf?: string }).showIf, newAnswers))
      );
      const nextSecIdx = secIdx + 1;
      if (nextSecIdx < newVisibleSecs.length) {
        setSecIdx(nextSecIdx);
        setQIdx(0);
      } else {
        setDone(true);
      }
    }
  }, [answers, triageQs, currentSection, secIdx]);

  const handleBack = () => {
    if (qIdx > 0) { setQIdx(i => i - 1); resetInput(); }
    else if (secIdx > 0) { setSecIdx(s => s - 1); setQIdx(0); resetInput(); }
  };

  // ── ÉCRAN FIN ────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ background: "#f7f9f8", minHeight: "100vh" }}>
        <NavClient />
        <div style={{ maxWidth: 580, margin: "0 auto", padding: "32px 16px" }}>
          <div style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 16, padding: "32px 24px", textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22 }}>✓</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f1f1e", margin: "0 0 6px" }}>Questionnaire terminé</h1>
            <p style={{ color: "#526865", fontSize: 14, margin: "0 0 20px" }}>{totalAnswered} réponses enregistrées</p>
            <p style={{ fontSize: 12, color: "#a0b4b0", background: "#f7f9f8", borderRadius: 8, padding: "10px 14px", marginBottom: 20, lineHeight: 1.5 }}>
              Résultats préliminaires — aucune déclaration transmise sans votre validation.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => router.push("/dossier")} style={{
                flex: 1, padding: "12px 0", borderRadius: 9, fontSize: 13, fontWeight: 700,
                background: "#0b6b67", color: "#fff", border: "none", cursor: "pointer",
              }}>
                Mes documents →
              </button>
              <button onClick={() => { setDone(false); setSecIdx(0); setQIdx(0); }} style={{
                padding: "12px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                background: "#fff", color: "#526865", border: "1px solid #dde8e5", cursor: "pointer",
              }}>
                Réviser
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── VUE PRINCIPALE ────────────────────────────────────────────────────────
  return (
    <div style={{ background: "#f7f9f8", minHeight: "100vh" }}>
      <NavClient />

      <div style={{ maxWidth: 580, margin: "0 auto", padding: "20px 16px 80px" }}>

        {/* ── Progression globale ───────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#526865", marginBottom: 5 }}>
            <span>
              {!triageDone
                ? "Quelques questions rapides pour commencer"
                : `${currentSection?.icon ?? ""} ${lang === "en" ? (currentSection?.en ?? "") : (currentSection?.fr ?? "")} — ${lang === "en" ? "Tax Return 2025" : "Déclaration 2025"}`}
            </span>
            <span style={{ fontWeight: 700, color: "#0b6b67" }}>{globalPct}%</span>
          </div>
          <div style={{ height: 3, background: "#dde8e5", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${globalPct}%`, background: "#0b6b67", borderRadius: 3, transition: "width 400ms ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
            <span style={{ fontSize: 11, color: "#a0b4b0" }}>
              {totalAnswered} / {totalApplicable} questions
            </span>
            {lastSaved && (
              <span style={{ fontSize: 11, color: "#9fd4cc" }}>
                💾 {lastSaved}
              </span>
            )}
          </div>
        </div>

        {/* ── Onglets scrollables — triage + sections ────────── */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 14, scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <button
            onClick={() => { setSecIdx(0); setQIdx(0); resetInput(); }}
            style={{
              flexShrink: 0, padding: "5px 12px", borderRadius: 8, fontSize: 12,
              fontWeight: !triageDone ? 700 : 400, cursor: "pointer",
              background: !triageDone ? "#0b6b67" : triageProgress.pct === 100 ? "#f0faf8" : "#fff",
              color: !triageDone ? "#fff" : triageProgress.pct === 100 ? "#0b6b67" : "#526865",
              border: `1px solid ${!triageDone ? "#0b6b67" : triageProgress.pct === 100 ? "#9fd4cc" : "#dde8e5"}`,
              whiteSpace: "nowrap",
            }}
          >
            🧭 Triage {triageProgress.answered}/{triageProgress.total}{triageDone ? " ✓" : ""}
          </button>
          {visibleSections.map((s, i) => {
            const sp = sectionProgress.find(x => x.code === s.code);
            const active = triageDone && i === secIdx;
            const complete = (sp?.pct ?? 0) === 100 && (sp?.total ?? 0) > 0;
            return (
              <button
                key={s.code}
                onClick={() => { if (triageDone) { setSecIdx(i); setQIdx(0); resetInput(); } }}
                style={{
                  flexShrink: 0, padding: "5px 12px", borderRadius: 8, fontSize: 12,
                  fontWeight: active ? 700 : 400,
                  cursor: triageDone ? "pointer" : "default",
                  opacity: triageDone ? 1 : 0.4,
                  background: active ? "#0b6b67" : complete ? "#f0faf8" : "#fff",
                  color: active ? "#fff" : complete ? "#0b6b67" : "#526865",
                  border: `1px solid ${active ? "#0b6b67" : complete ? "#9fd4cc" : "#dde8e5"}`,
                  whiteSpace: "nowrap",
                }}
              >
                {s.icon} {s.fr}{sp && sp.total > 0 ? ` ${sp.answered}/${sp.total}` : ""}{complete && !active ? " ✓" : ""}
              </button>
            );
          })}
        </div>

        {/* ── ÉTAPE 4: REVENUS — upload OCR inline ─────────────── */}
        {triageDone && currentSection?.code === "revenus" && qIdx === 0 && (
          <div style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 14, padding: "20px 16px", marginBottom: 12, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #dde8e5" }}>
              <span style={{ fontSize: 24 }}>💰</span>
              <div>
                <div style={{ fontFamily: "Georgia,serif", fontSize: 16, fontWeight: 700, color: "#0f1f1e" }}>
                  {lang === "en" ? "Step 4 — Income" : "Étape 4 — Revenus"}
                </div>
                <div style={{ fontSize: 11, color: "#7a9c97", marginTop: 2 }}>
                  {lang === "en"
                    ? "Upload your T4/RL-1/T5... slips. OCR extracts the amounts. Then answer the complementary questions."
                    : "Uploadez vos feuillets T4/RL-1/T5... L'OCR extrait les montants. Répondez ensuite aux questions complémentaires."}
                </div>
              </div>
            </div>

            {/* Upload + OCR */}
            <DocumentUploadSection
              lang={lang}
              ocrSlips={ocrSlips}
              onPipelineDone={(newAnswers) => {
                setAnswers(prev => ({ ...newAnswers, ...prev }));
                setOcrAnswers(prev => ({ ...prev, ...newAnswers }));
              }}
            />

            {/* Bouton passer aux questions complémentaires */}
            <button
              onClick={() => setQIdx(1)}
              style={{ width: "100%", marginTop: 14, padding: "12px 0", borderRadius: 9, fontSize: 14, fontWeight: 700, background: "#0b6b67", color: "#fff", border: "none", cursor: "pointer" }}>
              {ocrSlips.filter(s => s.typeCode !== "OTHER" && s.fields.some(f => f.value && f.value.trim() !== "" && f.value !== "—")).length > 0
                ? (lang === "en" ? "Slips validated → answer complementary questions" : "Feuillets validés → répondre aux questions complémentaires")
                : (lang === "en" ? "No slips → continue to questions" : "Sans feuillets → continuer aux questions")}
            </button>
          </div>
        )}

        {/* ── Carte question ───────────────────────────────────── */}
        {(triageDone ? (currentSection?.code !== "revenus" || qIdx > 0) : true) && currentQ ? (
          <div style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 14, padding: "22px 20px", boxShadow: "0 1px 8px rgba(0,0,0,0.04)", marginBottom: 12 }}>

            {/* Indicateur */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#9fd4cc", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {!triageDone ? "Triage" : (currentSection?.fr ?? "")}
                {currentQ.required && <span style={{ color: "#dc2626", marginLeft: 3 }}>*</span>}
              </span>
              <span style={{ fontSize: 11, color: "#a0b4b0" }}>
                {qIdx + 1} / {displayQs.length}
              </span>
            </div>

            {/* Question */}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f1f1e", margin: "0 0 8px", lineHeight: 1.4 }}>
              {lang === "en" ? currentQ.en : currentQ.fr}
            </h2>
            {/* Badge OCR si la réponse vient de l'OCR */}
            {ocrAnswers[currentQ.id] !== undefined && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: "#0b6b67", background: "rgba(11,107,103,0.08)", border: "1px solid rgba(11,107,103,0.2)", borderRadius: 100, padding: "2px 8px", marginBottom: 8 }}>
                📄 {lang === "en" ? "Pre-filled from your slip" : "Pré-rempli depuis vos feuillets"}
              </div>
            )}

            {/* Hint */}
            {(lang === "en" ? (currentQ.hintEn ?? currentQ.hint) : currentQ.hint) && (
              <p style={{ fontSize: 12, color: "#7a9c97", margin: "0 0 16px", lineHeight: 1.5 }}>{lang === "en" ? (currentQ.hintEn ?? currentQ.hint) : currentQ.hint}</p>
            )}

            {/* Badge document requis */}
            {currentQ.documentRequired && currentQ.type !== "DOCUMENT" && (
              <div style={{
                display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#0b6b67",
                background: "#f0faf8", border: "1px solid #b6ddd6", borderRadius: 8,
                padding: "7px 12px", marginBottom: 14,
              }}>
                <span>📎</span> Document requis : <strong>{currentQ.documentRequired}</strong>
              </div>
            )}

            {/* Champ selon le type */}
            {currentQ.type === "BOOLEAN" && (
              <FieldBoolean
                value={answers[currentQ.id] === true ? true : answers[currentQ.id] === false ? false : null}
                onChange={v => saveAndNext(currentQ.id, v)}
              />
            )}
            {currentQ.type === "SINGLE_CHOICE" && (
              <FieldSingle q={currentQ} value={String(answers[currentQ.id] ?? "")} onChange={v => saveAndNext(currentQ.id, v)} />
            )}
            {currentQ.type === "MULTI_CHOICE" && (
              <div>
                <FieldMulti q={currentQ} value={multiVal} onChange={setMultiVal} />
                <button
                  onClick={() => { if (multiVal.length > 0) saveAndNext(currentQ.id, multiVal.join(",")); }}
                  disabled={multiVal.length === 0}
                  style={{
                    width: "100%", padding: "11px 0", borderRadius: 9, fontSize: 14, fontWeight: 600, marginTop: 12,
                    background: multiVal.length > 0 ? "#0b6b67" : "#edf2f0",
                    color: multiVal.length > 0 ? "#fff" : "#a0b4b0",
                    border: "none", cursor: "pointer",
                  }}
                >
                  Confirmer ({multiVal.length})
                </button>
              </div>
            )}
            {currentQ.type === "TEXT" && (
              <FieldText q={currentQ} value={textVal} onChange={setTextVal} onConfirm={() => { if (textVal.trim()) saveAndNext(currentQ.id, textVal.trim()); }} />
            )}
            {currentQ.type === "MONEY" && (
              <FieldMoney value={numVal} onChange={setNumVal} onConfirm={() => saveAndNext(currentQ.id, numVal || "0")} />
            )}
            {currentQ.type === "NUMBER" && (
              <FieldNumber q={currentQ} value={numVal} onChange={setNumVal} onConfirm={() => { if (numVal) saveAndNext(currentQ.id, numVal); }} />
            )}
            {currentQ.type === "DATE" && (
              <FieldDate value={dateVal} onChange={setDateVal} onConfirm={() => { if (dateVal) saveAndNext(currentQ.id, dateVal); }} />
            )}
            {currentQ.type === "ADDRESS" && (
              <FieldAddress
                required={currentQ.required}
                initialValue={typeof answers[currentQ.id] === "string" ? String(answers[currentQ.id]) : undefined}
                onConfirm={value => saveAndNext(currentQ.id, value)}
              />
            )}
            {currentQ.type === "PERSON" && (
              <FieldPerson q={currentQ} onConfirm={() => saveAndNext(currentQ.id, "personne_ajoutée")} />
            )}

            {/* Passer si optionnel */}
            {!currentQ.required && !["BOOLEAN", "SINGLE_CHOICE"].includes(currentQ.type) && (
              <button
                onClick={() => saveAndNext(currentQ.id, "skipped")}
                style={{
                  width: "100%", padding: "8px 0", borderRadius: 8, fontSize: 12, marginTop: 8,
                  background: "transparent", color: "#a0b4b0",
                  border: "1px dashed #dde8e5", cursor: "pointer",
                }}
              >
                Passer cette question
              </button>
            )}

            {saving && (
              <div style={{ textAlign: "center", fontSize: 11, color: "#9fd4cc", marginTop: 8 }}>
                Sauvegarde...
              </div>
            )}
          </div>
        ) : (
          currentSection?.code === "revenus" && !triageDone ? false : true ? (
            <div style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 14, padding: "28px 20px", textAlign: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 20, color: "#9fd4cc", marginBottom: 8 }}>✓</div>
              <p style={{ color: "#526865", fontSize: 14 }}>{lang === "en" ? "Section complete or not applicable." : "Section complète ou non applicable."}</p>
              <button
                onClick={() => {
                  const next = secIdx + 1;
                  if (next < visibleSections.length) { setSecIdx(next); setQIdx(0); }
                  else setDone(true);
                }}
                style={{ padding: "10px 22px", borderRadius: 9, fontSize: 13, fontWeight: 600, marginTop: 12, background: "#0b6b67", color: "#fff", border: "none", cursor: "pointer" }}
              >
                {lang === "en" ? "Next section →" : "Section suivante →"}
              </button>
            </div>
          ) : null
        )}

        {/* ── Navigation ───────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <button
            onClick={handleBack}
            disabled={secIdx === 0 && qIdx === 0}
            style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: "#fff", color: "#526865", border: "1px solid #dde8e5",
              cursor: "pointer", opacity: (secIdx === 0 && qIdx === 0) ? 0.4 : 1,
            }}
          >
            ← Précédent
          </button>
          <button
            onClick={() => router.push("/dossier")}
            style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, background: "transparent", color: "#a0b4b0", border: "none", cursor: "pointer" }}
          >
            Sauvegarder et quitter
          </button>
        </div>

        {/* ── Progression par section — toujours visible ─────── */}
        {sectionProgress.some(s => s.total > 0) && (
          <div style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#a0b4b0", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
              Progression
            </div>
            {sectionProgress.filter(s => s.total > 0).map(s => (
              <div key={s.code} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#526865", marginBottom: 3 }}>
                  <span>{s.icon} {lang === "en" ? s.en : s.fr}</span>
                  <span style={{ fontWeight: 600, color: s.pct === 100 ? "#059669" : "#526865" }}>
                    {s.answered}/{s.total}
                  </span>
                </div>
                <div style={{ height: 3, background: "#edf2f0", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${s.pct}%`, background: s.pct === 100 ? "#059669" : "#0b6b67", borderRadius: 3, transition: "width 300ms" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Triage en cours — afficher sa propre progression */}
        {!triageDone && (
          <div style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#a0b4b0", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
              Personnalisation
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#526865", marginBottom: 3 }}>
                <span>🧭 Questions de triage</span>
                <span style={{ fontWeight: 600, color: "#0b6b67" }}>{triageQs.filter(q => answers[q.id] !== undefined).length}/{triageQs.length}</span>
              </div>
              <div style={{ height: 3, background: "#edf2f0", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.round((triageQs.filter(q => answers[q.id] !== undefined).length / triageQs.length) * 100)}%`,
                  background: "#0b6b67", borderRadius: 3, transition: "width 300ms",
                }} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#a0b4b0" }}>
              Ces 6 questions permettent de personnaliser votre questionnaire.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
