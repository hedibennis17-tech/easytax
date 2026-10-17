"use client";

import { NavClient } from "@/components/NavClient";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

type DocumentType = { id: string; code: string; labelFr: string; category: string };

const STATUS_DISPLAY: Record<string, { icon: string; label: string; color: string; bg: string; dot: string }> = {
  stored:               { icon: "✓", label: "Ajouté",        color: "#15803d", bg: "#f0fdf4", dot: "#22c55e" },
  verified:             { icon: "✓", label: "Vérifié",       color: "#15803d", bg: "#f0fdf4", dot: "#22c55e" },
  needs_review:         { icon: "!", label: "À vérifier",    color: "#92400e", bg: "#fffbeb", dot: "#f59e0b" },
  processing:           { icon: "…", label: "Traitement…",   color: "#1e40af", bg: "#eff6ff", dot: "#3b82f6" },
  ocr_completed:        { icon: "✓", label: "OCR terminé",   color: "#1e40af", bg: "#eff6ff", dot: "#3b82f6" },
  extracted:            { icon: "✓", label: "Extrait",        color: "#6d28d9", bg: "#f5f3ff", dot: "#8b5cf6" },
  ready_for_tax_return: { icon: "✓", label: "Validé",         color: "#15803d", bg: "#f0fdf4", dot: "#22c55e" },
  rejected:             { icon: "✗", label: "Type rejeté",    color: "#b91c1c", bg: "#fef2f2", dot: "#ef4444" },
  archived:             { icon: "↓", label: "Archivé",        color: "#6b7280", bg: "#f9fafb", dot: "#9ca3af" },
  processing_failed:    { icon: "✗", label: "Erreur",         color: "#b91c1c", bg: "#fef2f2", dot: "#ef4444" },
  uploaded:             { icon: "↑", label: "Téléversé",      color: "#1e40af", bg: "#eff6ff", dot: "#3b82f6" },
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  T4: { bg: "#dbeafe", text: "#1e40af" },
  T4A: { bg: "#fce7f3", text: "#9d174d" },
  "T4A-OAS": { bg: "#e0e7ff", text: "#3730a3" },
  T4E: { bg: "#dcfce7", text: "#166534" },
  RL1: { bg: "#dbeafe", text: "#1e40af" },
  RL2: { bg: "#fef3c7", text: "#92400e" },
  T5013: { bg: "#f3e8ff", text: "#6b21a8" },
  T5: { bg: "#d1fae5", text: "#065f46" },
  T3: { bg: "#fce7f3", text: "#9d174d" },
  RRSP: { bg: "#dbeafe", text: "#1e40af" },
  OTH: { bg: "#f3f4f6", text: "#374151" },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${date} · ${h}h${m}`;
}

type ExtractionField = {
  id: string;
  fieldCode: string;
  fieldLabel: string | null;
  rawOcrValue: string | null;
  ocrConfidence: number | null;
  validatedValue: string | null;
  validationStatus: string | null;
};

type Doc = {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  status: string;
  typeCode: string;
  typeLabelFr: string;
  typeCategory: string;
  year: number;
  uploadedAt: string;
  archivedAt?: string | null;
  payerName?: string | null;
};

async function getTaxYearId(): Promise<string | null> {
  try {
    const res = await fetch("/api/tax-years");
    if (!res.ok) return null;
    const data = await res.json();
    const year2025 = data.years?.find((y: { year: number; id: string }) => y.year === 2025);
    return year2025?.id ?? null;
  } catch { return null; }
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedType, setSelectedType] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [taxYearId, setTaxYearId] = useState<string | null>(null);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [viewBusyId, setViewBusyId] = useState<string | null>(null);
  // Accordion state: docId -> fields loaded
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [accordionFields, setAccordionFields] = useState<Record<string, ExtractionField[]>>({});
  const [accordionLoading, setAccordionLoading] = useState<string | null>(null);
  const [reprocessBusyId, setReprocessBusyId] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        // Sort newest first
        const sorted = (data.documents ?? []).sort(
          (a: Doc, b: Doc) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
        setDocs(sorted);
      }
    } catch { /* silencieux */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      await loadDocs();
      const bf = await fetch("/api/documents/backfill-meta", { method: "POST" }).catch(() => null);
      const bfData = bf?.ok ? await bf.json().catch(() => null) : null;
      if (bfData?.fieldsInserted > 0) void loadDocs();
      void getTaxYearId().then(setTaxYearId);
      void fetch("/api/documents/types")
        .then(r => r.ok ? r.json() : null)
        .then((data: { types?: unknown[] } | null) =>
          setDocumentTypes(Array.isArray(data?.types) ? data.types as DocumentType[] : []))
        .catch(() => setDocumentTypes([]));
    }, 0);
    return () => clearTimeout(t);
  }, [loadDocs]);

  const activeDocs = docs.filter(d => d.status !== "archived");
  const archivedDocs = docs.filter(d => d.status === "archived");
  const filteredDocs = filterType === "all" ? activeDocs : activeDocs.filter(d => d.typeCode === filterType);

  async function toggleAccordion(doc: Doc) {
    if (expandedDocId === doc.id) {
      setExpandedDocId(null);
      return;
    }
    setExpandedDocId(doc.id);
    if (accordionFields[doc.id]) return; // already loaded
    setAccordionLoading(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}/extraction`);
      if (res.ok) {
        const data = await res.json();
        const fields: ExtractionField[] = (data.fields ?? []).filter(
          (f: ExtractionField) => (f.validatedValue ?? f.rawOcrValue)?.trim()
        ).sort((a: ExtractionField, b: ExtractionField) => a.fieldCode.localeCompare(b.fieldCode));
        setAccordionFields(prev => ({ ...prev, [doc.id]: fields }));
      } else {
        setAccordionFields(prev => ({ ...prev, [doc.id]: [] }));
      }
    } catch {
      setAccordionFields(prev => ({ ...prev, [doc.id]: [] }));
    }
    setAccordionLoading(null);
  }

  async function reprocessDocument(doc: Doc) {
    const accepted = window.confirm(
      `Relancer l'analyse OCR de « ${doc.originalFilename} » ?\n\nLes données extraites actuelles seront effacées et remplacées.`
    );
    if (!accepted) return;
    setReprocessBusyId(doc.id);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear: 2025, force: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Recalcul impossible");
      setActionMessage({ text: "Analyse OCR relancée avec succès.", kind: "success" });
      // Clear accordion cache for this doc
      setAccordionFields(prev => { const n = { ...prev }; delete n[doc.id]; return n; });
      setExpandedDocId(null);
      await loadDocs();
    } catch (e) {
      setActionMessage({ text: (e as Error).message ?? "Erreur recalcul", kind: "error" });
    } finally {
      setReprocessBusyId(null);
    }
  }

  async function handleUpload() {
    if (!selectedFile || !selectedType) return;
    setUploading(true);
    setUploadError("");
    try {
      let yearId = taxYearId;
      if (!yearId) {
        const yr = await fetch("/api/tax-years", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year: 2025 }),
        });
        if (yr.ok) {
          const yrData = await yr.json();
          yearId = yrData.id;
          setTaxYearId(yearId);
        }
      }
      if (!yearId) throw new Error("Impossible de créer l'année fiscale");

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("documentTypeCode", selectedType);
      formData.append("taxYearId", yearId);
      formData.append("allowDuplicate", String(allowDuplicate));

      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur upload");

      if (data.id) {
        const processResponse = await fetch(`/api/documents/${data.id}/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taxYear: 2025 }),
        });
        const processData = await processResponse.json().catch(() => ({}));
        if (!processResponse.ok || processData.status === "failed") {
          throw new Error(processData.error ?? "Document téléversé, mais analyse OCR impossible");
        }
        if (processData.status === "rejected") {
          setUploadError(`Document ajouté mais type rejeté (${processData.detectedType ?? "inconnu"}). Ouvrez-le dans la liste pour choisir le bon type.`);
          await loadDocs();
          return;
        }
      }

      setUploadDone(true);
      setTimeout(() => {
        setShowModal(false);
        setUploadDone(false);
        setSelectedFile(null);
        setSelectedType("");
        setAllowDuplicate(false);
        setUploading(false);
        loadDocs();
      }, 1200);
    } catch (e) {
      setUploadError((e as Error).message ?? "Erreur");
      setUploading(false);
    }
  }

  function openModal() {
    setShowModal(true);
    setUploadDone(false);
    setUploadError("");
    setSelectedFile(null);
    setSelectedType("");
    setAllowDuplicate(false);
  }

  async function viewDocument(doc: Doc) {
    setViewBusyId(doc.id);
    try {
      const response = await fetch(`/api/documents/${doc.id}/download`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Impossible d'ouvrir le document");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setActionMessage({ text: error instanceof Error ? error.message : "Impossible d'ouvrir le document", kind: "error" });
    } finally {
      setViewBusyId(null);
    }
  }

  async function archiveDocument(doc: Doc) {
    setActionBusyId(doc.id);
    setActionMessage(null);
    try {
      const action = doc.status === "archived" ? "restore" : "archive";
      const response = await fetch(`/api/documents/${doc.id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Action impossible");
      setActionMessage({ text: action === "archive" ? "Document archivé." : "Document restauré.", kind: "success" });
      await loadDocs();
    } catch (error) {
      setActionMessage({ text: error instanceof Error ? error.message : "Action impossible", kind: "error" });
    } finally {
      setActionBusyId(null);
    }
  }

  async function permanentlyDeleteDocument(doc: Doc) {
    const accepted = window.confirm(
      `Supprimer définitivement « ${doc.originalFilename} » ?\n\nLe fichier, son OCR et les montants issus de ce feuillet seront retirés du dossier. Cette action est irréversible.`
    );
    if (!accepted) return;
    setActionBusyId(doc.id);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/documents/${doc.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE_PERMANENTLY" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Suppression impossible");
      setDocs(current => current.filter(d => d.id !== doc.id));
      setActionMessage({
        text: data.storageCleanupWarning
          ? "Supprimé de la base et du calcul. Le nettoyage du fichier de stockage sera repris."
          : "Document supprimé définitivement.",
        kind: "success",
      });
      await loadDocs();
    } catch (error) {
      setActionMessage({ text: error instanceof Error ? error.message : "Suppression impossible", kind: "error" });
    } finally {
      setActionBusyId(null);
    }
  }

  const uniqueTypes = [...new Set(activeDocs.map(d => d.typeCode))];

  return (
    <main style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <NavClient />

      <style>{`
        :root {
          --bg-page: #f4f6f9;
          --bg-card: #ffffff;
          --bg-card-hover: #ffffff;
          --bg-actions: #f9fafb;
          --bg-accordion: #f8f9fc;
          --bg-field: #f3f4f6;
          --border-card: #e8eaed;
          --border-card-expanded: rgba(139,92,246,0.35);
          --border-field: #e5e7eb;
          --text-primary: #111827;
          --text-secondary: #374151;
          --text-muted: #6b7280;
          --text-faint: #9ca3af;
          --text-link: #2563eb;
          --text-purple: #7c3aed;
          --text-purple-light: #8b5cf6;
          --bg-status: rgba(0,0,0,0.05);
          --shadow-card: 0 1px 6px rgba(0,0,0,0.07), 0 2px 12px rgba(0,0,0,0.05);
          --shadow-card-hover: 0 6px 28px rgba(0,0,0,0.11);
          --shadow-card-expanded: 0 0 0 1px rgba(139,92,246,0.15), 0 4px 20px rgba(0,0,0,0.09);
          --bg-modal: #ffffff;
          --border-modal: rgba(0,0,0,0.08);
          --bg-upload-zone: #fafafa;
          --border-upload: #e5e7eb;
          --bg-btn-secondary: #f3f4f6;
          --text-btn-secondary: #374151;
          --border-btn-secondary: #e5e7eb;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg-page: #0f0f13;
            --bg-card: rgba(255,255,255,0.04);
            --bg-card-hover: rgba(255,255,255,0.06);
            --bg-actions: rgba(0,0,0,0.15);
            --bg-accordion: rgba(0,0,0,0.2);
            --bg-field: rgba(255,255,255,0.04);
            --border-card: rgba(255,255,255,0.07);
            --border-card-expanded: rgba(139,92,246,0.3);
            --border-field: rgba(255,255,255,0.07);
            --text-primary: #f3f4f6;
            --text-secondary: #d1d5db;
            --text-muted: #9ca3af;
            --text-faint: #6b7280;
            --text-link: #60a5fa;
            --text-purple: #c4b5fd;
            --text-purple-light: #a78bfa;
            --bg-status: rgba(255,255,255,0.06);
            --shadow-card: 0 2px 12px rgba(0,0,0,0.25);
            --shadow-card-hover: 0 8px 32px rgba(0,0,0,0.4);
            --shadow-card-expanded: 0 0 0 1px rgba(139,92,246,0.2), 0 4px 24px rgba(0,0,0,0.35);
            --bg-modal: #1a1a24;
            --border-modal: rgba(255,255,255,0.1);
            --bg-upload-zone: rgba(255,255,255,0.02);
            --border-upload: rgba(255,255,255,0.1);
            --bg-btn-secondary: rgba(255,255,255,0.08);
            --text-btn-secondary: #d1d5db;
            --border-btn-secondary: rgba(255,255,255,0.1);
          }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .doc-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .doc-card:hover { transform: translateY(-1px); box-shadow: var(--shadow-card-hover) !important; }
        .action-btn { transition: background 0.12s, color 0.12s, opacity 0.12s; }
        .action-btn:hover:not(:disabled) { background: rgba(0,0,0,0.04) !important; }
        @media (prefers-color-scheme: dark) {
          .action-btn:hover:not(:disabled) { background: rgba(255,255,255,0.06) !important; }
        }
        .filter-pill { transition: background 0.12s, color 0.12s, border-color 0.12s; }
        .accordion-panel { animation: fadeIn 0.2s ease; }
      `}</style>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "36px 20px 60px" }}>

        {/* En-tête premium */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "linear-gradient(135deg, #dc2626, #991b1b)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, boxShadow: "0 4px 12px rgba(220,38,38,0.4)",
              }}>📁</div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.3px" }}>
                Mes documents
              </h1>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0, paddingLeft: 46 }}>
              Coffre-fort fiscal · Saison 2025 · {activeDocs.length} feuillet{activeDocs.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={openModal}
            className="action-btn"
            style={{
              background: "linear-gradient(135deg, #dc2626, #b91c1c)",
              color: "#fff", border: "none", borderRadius: 12,
              padding: "11px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
              boxShadow: "0 4px 14px rgba(220,38,38,0.35)",
              letterSpacing: "0.01em",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Ajouter un feuillet
          </button>
        </div>

        {/* Message d'action */}
        {actionMessage && (
          <div style={{
            marginBottom: 20, borderRadius: 12, padding: "12px 16px", fontSize: 13,
            background: actionMessage.kind === "success"
              ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            color: actionMessage.kind === "success" ? "#4ade80" : "#f87171",
            border: `1px solid ${actionMessage.kind === "success" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 15 }}>{actionMessage.kind === "success" ? "✓" : "✗"}</span>
            {actionMessage.text}
          </div>
        )}

        {/* Filtres par type */}
        {uniqueTypes.length > 1 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
            <button
              onClick={() => setFilterType("all")}
              className="filter-pill"
              style={{
                fontSize: 12, padding: "5px 14px", borderRadius: 999, fontWeight: 600, cursor: "pointer",
                border: "1px solid",
                background: filterType === "all" ? "var(--text-primary)" : "transparent",
                color: filterType === "all" ? "var(--bg-page)" : "var(--text-muted)",
                borderColor: filterType === "all" ? "var(--text-primary)" : "var(--border-card)",
              }}
            >
              Tous ({activeDocs.length})
            </button>
            {uniqueTypes.map(code => {
              const tc = TYPE_COLORS[code] ?? { bg: "#f3f4f6", text: "#374151" };
              return (
                <button
                  key={code}
                  onClick={() => setFilterType(code)}
                  className="filter-pill"
                  style={{
                    fontSize: 12, padding: "5px 14px", borderRadius: 999, fontWeight: 600, cursor: "pointer",
                    border: "1px solid",
                    background: filterType === code ? tc.bg : "transparent",
                    color: filterType === code ? tc.text : "var(--text-muted)",
                    borderColor: filterType === code ? tc.bg : "var(--border-card)",
                  }}
                >
                  {code} ({activeDocs.filter(d => d.typeCode === code).length})
                </button>
              );
            })}
          </div>
        )}

        {/* Liste documents */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#4b5563" }}>
            <div style={{
              width: 36, height: 36, border: "3px solid rgba(255,255,255,0.06)", borderTopColor: "#dc2626",
              borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
            }} />
            <div style={{ fontSize: 13, color: "#6b7280" }}>Chargement…</div>
          </div>
        ) : filteredDocs.length === 0 && archivedDocs.length === 0 ? (
          <div style={{
            background: "var(--bg-card)", borderRadius: 20,
            border: "1px dashed var(--border-card)",
            padding: "64px 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 44, marginBottom: 14, opacity: 0.5 }}>📂</div>
            <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 6, fontSize: 15 }}>Aucun document</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
              Ajoutez vos T4, T4A, RL-1 et autres feuillets fiscaux.
            </div>
            <button
              onClick={openModal}
              style={{
                background: "linear-gradient(135deg, #dc2626, #b91c1c)", color: "#fff",
                border: "none", borderRadius: 12, padding: "11px 24px",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              + Ajouter un document
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredDocs.map(doc => {
              const st = STATUS_DISPLAY[doc.status] ?? STATUS_DISPLAY.stored;
              const tc = TYPE_COLORS[doc.typeCode] ?? { bg: "#f3f4f6", text: "#374151" };
              const isBusy = actionBusyId === doc.id;
              const isProcessing = ["processing", "uploaded"].includes(doc.status);
              const hasExtraction = ["extracted", "ready_for_tax_return", "ocr_completed", "stored", "verified", "needs_review"].includes(doc.status);
              const isExpanded = expandedDocId === doc.id;
              const isAccordionLoading = accordionLoading === doc.id;
              const fields = accordionFields[doc.id];
              const isReprocessBusy = reprocessBusyId === doc.id;

              return (
                <div
                  key={doc.id}
                  className="doc-card"
                  style={{
                    background: "var(--bg-card)",
                    borderRadius: 16,
                    border: isExpanded ? "1px solid var(--border-card-expanded)" : "1px solid var(--border-card)",
                    overflow: "hidden",
                    opacity: isBusy ? 0.6 : 1,
                    boxShadow: isExpanded ? "var(--shadow-card-expanded)" : "var(--shadow-card)",
                  }}
                >
                  {/* Ligne principale */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px" }}>

                    {/* Badge type */}
                    <div style={{
                      minWidth: 48, height: 48, borderRadius: 12,
                      background: tc.bg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, flexDirection: "column", gap: 1,
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: tc.text, letterSpacing: "-0.5px" }}>
                        {doc.typeCode}
                      </span>
                    </div>

                    {/* Infos principales */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14, letterSpacing: "-0.2px" }}>
                          {doc.typeLabelFr}
                        </span>
                        {/* Status pill */}
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                          background: "var(--bg-status)",
                          color: st.color,
                          display: "flex", alignItems: "center", gap: 4,
                        }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: "50%",
                            background: st.dot,
                            display: "inline-block",
                            ...(isProcessing ? { animation: "pulse 1.5s infinite" } : {}),
                          }} />
                          {st.label}
                        </span>
                        {/* Année */}
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: "var(--text-purple)",
                          background: "rgba(139,92,246,0.1)", borderRadius: 6, padding: "2px 7px",
                        }}>
                          {doc.year}
                        </span>
                      </div>

                      {/* Payeur */}
                      <div style={{ fontSize: 13, color: "var(--text-link)", fontWeight: 600, marginBottom: 3 }}>
                        {doc.payerName ?? (isProcessing ? "⏳ Extraction en cours…" : "—")}
                      </div>

                      {/* Meta: filename + size + date */}
                      <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <span
                          title={doc.originalFilename}
                          style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {doc.originalFilename}
                        </span>
                        <span style={{ color: "var(--text-faint)" }}>·</span>
                        <span>{formatFileSize(doc.fileSizeBytes)}</span>
                        <span style={{ color: "var(--text-faint)" }}>·</span>
                        <span>{formatDateTime(doc.uploadedAt)}</span>
                      </div>
                    </div>

                    {/* Bouton accordéon (flèche) */}
                    {hasExtraction && (
                      <button
                        onClick={() => toggleAccordion(doc)}
                        className="action-btn"
                        title={isExpanded ? "Fermer les données" : "Voir les données extraites"}
                        style={{
                          background: isExpanded ? "rgba(139,92,246,0.1)" : "var(--bg-field)",
                          border: `1px solid ${isExpanded ? "rgba(139,92,246,0.3)" : "var(--border-card)"}`,
                          borderRadius: 10, padding: "8px 12px", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 5,
                          fontSize: 12, fontWeight: 600,
                          color: isExpanded ? "var(--text-purple)" : "var(--text-muted)",
                          flexShrink: 0,
                        }}
                      >
                        <span style={{
                          display: "inline-block",
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s",
                          fontSize: 11,
                        }}>▼</span>
                        <span>Cases</span>
                      </button>
                    )}
                  </div>

                  {/* Accordéon : cases extraites */}
                  {isExpanded && (
                    <div
                      className="accordion-panel"
                      style={{
                        borderTop: "1px solid var(--border-card)",
                        background: "var(--bg-accordion)",
                        padding: "16px 18px",
                      }}
                    >
                      {isAccordionLoading ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: 13 }}>
                          <div style={{
                            width: 16, height: 16, border: "2px solid rgba(255,255,255,0.06)", borderTopColor: "#8b5cf6",
                            borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0,
                          }} />
                          Chargement des données extraites…
                        </div>
                      ) : !fields || fields.length === 0 ? (
                        <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>
                          Aucune donnée extraite disponible.
                          <br />
                          <Link
                            href={`/documents/${doc.id}/extraction`}
                            style={{ color: "var(--text-purple-light)", textDecoration: "none", fontSize: 12, marginTop: 6, display: "inline-block" }}
                          >
                            Voir la page complète →
                          </Link>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                            {fields.length} case{fields.length > 1 ? "s" : ""} extraite{fields.length > 1 ? "s" : ""}
                          </div>
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                            gap: 8,
                            marginBottom: 14,
                          }}>
                            {fields.map(f => {
                              const val = f.validatedValue ?? f.rawOcrValue ?? "";
                              const conf = f.ocrConfidence != null ? Math.round(f.ocrConfidence * 100) : null;
                              const isCorrected = f.validationStatus === "corrected";
                              return (
                                <div
                                  key={f.id}
                                  style={{
                                    background: "var(--bg-field)",
                                    border: "1px solid var(--border-field)",
                                    borderRadius: 10,
                                    padding: "10px 12px",
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                                    <span style={{
                                      fontSize: 10, fontWeight: 800, color: "#8b5cf6",
                                      background: "rgba(139,92,246,0.12)", borderRadius: 5,
                                      padding: "1px 6px", letterSpacing: "0.05em",
                                    }}>
                                      {f.fieldCode}
                                    </span>
                                    {conf != null && (
                                      <span style={{
                                        fontSize: 10, fontWeight: 600,
                                        color: conf >= 80 ? "#4ade80" : conf >= 60 ? "#fbbf24" : "#f87171",
                                      }}>
                                        {conf}%
                                      </span>
                                    )}
                                  </div>
                                  <div style={{
                                    fontSize: 13, fontWeight: 700, color: "var(--text-primary)",
                                    marginBottom: 2, wordBreak: "break-word",
                                  }}>
                                    {val}
                                    {isCorrected && (
                                      <span style={{ fontSize: 10, color: "#fbbf24", marginLeft: 5 }}>✎</span>
                                    )}
                                  </div>
                                  {f.fieldLabel && (
                                    <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.3 }}>
                                      {f.fieldLabel}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <Link
                            href={`/documents/${doc.id}/extraction`}
                            style={{
                              fontSize: 12, color: "var(--text-purple-light)", textDecoration: "none", fontWeight: 600,
                              display: "inline-flex", alignItems: "center", gap: 4,
                            }}
                          >
                            Modifier les données →
                          </Link>
                        </>
                      )}
                    </div>
                  )}

                  {/* Barre d'actions */}
                  <div style={{
                    display: "flex", alignItems: "center",
                    borderTop: "1px solid var(--border-card)",
                    padding: "0 8px",
                    background: "var(--bg-actions)",
                  }}>
                    {/* Voir le document */}
                    <button
                      onClick={() => viewDocument(doc)}
                      disabled={viewBusyId === doc.id}
                      className="action-btn"
                      style={{
                        background: "none", border: "none", padding: "9px 12px",
                        fontSize: 12, color: "var(--text-link)", cursor: "pointer", fontWeight: 600,
                        display: "flex", alignItems: "center", gap: 4, borderRadius: 8,
                        opacity: viewBusyId === doc.id ? 0.5 : 1,
                      }}
                    >
                      {viewBusyId === doc.id ? "⏳" : "👁"} {viewBusyId === doc.id ? "Chargement…" : "Voir"}
                    </button>

                    {/* Bouton Recalculer */}
                    <button
                      onClick={() => reprocessDocument(doc)}
                      disabled={isReprocessBusy || isProcessing}
                      className="action-btn"
                      title="Relancer l'analyse OCR"
                      style={{
                        background: "none", border: "none", padding: "9px 12px",
                        fontSize: 12, color: isReprocessBusy ? "var(--text-muted)" : "var(--text-purple-light)",
                        cursor: (isReprocessBusy || isProcessing) ? "not-allowed" : "pointer",
                        fontWeight: 600, display: "flex", alignItems: "center", gap: 4, borderRadius: 8,
                        opacity: (isReprocessBusy || isProcessing) ? 0.5 : 1,
                      }}
                    >
                      {isReprocessBusy
                        ? <><span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>↻</span> En cours…</>
                        : <>↻ Recalculer</>
                      }
                    </button>

                    {/* Données extraites (si extraction disponible) */}
                    {hasExtraction && (
                      <Link
                        href={`/documents/${doc.id}/extraction`}
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "9px 12px", fontSize: 12, color: "var(--text-purple)",
                          textDecoration: "none", fontWeight: 500, borderRadius: 8,
                        }}
                      >
                        📊 Données
                      </Link>
                    )}

                    <div style={{ flex: 1 }} />

                    <button
                      onClick={() => archiveDocument(doc)}
                      disabled={isBusy}
                      className="action-btn"
                      style={{
                        background: "none", border: "none", padding: "9px 10px",
                        fontSize: 12, color: "var(--text-muted)", cursor: "pointer", fontWeight: 500, borderRadius: 8,
                      }}
                    >
                      {doc.status === "archived" ? "↩ Restaurer" : "📦 Archiver"}
                    </button>
                    <button
                      onClick={() => permanentlyDeleteDocument(doc)}
                      disabled={isBusy}
                      className="action-btn"
                      style={{
                        background: "none", border: "none", padding: "9px 10px",
                        fontSize: 12, color: "#f87171", cursor: "pointer", fontWeight: 500, borderRadius: 8,
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Section archivés */}
            {archivedDocs.length > 0 && filterType === "all" && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingLeft: 4 }}>
                  📦 Archivés ({archivedDocs.length})
                </div>
                {archivedDocs.map(doc => {
                  const isBusy = actionBusyId === doc.id;
                  const tc = TYPE_COLORS[doc.typeCode] ?? { bg: "#f3f4f6", text: "#374151" };
                  return (
                    <div key={doc.id} style={{
                      background: "var(--bg-card)",
                      borderRadius: 14,
                      border: "1px solid var(--border-card)",
                      overflow: "hidden", opacity: isBusy ? 0.5 : 0.65, marginBottom: 8,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px" }}>
                        <div style={{
                          minWidth: 40, height: 40, borderRadius: 10,
                          background: "rgba(255,255,255,0.05)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#6b7280" }}>{doc.typeCode}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, color: "var(--text-muted)", fontSize: 13 }}>{doc.typeLabelFr}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-purple)", background: "rgba(124,58,237,0.1)", borderRadius: 6, padding: "1px 6px" }}>{doc.year}</span>
                          </div>
                          {doc.payerName && (
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500, marginTop: 2 }}>{doc.payerName}</div>
                          )}
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{formatDateTime(doc.uploadedAt)}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <button
                            onClick={() => viewDocument(doc)}
                            disabled={viewBusyId === doc.id}
                            style={{ background: "none", border: "none", fontSize: 12, color: "var(--text-link)", cursor: "pointer", fontWeight: 600 }}
                          >
                            👁 Voir
                          </button>
                          <button
                            onClick={() => archiveDocument(doc)}
                            disabled={isBusy}
                            style={{ background: "none", border: "none", fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}
                          >
                            ↩ Restaurer
                          </button>
                          <button
                            onClick={() => permanentlyDeleteDocument(doc)}
                            disabled={isBusy}
                            style={{ background: "none", border: "none", fontSize: 12, color: "#ef4444", cursor: "pointer" }}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer sécurité */}
        <div style={{
          marginTop: 32,
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: 12, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center",
        }}>
          <span style={{ fontSize: 16, opacity: 0.8 }}>🔒</span>
          <div>
            <span style={{ fontWeight: 600, color: "#1e40af", fontSize: 12 }}>Coffre-fort chiffré</span>
            <span style={{ fontSize: 12, color: "#3b82f6", marginLeft: 8 }}>
              Les liens de téléchargement expirent après 15 minutes.
            </span>
          </div>
        </div>
      </div>

      {/* Modal Upload */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          zIndex: 50, padding: 16,
          backdropFilter: "blur(4px)",
        }}>
          <div style={{
            background: "var(--bg-modal)",
            border: "1px solid var(--border-modal)",
            borderRadius: 20, width: "100%", maxWidth: 440,
            padding: 24, boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>Ajouter un document</span>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: "var(--bg-field)", border: "1px solid var(--border-card)",
                  borderRadius: 8, width: 32, height: 32, fontSize: 18, color: "#9ca3af",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >×</button>
            </div>

            {uploadDone ? (
              <div style={{ textAlign: "center", padding: "28px 0" }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>✅</div>
                <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 15 }}>Document ajouté</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Enregistré et analyse OCR lancée.</div>
              </div>
            ) : (
              <>
                {/* Zone drag & drop */}
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setSelectedFile(f); }}
                  style={{
                    border: `2px dashed ${dragOver ? "#dc2626" : "var(--border-upload)"}`,
                    borderRadius: 14, padding: 22, textAlign: "center", marginBottom: 14,
                    background: dragOver ? "rgba(220,38,38,0.04)" : "var(--bg-upload-zone)",
                    transition: "all 0.15s",
                  }}
                >
                  {selectedFile ? (
                    <div>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13, wordBreak: "break-all" }}>{selectedFile.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{formatFileSize(selectedFile.size)}</div>
                      <button onClick={() => setSelectedFile(null)} style={{ fontSize: 12, color: "#f87171", background: "none", border: "none", cursor: "pointer", marginTop: 8 }}>Changer de fichier</button>
                    </div>
                  ) : (
                    <label style={{ cursor: "pointer", display: "block" }}>
                      <div style={{ fontSize: 30, marginBottom: 8, opacity: 0.5 }}>📁</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>Glisser un fichier ici</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>PDF · JPG · PNG · Max 20 Mo</div>
                      <span style={{
                        fontSize: 12, background: "var(--bg-btn-secondary)",
                        color: "var(--text-btn-secondary)", padding: "7px 16px", borderRadius: 8,
                        border: "1px solid var(--border-btn-secondary)",
                      }}>Parcourir</span>
                      <input type="file" style={{ display: "none" }} accept=".pdf,.jpg,.jpeg,.png" onChange={e => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }} />
                    </label>
                  )}
                </div>

                {/* Photo mobile */}
                <label style={{
                  display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                  border: "1px solid var(--border-card)", borderRadius: 10, padding: "10px 14px",
                  marginBottom: 14, background: "var(--bg-upload-zone)",
                }}>
                  <span style={{ fontSize: 18 }}>📷</span>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Photographier un document</span>
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }} />
                </label>

                {/* Type de document */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Type de document
                  </label>
                  <select
                    value={selectedType}
                    onChange={e => setSelectedType(e.target.value)}
                    style={{
                      width: "100%",
                      border: "1px solid var(--border-card)",
                      borderRadius: 10, padding: "10px 12px", fontSize: 13,
                      background: "var(--bg-field)",
                      color: "var(--text-primary)",
                      outline: "none", boxSizing: "border-box",
                    }}
                  >
                    <option value="">Sélectionner le type…</option>
                    {documentTypes.map(t => (
                      <option key={t.code} value={t.code}>
                        {t.code} — {t.labelFr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Checkbox doublon */}
                <label style={{
                  display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer",
                  border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "10px 12px",
                  marginBottom: 14, background: "rgba(245,158,11,0.05)", fontSize: 12, color: "#d97706",
                }}>
                  <input type="checkbox" checked={allowDuplicate} onChange={e => setAllowDuplicate(e.target.checked)} style={{ marginTop: 2 }} />
                  <span><strong>Conserver un doublon</strong><br /><span style={{ color: "#92400e", opacity: 0.8 }}>Activer uniquement si vous voulez deux exemplaires identiques.</span></span>
                </label>

                {uploadError && (
                  <div style={{ marginBottom: 12, fontSize: 12, color: "#f87171", background: "rgba(239,68,68,0.08)", borderRadius: 8, padding: "8px 12px", border: "1px solid rgba(239,68,68,0.15)" }}>
                    {uploadError}
                  </div>
                )}

                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || !selectedType || uploading}
                  style={{
                    width: "100%",
                    background: (!selectedFile || !selectedType || uploading)
                      ? "rgba(220,38,38,0.3)"
                      : "linear-gradient(135deg, #dc2626, #b91c1c)",
                    color: "#fff", border: "none",
                    borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 700,
                    cursor: (!selectedFile || !selectedType || uploading) ? "not-allowed" : "pointer",
                    letterSpacing: "0.01em",
                    boxShadow: (!selectedFile || !selectedType || uploading) ? "none" : "0 4px 14px rgba(220,38,38,0.3)",
                  }}
                >
                  {uploading ? "Téléversement en cours…" : "Ajouter ce document"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
