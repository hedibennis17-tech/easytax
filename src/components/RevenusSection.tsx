"use client";
/**
 * RevenusSection.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Section Revenus du questionnaire EasyTax
 *
 * FLUX:
 *   idle → sélection type → upload → ocr → validation cases → résumé feuillets
 *   L'utilisateur peut ajouter autant de feuillets qu'il veut.
 *   Chaque feuillet passe par : upload → OCR → validation case par case → confirmé.
 *   Une fois tous les feuillets confirmés → Continuer aux questions complémentaires.
 *
 * DONNÉES:
 *   Le dictionnaire (28 feuillets, 368 cases) est chargé via /api/revenus/feuillets.
 *   Chaque case affiche : code, label_fr, valeur OCR, ligne T1/TP-1, notes.
 *   L'user peut modifier chaque montant avant de confirmer.
 */

import { useState, useCallback, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BoxResult {
  code: string;
  label_fr: string;
  label_en?: string;
  t1_line: string | null;
  tp1_line: string | null;
  rawValue: string | null;
  amountCents: number | null;
  amount: string | null;
  confidence: number;
  hasValue: boolean;
  isRequired: boolean;
  hasCondition: boolean;
  autoDeductionLine: string | null;
  includedIn: string | null;
  notes: string | null;
}

interface FeuilletResult {
  docId: string;
  typeCode: string;
  nameFr: string;
  filename: string;
  status: string;
  cases: BoxResult[];
  totalExtracted: number;
  totalCases: number;
}

type Phase =
  | "select_type"   // choisir le type de feuillet
  | "uploading"     // upload en cours
  | "ocr"           // OCR en cours
  | "validating"    // validation des cases
  | "confirmed"     // feuillet confirmé, prêt à en ajouter un autre
  | "summary"       // résumé de tous les feuillets
  | "error";

interface ActiveFeuillet {
  phase: Phase;
  typeCode: string;
  typeName: string;
  documentId: string | null;
  filename: string;
  cases: BoxResult[];       // cases extraites par OCR
  editedValues: Record<string, string>; // modifications de l'user
  progress: number;         // 0-100
  error: string;
}

// ─── Catalogue simplifié pour le sélecteur ────────────────────────────────────
const SLIP_CATALOG = [
  // Détection automatique — en premier
  { code: "AUTO",     group: "auto", label: "Détection auto", desc: "EasyTax identifie le type et prouve le feuillet avant extraction", icon: "🔍" },
  // Fédéraux principaux
  { code: "T4",       group: "fed", label: "T4",         desc: "Rémunération payée (emploi)", icon: "💼" },
  { code: "T4A",      group: "fed", label: "T4A",        desc: "Pension, retraite, rentes, honoraires", icon: "🏦" },
  { code: "T4A(OAS)", group: "fed", label: "T4A(OAS)",   desc: "Sécurité de la vieillesse (SV)", icon: "👴" },
  { code: "T4A(P)",   group: "fed", label: "T4A(P)",     desc: "Prestations RPC/RRQ", icon: "🏛️" },
  { code: "T4E",      group: "fed", label: "T4E",        desc: "Prestations d'assurance-emploi", icon: "🤝" },
  { code: "T4RSP",    group: "fed", label: "T4RSP",      desc: "Retraits REER", icon: "💰" },
  { code: "T4RIF",    group: "fed", label: "T4RIF",      desc: "Retraits FERR", icon: "💰" },
  { code: "T5",       group: "fed", label: "T5",         desc: "Revenus de placement (intérêts, dividendes)", icon: "📈" },
  { code: "T5007",    group: "fed", label: "T5007",      desc: "Indemnités (CNESST, assistance sociale)", icon: "🏥" },
  { code: "T3",       group: "fed", label: "T3",         desc: "Revenus de fiducie / fonds communs", icon: "📊" },
  { code: "T5008",    group: "fed", label: "T5008",      desc: "Opérations sur titres (gains en capital)", icon: "📉" },
  { code: "T2202",    group: "fed", label: "T2202",      desc: "Frais de scolarité", icon: "🎓" },
  { code: "RECU-REER",group: "fed", label: "Reçu REER",  desc: "Cotisation REER / CELIAPP", icon: "🏦" },
  { code: "T5013",    group: "fed", label: "T5013",      desc: "Revenus d'une société de personnes (partenariat)", icon: "🤝" },
  // Québec
  { code: "RL-1",     group: "qc",  label: "RL-1",       desc: "Revenus d'emploi (Québec)", icon: "⚜️" },
  { code: "RL-2",     group: "qc",  label: "RL-2",       desc: "Revenus de retraite et rentes (QC)", icon: "⚜️" },
  { code: "RL-3",     group: "qc",  label: "RL-3",       desc: "Revenus de placement (QC)", icon: "⚜️" },
  { code: "RL-5",     group: "qc",  label: "RL-5",       desc: "Prestations et indemnités CNESST (QC)", icon: "⚜️" },
  { code: "RL-8",     group: "qc",  label: "RL-8",       desc: "Frais de scolarité (QC)", icon: "⚜️" },
  { code: "RL-16",    group: "qc",  label: "RL-16",      desc: "Revenus de fiducie (QC)", icon: "⚜️" },
  { code: "RL-24",    group: "qc",  label: "RL-24",      desc: "Frais de garde d'enfants (QC)", icon: "⚜️" },
  { code: "RL-31",    group: "qc",  label: "RL-31",      desc: "Occupation d'un logement (QC)", icon: "⚜️" },
  { code: "RL-6",     group: "qc",  label: "RL-6",       desc: "Régime québécois d'assurance parentale (RQAP autonome)", icon: "⚜️" },
  { code: "RL-15",    group: "qc",  label: "RL-15",      desc: "Revenus d'une société de personnes (QC)", icon: "⚜️" },
  { code: "RL-22",    group: "qc",  label: "RL-22",      desc: "Revenu d'emploi — assurance-salaire collectif (QC)", icon: "⚜️" },
  { code: "RL-25",    group: "qc",  label: "RL-25",      desc: "Revenus d'un régime d'intéressement (QC)", icon: "⚜️" },
  { code: "RL-27",    group: "qc",  label: "RL-27",      desc: "Paiements du gouvernement (QC)", icon: "⚜️" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ProgressBar({ value, color = "#0b6b67" }: { value: number; color?: string }) {
  return (
    <div style={{ height: 4, background: "#e5ede9", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 4, transition: "width 400ms ease" }} />
    </div>
  );
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes et-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 18, height: 18, border: "3px solid #dde8e5", borderTopColor: "#0b6b67", borderRadius: "50%", animation: "et-spin 0.7s linear infinite", display: "inline-block" }} />
    </>
  );
}

function fmtAmount(cents: number | null): string {
  if (cents === null || cents === 0) return "—";
  return (cents / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2 }) + " $";
}

function confidenceBadge(conf: number) {
  const color = conf >= 88 ? "#059669" : conf >= 70 ? "#d97706" : "#9ca3af";
  const label = conf >= 88 ? "OCR ✓" : conf >= 70 ? "À vérifier" : "Non extrait";
  return (
    <span style={{ fontSize: 9, fontWeight: 700, color, background: `${color}18`, padding: "1px 6px", borderRadius: 100, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

// ─── Composant case éditable ──────────────────────────────────────────────────
function CaseRow({ box, editedVal, onEdit }: {
  box: BoxResult;
  editedVal: string;
  onEdit: (code: string, val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(editedVal || box.rawValue || "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Case incluse dans une autre — afficher en gris, non éditable
  if (box.includedIn) return null;

  const displayVal = editedVal || box.rawValue;
  const isModified = editedVal && editedVal !== box.rawValue;
  const rowBg = box.hasValue || editedVal
    ? (isModified ? "rgba(245,158,11,0.04)" : "rgba(11,107,103,0.03)")
    : "transparent";
  const borderColor = box.isRequired && !box.hasValue && !editedVal ? "rgba(220,38,38,0.3)" : "#dde8e5";

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    onEdit(box.code, localVal);
    setEditing(false);
  };

  return (
    <div style={{ background: rowBg, border: `1px solid ${borderColor}`, borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
      {/* En-tête case */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#9fd4cc", fontFamily: "monospace", background: "#f7f9f8", padding: "1px 6px", borderRadius: 4 }}>
              Case {box.code}
            </span>
            {box.isRequired && !box.hasValue && !editedVal && (
              <span style={{ fontSize: 9, color: "#dc2626", fontWeight: 700 }}>* Requis</span>
            )}
            {box.hasCondition && (
              <span style={{ fontSize: 9, color: "#d97706", fontWeight: 700, background: "rgba(217,119,6,0.1)", padding: "1px 5px", borderRadius: 4 }}>
                ⚠ Conditionnel
              </span>
            )}
            {box.autoDeductionLine && (
              <span style={{ fontSize: 9, color: "#7c3aed", fontWeight: 700, background: "rgba(124,58,237,0.08)", padding: "1px 5px", borderRadius: 4 }}>
                +Déduction auto L.{box.autoDeductionLine}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "#0f1f1e", fontWeight: 500, marginTop: 3 }}>{box.label_fr}</div>
          {/* Lignes T1/TP-1 */}
          <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
            {box.t1_line && (
              <span style={{ fontSize: 9, color: "#526865", background: "#f0f9f8", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>
                T1 → {box.t1_line}
              </span>
            )}
            {box.tp1_line && (
              <span style={{ fontSize: 9, color: "#526865", background: "#f0f9f8", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>
                TP-1 → {box.tp1_line}
              </span>
            )}
          </div>
          {box.notes && (
            <div style={{ fontSize: 10, color: "#92400e", marginTop: 3, fontStyle: "italic" }}>ℹ {box.notes}</div>
          )}
        </div>

        {/* Montant + badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
          {confidenceBadge(editedVal ? 100 : box.confidence)}
          {editing ? (
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input
                ref={inputRef}
                value={localVal}
                onChange={e => setLocalVal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
                placeholder="0,00"
                style={{ width: 90, padding: "5px 8px", border: "1.5px solid #0b6b67", borderRadius: 7, fontSize: 13, fontFamily: "monospace", textAlign: "right" }}
              />
              <button onClick={commit} style={{ background: "#0b6b67", color: "#fff", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>✓</button>
              <button onClick={() => setEditing(false)} style={{ background: "#f7f9f8", color: "#526865", border: "1px solid #dde8e5", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>
          ) : (
            <div onClick={() => { setLocalVal(editedVal || box.rawValue || ""); setEditing(true); }}
              style={{ minWidth: 80, textAlign: "right", cursor: "pointer" }}>
              <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: (box.hasValue || editedVal) ? (isModified ? "#d97706" : "#0f1f1e") : "#9ca3af" }}>
                {editedVal ? editedVal + " $" : displayVal ? displayVal + " $" : "—"}
              </div>
              <div style={{ fontSize: 9, color: "#9fd4cc", marginTop: 1 }}>
                {isModified ? "Modifié ✏" : (box.hasValue ? "" : "Cliquer pour saisir")}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function RevenusSection({
  lang,
  province,
  onComplete,
}: {
  lang: string;
  province: string;
  onComplete: (totalRevenueCents: number) => void;
}) {
  const T = (fr: string, en: string) => lang === "en" ? en : fr;
  const isQC = province === "QC";

  // ── État principal ──────────────────────────────────────────────────────────
  const [active, setActive] = useState<ActiveFeuillet | null>(null);
  const [confirmedFeuillets, setConfirmedFeuillets] = useState<FeuilletResult[]>([]);
  const [showAllTypes, setShowAllTypes] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // L’état visuel du composant est recréé à chaque navigation de section.
  // Recharger la source DB empêche de faire croire que les feuillets/revenus
  // ont été supprimés lorsqu’on revient en arrière.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/revenus/feuillets")
      .then(response => response.ok ? response.json() : null)
      .then((payload: { feuillets?: FeuilletResult[] } | null) => {
        if (!cancelled && payload?.feuillets) setConfirmedFeuillets(payload.feuillets);
      })
      .catch(() => { /* l’écran reste utilisable pour ajouter un feuillet */ });
    return () => { cancelled = true; };
  }, []);

  // Filtrer selon la province
  const visibleSlips = SLIP_CATALOG.filter(s => {
    if (s.group === "qc" && !isQC) return false;
    return true;
  });
  const displayed = showAllTypes ? visibleSlips : visibleSlips.slice(0, 8);

  // ── Sélectionner un type et déclencher le file picker ──────────────────────
  const selectType = useCallback((typeCode: string) => {
    const slip = SLIP_CATALOG.find(s => s.code === typeCode)!;
    const entry: ActiveFeuillet = {
      phase: "uploading",
      typeCode,
      typeName: slip.label + " — " + slip.desc,
      documentId: null,
      filename: "",
      cases: [],
      editedValues: {},
      progress: 0,
      error: "",
    };
    setActive(entry);
    // Déclencher l'input file
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("data-typecode", typeCode);
      fileInputRef.current.click();
    }
  }, []);

  // ── Pipeline upload + OCR ──────────────────────────────────────────────────
  const runPipeline = useCallback(async (file: File, typeCode: string) => {
    const update = (patch: Partial<ActiveFeuillet>) =>
      setActive(prev => prev ? { ...prev, ...patch } : prev);

    try {
      // ÉTAPE 1: Upload
      update({ phase: "uploading", progress: 10, filename: file.name });
      const form = new FormData();
      form.append("file", file);
      // Toujours envoyer le type choisi par l'user ET laisser autoDetect valider
      form.append("documentTypeCode", typeCode);
      form.append("autoDetect", "true"); // EasyTax corrige si l'user se trompe de type
      const upRes = await fetch("/api/documents/upload", { method: "POST", body: form });
      const upText = await upRes.text();
      const upData = JSON.parse(upText || "{}") as { id?: string; existingDocumentId?: string; error?: string };
      if (!upRes.ok && upData.error !== "duplicate_detected") throw new Error(upData.error ?? "Erreur upload");
      const documentId = upData.id ?? upData.existingDocumentId;
      if (!documentId) throw new Error("ID document manquant");

      update({ documentId, progress: 35 });

      // ÉTAPE 2: OCR
      update({ phase: "ocr", progress: 50 });
      const ocrRes = await fetch(`/api/documents/${documentId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          taxYear: 2025,
          autoDetect: true,        // laisser EasyTax détecter le bon type
          selectedTypeCode: "AUTO" // pas de rejet si type différent
        }),
      });
      if (!ocrRes.ok) {
        const ocrErr = await ocrRes.json().catch(() => ({ error: "Échec OCR" })) as { error?: string };
        throw new Error(ocrErr.error ?? "Échec OCR");
      }

      update({ progress: 80 });

      // ÉTAPE 3: Charger les cases depuis le dictionnaire
      const feuilletRes = await fetch(`/api/revenus/feuillet/${documentId}`);
      const feuilletData = feuilletRes.ok
        ? await feuilletRes.json() as { cases?: BoxResult[] }
        : { cases: [] };

      update({
        phase: "validating",
        progress: 100,
        cases: feuilletData.cases ?? [],
      });

    } catch (err) {
      update({ phase: "error", error: err instanceof Error ? err.message : "Erreur inconnue" });
    }
  }, []);

  // Handler du file input
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const typeCode = e.target.getAttribute("data-typecode") ?? "T4";
    if (file) runPipeline(file, typeCode);
    e.target.value = ""; // reset pour permettre re-sélection
  }, [runPipeline]);

  // ── Éditer une valeur de case ──────────────────────────────────────────────
  const editCase = useCallback((code: string, val: string) => {
    setActive(prev => prev ? {
      ...prev,
      editedValues: { ...prev.editedValues, [code]: val },
    } : prev);
  }, []);

  // ── Confirmer le feuillet ──────────────────────────────────────────────────
  const confirmFeuillet = useCallback(async () => {
    if (!active?.documentId) return;

    // Envoyer les valeurs éditées vers l'API pour validation
    const edits = Object.entries(active.editedValues);
    if (edits.length > 0) {
      await fetch(`/api/revenus/feuillet/${active.documentId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edits: active.editedValues }),
      }).catch(() => {});
    }

    // Valider toutes les entries de ce document
    await fetch("/api/resume/validate-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: active.documentId }),
    }).catch(() => {});

    // Ajouter aux feuillets confirmés
    const confirmed: FeuilletResult = {
      docId: active.documentId,
      typeCode: active.typeCode,
      nameFr: active.typeName,
      filename: active.filename,
      status: "confirmed",
      cases: active.cases.map(c => ({
        ...c,
        rawValue: active.editedValues[c.code] ?? c.rawValue,
        amountCents: active.editedValues[c.code]
          ? Math.round(parseFloat(active.editedValues[c.code].replace(",", ".")) * 100)
          : c.amountCents,
      })),
      totalExtracted: active.cases.filter(c => c.hasValue || active.editedValues[c.code]).length,
      totalCases: active.cases.filter(c => !c.includedIn).length,
    };

    setConfirmedFeuillets(prev => [...prev, confirmed]);
    setActive(null);
  }, [active]);

  // ── Supprimer un feuillet confirmé ─────────────────────────────────────────
  const removeFeuillet = useCallback((docId: string) => {
    setConfirmedFeuillets(prev => prev.filter(f => f.docId !== docId));
  }, []);

  // ── Calculer le total revenus ──────────────────────────────────────────────
  const totalRevenueCents = confirmedFeuillets.reduce((sum, f) => {
    return sum + f.cases
      .filter(c => !c.includedIn && c.t1_line && parseInt(c.t1_line) >= 10000 && parseInt(c.t1_line) <= 14999)
      .reduce((s, c) => s + (c.amountCents ?? 0), 0);
  }, 0);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
        onChange={handleFileInput} style={{ display: "none" }} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: "2px solid #dde8e5" }}>
        <span style={{ fontSize: 26 }}>💰</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "#0f1f1e" }}>
            {T("Revenus 2025", "2025 Income")}
          </div>
          <div style={{ fontSize: 11, color: "#7a9c97" }}>
            {T("Uploadez vos feuillets — l'OCR extrait les cases automatiquement. Validez chaque montant.",
               "Upload your slips — OCR extracts the boxes automatically. Validate each amount.")}
          </div>
        </div>
        {confirmedFeuillets.length > 0 && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: "#9fd4cc" }}>{T("Total revenus","Total income")}</div>
            <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: "#0b6b67" }}>
              {fmtAmount(totalRevenueCents)}
            </div>
          </div>
        )}
      </div>

      {/* ── Feuillets confirmés ─────────────────────────────────────────────── */}
      {confirmedFeuillets.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {confirmedFeuillets.map(f => (
            <ConfirmedFeuilletCard key={f.docId} feuillet={f} lang={lang} onRemove={() => removeFeuillet(f.docId)} />
          ))}
        </div>
      )}

      {/* ── Pipeline actif (upload / ocr / validation) ─────────────────────── */}
      {active && (
        <div style={{ background: "#fff", border: "1px solid #b6ddd6", borderRadius: 14, padding: "16px", marginBottom: 14, boxShadow: "0 2px 12px rgba(11,107,103,0.08)" }}>
          <PipelineView
            active={active}
            lang={lang}
            onEditCase={editCase}
            onConfirm={confirmFeuillet}
            onCancel={() => setActive(null)}
          />
        </div>
      )}

      {/* ── Sélecteur de type (quand pas de pipeline actif) ─────────────────── */}
      {!active && (
        <div style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 14, padding: "16px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#526865", marginBottom: 12 }}>
            {confirmedFeuillets.length > 0
              ? T("➕ Ajouter un autre feuillet", "➕ Add another slip")
              : T("Choisir le type de feuillet à uploader", "Choose the slip type to upload")}
          </div>

          {/* AUTO — détection automatique */}
          <button onClick={() => selectType("AUTO")}
            style={{ width: "100%", marginBottom: 12, padding: "12px 14px", borderRadius: 11, textAlign: "left", cursor: "pointer",
              background: "linear-gradient(135deg, rgba(11,107,103,0.08), rgba(11,107,103,0.04))",
              border: "1.5px solid #0b6b67", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🔍</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0b6b67" }}>
                {T("Détection automatique", "Auto-detection")}
              </div>
              <div style={{ fontSize: 11, color: "#526865", marginTop: 1 }}>
                {T("EasyTax identifie le type et prouve le feuillet avant extraction",
                   "EasyTax identifies the type and proves the slip before extraction")}
              </div>
            </div>
            <span style={{ marginLeft: "auto", color: "#0b6b67", fontSize: 18 }}>→</span>
          </button>

          {/* Fédéraux */}
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9fd4cc", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            {T("Feuillets fédéraux (ARC)", "Federal slips (CRA)")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 10 }}>
            {displayed.filter(s => s.group === "fed" && s.code !== "AUTO").map(slip => (
              <SlipTypeButton key={slip.code} slip={slip} onSelect={selectType} />
            ))}
          </div>

          {/* Québec */}
          {isQC && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9fd4cc", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, marginTop: 10 }}>
                ⚜️ {T("Relevés Revenu Québec", "Quebec Revenue slips")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 10 }}>
                {displayed.filter(s => s.group === "qc").map(slip => (
                  <SlipTypeButton key={slip.code} slip={slip} onSelect={selectType} />
                ))}
              </div>
            </>
          )}

          {/* Bouton voir tous */}
          {!showAllTypes && visibleSlips.length > 8 && (
            <button onClick={() => setShowAllTypes(true)}
              style={{ width: "100%", padding: "8px 0", fontSize: 12, color: "#0b6b67", background: "transparent", border: "1px dashed #9fd4cc", borderRadius: 8, cursor: "pointer" }}>
              {T(`Voir tous les ${visibleSlips.length} types de feuillets`, `Show all ${visibleSlips.length} slip types`)}
            </button>
          )}
        </div>
      )}

      {/* ── Bouton Continuer (une fois au moins 1 feuillet confirmé) ─────────── */}
      {confirmedFeuillets.length > 0 && !active && (
        <div style={{ marginTop: 14 }}>
          <div style={{ background: "rgba(11,107,103,0.05)", border: "1px solid rgba(11,107,103,0.2)", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0b6b67" }}>
                  ✓ {confirmedFeuillets.length} {T("feuillet(s) validé(s)", "slip(s) validated")}
                </div>
                <div style={{ fontSize: 11, color: "#526865", marginTop: 2 }}>
                  {T("Revenu total extrait", "Total income extracted")} : {fmtAmount(totalRevenueCents)}
                </div>
              </div>
              <div style={{ fontSize: 22 }}>📋</div>
            </div>
          </div>
          <button onClick={() => onComplete(totalRevenueCents)}
            style={{ width: "100%", padding: "13px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, background: "#0b6b67", color: "#fff", border: "none", cursor: "pointer" }}>
            {T("Continuer — Questions complémentaires →", "Continue — Complementary questions →")}
          </button>
        </div>
      )}

      {/* Aucun feuillet — bouton passer */}
      {confirmedFeuillets.length === 0 && !active && (
        <button onClick={() => onComplete(0)}
          style={{ width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 9, fontSize: 13, color: "#9ca3af", background: "transparent", border: "1px dashed #dde8e5", cursor: "pointer" }}>
          {T("Passer — aucun feuillet à déclarer →", "Skip — no slip to declare →")}
        </button>
      )}
    </div>
  );
}

// ─── Bouton type de feuillet ──────────────────────────────────────────────────
function SlipTypeButton({ slip, onSelect }: { slip: typeof SLIP_CATALOG[0]; onSelect: (code: string) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={() => onSelect(slip.code)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "10px 12px", borderRadius: 10, textAlign: "left",
        background: hover ? "#f0f9f8" : "#f7f9f8",
        border: hover ? "1px solid #9fd4cc" : "1px solid #dde8e5",
        cursor: "pointer", transition: "all 150ms",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <span style={{ fontSize: 14 }}>{slip.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#0b6b67" }}>{slip.label}</span>
      </div>
      <div style={{ fontSize: 10, color: "#526865", lineHeight: 1.3 }}>{slip.desc}</div>
    </button>
  );
}

// ─── Vue pipeline (upload / OCR / validation) ─────────────────────────────────
function PipelineView({ active, lang, onEditCase, onConfirm, onCancel }: {
  active: ActiveFeuillet;
  lang: string;
  onEditCase: (code: string, val: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const T = (fr: string, en: string) => lang === "en" ? en : fr;
  const steps = [
    { key: "uploading", label: T("Upload","Upload") },
    { key: "ocr",       label: "OCR" },
    { key: "validating",label: T("Validation","Validation") },
  ];
  const stepIdx = steps.findIndex(s => s.key === active.phase);

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1f1e" }}>{active.typeCode}</div>
          <div style={{ fontSize: 11, color: "#7a9c97" }}>{active.filename || active.typeName}</div>
        </div>
        <button onClick={onCancel} style={{ border: 0, background: "transparent", color: "#9ca3af", cursor: "pointer", fontSize: 18 }}>✕</button>
      </div>

      {/* Étapes visuelles */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 0 }}>
        {steps.map((s, i) => {
          const done = stepIdx > i && active.phase !== "error";
          const active_ = stepIdx === i;
          const bg = done ? "#0b6b67" : active_ ? "#0b6b67" : "#e5ede9";
          const textC = (done || active_) ? "#fff" : "#9ca3af";
          return (
            <div key={s.key} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", margin: "0 auto 4px", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: textC, fontWeight: 700, boxShadow: active_ ? "0 0 0 3px rgba(11,107,103,0.2)" : "none" }}>
                  {done ? "✓" : i + 1}
                </div>
                <div style={{ fontSize: 9, color: (done || active_) ? "#0b6b67" : "#9ca3af", fontWeight: active_ ? 700 : 400 }}>{s.label}</div>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? "#0b6b67" : "#e5ede9", transition: "background 400ms" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Barre de progression */}
      {active.phase !== "validating" && active.phase !== "error" && (
        <div style={{ marginBottom: 10 }}>
          <ProgressBar value={active.progress} />
          <div style={{ fontSize: 11, color: "#7a9c97", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <Spinner />
            {active.phase === "uploading" && T("Envoi du fichier en cours...","Uploading file...")}
            {active.phase === "ocr" && T("Analyse OCR du document...","Running OCR analysis...")}
          </div>
        </div>
      )}

      {/* Erreur */}
      {active.phase === "error" && (
        <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
          ⚠ {active.error}
        </div>
      )}

      {/* VALIDATION DES CASES */}
      {active.phase === "validating" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f1f1e" }}>
              {T("Confirmez ou corrigez chaque montant", "Confirm or correct each amount")}
            </div>
            <div style={{ fontSize: 11, color: "#9fd4cc" }}>
              {active.cases.filter(c => c.hasValue && !c.includedIn).length}/{active.cases.filter(c => !c.includedIn).length} {T("extraites","extracted")}
            </div>
          </div>

          {/* Avertissement cases conditionnelles */}
          {active.cases.some(c => c.hasCondition && c.hasValue) && (
            <div style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#92400e", marginBottom: 10 }}>
              ⚠ {T("Certains montants ont des règles conditionnelles (âge, type de revenu). Vérifiez les notes avant de confirmer.",
                   "Some amounts have conditional rules (age, income type). Check the notes before confirming.")}
            </div>
          )}

          {/* Cases */}
          <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 2 }}>
            {active.cases.filter(c => !c.includedIn).length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af", fontSize: 13 }}>
                {T("Aucune case reconnue. Vérifiez que le document est bien un feuillet fiscal.",
                   "No boxes recognized. Make sure the document is a valid tax slip.")}
              </div>
            ) : (
              active.cases
                .filter(c => !c.includedIn)
                .sort((a, b) => {
                  // Trier: requis en premier, puis avec valeur, puis les autres
                  if (a.isRequired && !b.isRequired) return -1;
                  if (!a.isRequired && b.isRequired) return 1;
                  if (a.hasValue && !b.hasValue) return -1;
                  if (!a.hasValue && b.hasValue) return 1;
                  return 0;
                })
                .map(box => (
                  <CaseRow
                    key={box.code}
                    box={box}
                    editedVal={active.editedValues[box.code] ?? ""}
                    onEdit={onEditCase}
                  />
                ))
            )}
          </div>

          {/* Boutons validation */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            <button onClick={onCancel}
              style={{ padding: "11px 0", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "transparent", color: "#526865", border: "1px solid #dde8e5", cursor: "pointer" }}>
              {T("✕ Annuler","✕ Cancel")}
            </button>
            <button onClick={onConfirm}
              style={{ padding: "11px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "#0b6b67", color: "#fff", border: "none", cursor: "pointer" }}>
              {T("✓ Confirmer et valider","✓ Confirm & validate")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Carte feuillet confirmé ──────────────────────────────────────────────────
function ConfirmedFeuilletCard({ feuillet, lang, onRemove }: {
  feuillet: FeuilletResult;
  lang: string;
  onRemove: () => void;
}) {
  const T = (fr: string, en: string) => lang === "en" ? en : fr;
  const [expanded, setExpanded] = useState(false);

  const totalCents = feuillet.cases
    .filter(c => !c.includedIn && c.t1_line && parseInt(c.t1_line) >= 10000 && parseInt(c.t1_line) <= 14999)
    .reduce((s, c) => s + (c.amountCents ?? 0), 0);

  const valuedCases = feuillet.cases.filter(c => !c.includedIn && c.hasValue);

  return (
    <div style={{ background: "rgba(11,107,103,0.03)", border: "1px solid rgba(11,107,103,0.2)", borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
      {/* Résumé */}
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
        onClick={() => setExpanded(e => !e)}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#0b6b67", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0f1f1e" }}>{feuillet.typeCode}</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: "#0b6b67" }}>
              {fmtAmount(totalCents)}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#7a9c97", marginTop: 1 }}>
            {feuillet.filename} · {valuedCases.length} {T("case(s) extraite(s)","box(es) extracted")}
            <span style={{ marginLeft: 8, color: "#9fd4cc" }}>{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{ border: 0, background: "transparent", color: "#9ca3af", cursor: "pointer", fontSize: 16, padding: "0 4px", flexShrink: 0 }}>✕</button>
      </div>

      {/* Détail des cases (expandable) */}
      {expanded && (
        <div style={{ borderTop: "1px solid rgba(11,107,103,0.1)", padding: "10px 14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
            {valuedCases.map(c => (
              <div key={c.code} style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 8, padding: "7px 10px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#9fd4cc", textTransform: "uppercase", display: "flex", justifyContent: "space-between" }}>
                  <span>Case {c.code}</span>
                  {c.t1_line && <span style={{ color: "#b6ddd6" }}>L.{c.t1_line}</span>}
                </div>
                <div style={{ fontSize: 10, color: "#526865", marginTop: 2, marginBottom: 4, lineHeight: 1.3 }}>{c.label_fr}</div>
                <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#0f1f1e" }}>
                  {fmtAmount(c.amountCents)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
