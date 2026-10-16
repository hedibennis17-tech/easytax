"use client";

import { NavClient } from "@/components/NavClient";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

type DocumentType = { id: string; code: string; labelFr: string; category: string };

const STATUS_DISPLAY: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  stored:               { icon: "✅", label: "Ajouté",        color: "#15803d", bg: "#f0fdf4" },
  verified:             { icon: "✅", label: "Vérifié",       color: "#15803d", bg: "#f0fdf4" },
  needs_review:         { icon: "⚠️", label: "À vérifier",   color: "#b45309", bg: "#fffbeb" },
  processing:           { icon: "⏳", label: "Traitement…",  color: "#1d4ed8", bg: "#eff6ff" },
  ocr_completed:        { icon: "🔍", label: "OCR terminé",  color: "#1d4ed8", bg: "#eff6ff" },
  extracted:            { icon: "📊", label: "Extrait",       color: "#7c3aed", bg: "#f5f3ff" },
  ready_for_tax_return: { icon: "✅", label: "Validé",        color: "#15803d", bg: "#f0fdf4" },
  rejected:             { icon: "⚠️", label: "Type rejeté",   color: "#b91c1c", bg: "#fef2f2" },
  archived:             { icon: "📦", label: "Archivé",       color: "#6b7280", bg: "#f9fafb" },
  processing_failed:    { icon: "❌", label: "Erreur",        color: "#b91c1c", bg: "#fef2f2" },
  uploaded:             { icon: "⬆️", label: "Téléversé",    color: "#1d4ed8", bg: "#eff6ff" },
};

const TYPE_EMOJI: Record<string, string> = {
  T4: "🏢", T4A: "💰", "T4A-OAS": "👴", T4E: "📋",
  RL1: "🏢", RL2: "💸", "T5013": "📊", T5: "📈",
  T3: "📑", RRSP: "🏦", OTH: "📄",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
}

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

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents ?? []);
      }
    } catch { /* silencieux */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadDocs();
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
    <main style={{ background: "#f8f9fb", minHeight: "100vh" }}>
      <NavClient />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px" }}>

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Mes documents</h1>
            <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>Coffre-fort fiscal · Saison 2025</p>
          </div>
          <button
            onClick={openModal}
            style={{
              background: "#dc2626", color: "#fff", border: "none", borderRadius: 12,
              padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            }}
          >
            <span>+</span> Ajouter
          </button>
        </div>

        {/* Message d'action */}
        {actionMessage && (
          <div style={{
            marginBottom: 16, borderRadius: 12, padding: "12px 16px", fontSize: 13,
            background: actionMessage.kind === "success" ? "#f0fdf4" : "#fef2f2",
            color: actionMessage.kind === "success" ? "#15803d" : "#b91c1c",
            border: `1px solid ${actionMessage.kind === "success" ? "#bbf7d0" : "#fecaca"}`,
          }}>
            {actionMessage.kind === "success" ? "✓ " : "✗ "}{actionMessage.text}
          </div>
        )}

        {/* Filtres par type */}
        {uniqueTypes.length > 1 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
            <button
              onClick={() => setFilterType("all")}
              style={{
                fontSize: 12, padding: "5px 12px", borderRadius: 999, fontWeight: 500, cursor: "pointer", border: "1px solid",
                background: filterType === "all" ? "#111827" : "#fff",
                color: filterType === "all" ? "#fff" : "#6b7280",
                borderColor: filterType === "all" ? "#111827" : "#e5e7eb",
              }}
            >
              Tous ({activeDocs.length})
            </button>
            {uniqueTypes.map(code => (
              <button
                key={code}
                onClick={() => setFilterType(code)}
                style={{
                  fontSize: 12, padding: "5px 12px", borderRadius: 999, fontWeight: 500, cursor: "pointer", border: "1px solid",
                  background: filterType === code ? "#111827" : "#fff",
                  color: filterType === code ? "#fff" : "#6b7280",
                  borderColor: filterType === code ? "#111827" : "#e5e7eb",
                }}
              >
                {code} ({activeDocs.filter(d => d.typeCode === code).length})
              </button>
            ))}
          </div>
        )}

        {/* Liste documents */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
            <div style={{
              width: 32, height: 32, border: "3px solid #e5e7eb", borderTopColor: "#dc2626",
              borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
            }} />
            Chargement…
          </div>
        ) : filteredDocs.length === 0 && archivedDocs.length === 0 ? (
          <div style={{
            background: "#fff", borderRadius: 16, border: "2px dashed #e5e7eb",
            padding: "48px 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
            <div style={{ fontWeight: 600, color: "#111827", marginBottom: 6 }}>Aucun document</div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>
              Ajoutez vos T4, T4A, RL-1 et autres feuillets fiscaux.
            </div>
            <button
              onClick={openModal}
              style={{
                background: "#dc2626", color: "#fff", border: "none", borderRadius: 10,
                padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              + Ajouter un document
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredDocs.map(doc => {
              const st = STATUS_DISPLAY[doc.status] ?? STATUS_DISPLAY.stored;
              const emoji = TYPE_EMOJI[doc.typeCode] ?? "📄";
              const isBusy = actionBusyId === doc.id;
              const isProcessing = ["processing", "uploaded"].includes(doc.status);
              const hasExtraction = ["extracted", "ready_for_tax_return", "ocr_completed"].includes(doc.status);

              return (
                <div
                  key={doc.id}
                  style={{
                    background: "#fff", borderRadius: 14, border: "1px solid #f0f0f0",
                    overflow: "hidden", opacity: isBusy ? 0.6 : 1,
                    transition: "box-shadow 0.15s",
                  }}
                >
                  {/* Ligne principale */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
                    {/* Icône type */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, background: "#fef2f2",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, flexShrink: 0,
                    }}>
                      {emoji}
                    </div>

                    {/* Infos principales */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>
                          {doc.typeLabelFr}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                          background: st.bg, color: st.color,
                        }}>
                          {st.icon} {st.label}
                        </span>
                        {isProcessing && (
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>en cours…</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <span title={doc.originalFilename} style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {doc.originalFilename}
                        </span>
                        <span>{formatFileSize(doc.fileSizeBytes)}</span>
                        <span>Ajouté le {formatDate(doc.uploadedAt)}</span>
                      </div>
                    </div>

                    {/* Badge année */}
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: "#6b7280",
                      background: "#f3f4f6", borderRadius: 8, padding: "3px 8px", flexShrink: 0,
                    }}>
                      {doc.year}
                    </div>
                  </div>

                  {/* Barre d'actions */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 0,
                    borderTop: "1px solid #f9fafb", padding: "0 8px",
                    background: "#fafafa",
                  }}>
                    {hasExtraction && (
                      <Link
                        href={`/documents/${doc.id}/extraction`}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "8px 12px", fontSize: 12, color: "#4f46e5",
                          textDecoration: "none", fontWeight: 500,
                        }}
                      >
                        📊 Voir les données extraites
                      </Link>
                    )}
                    {!hasExtraction && !isProcessing && (
                      <Link
                        href={`/documents/${doc.id}/extraction`}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "8px 12px", fontSize: 12, color: "#6b7280",
                          textDecoration: "none",
                        }}
                      >
                        🔍 Détails OCR
                      </Link>
                    )}

                    <div style={{ flex: 1 }} />

                    <button
                      onClick={() => archiveDocument(doc)}
                      disabled={isBusy}
                      style={{
                        background: "none", border: "none", padding: "8px 10px",
                        fontSize: 12, color: "#9ca3af", cursor: "pointer", fontWeight: 500,
                      }}
                    >
                      {doc.status === "archived" ? "↩ Restaurer" : "📦 Archiver"}
                    </button>
                    <button
                      onClick={() => permanentlyDeleteDocument(doc)}
                      disabled={isBusy}
                      style={{
                        background: "none", border: "none", padding: "8px 10px",
                        fontSize: 12, color: "#ef4444", cursor: "pointer", fontWeight: 500,
                      }}
                    >
                      🗑 Supprimer
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Section archivés */}
            {archivedDocs.length > 0 && filterType === "all" && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  📦 Archivés ({archivedDocs.length})
                </div>
                {archivedDocs.map(doc => {
                  const isBusy = actionBusyId === doc.id;
                  const emoji = TYPE_EMOJI[doc.typeCode] ?? "📄";
                  return (
                    <div key={doc.id} style={{
                      background: "#f9fafb", borderRadius: 14, border: "1px solid #f0f0f0",
                      overflow: "hidden", opacity: isBusy ? 0.5 : 0.75, marginBottom: 8,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px" }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 10, background: "#e5e7eb",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 18, flexShrink: 0,
                        }}>
                          {emoji}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, color: "#6b7280", fontSize: 13 }}>{doc.typeLabelFr}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{doc.originalFilename}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => archiveDocument(doc)}
                            disabled={isBusy}
                            style={{ background: "none", border: "none", fontSize: 12, color: "#6b7280", cursor: "pointer" }}
                          >
                            ↩ Restaurer
                          </button>
                          <button
                            onClick={() => permanentlyDeleteDocument(doc)}
                            disabled={isBusy}
                            style={{ background: "none", border: "none", fontSize: 12, color: "#ef4444", cursor: "pointer" }}
                          >
                            🗑 Supprimer
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

        {/* Info sécurité */}
        <div style={{
          marginTop: 24, background: "#eff6ff", border: "1px solid #bfdbfe",
          borderRadius: 12, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <div>
            <div style={{ fontWeight: 600, color: "#1e40af", fontSize: 13 }}>Coffre-fort sécurisé</div>
            <div style={{ fontSize: 12, color: "#3b82f6", marginTop: 2 }}>
              Vos documents sont chiffrés. Les liens de téléchargement expirent après 15 minutes.
            </div>
          </div>
        </div>
      </div>

      {/* Modal Upload */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          zIndex: 50, padding: 16,
        }}>
          <div style={{
            background: "#fff", borderRadius: 20, width: "100%", maxWidth: 420,
            padding: 24, boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>Ajouter un document</span>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 24, color: "#9ca3af", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            {uploadDone ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 600, color: "#111827" }}>Document ajouté</div>
                <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>Enregistré et analyse OCR lancée.</div>
              </div>
            ) : (
              <>
                {/* Zone drag & drop */}
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setSelectedFile(f); }}
                  style={{
                    border: `2px dashed ${dragOver ? "#dc2626" : "#e5e7eb"}`,
                    borderRadius: 12, padding: 20, textAlign: "center", marginBottom: 14,
                    background: dragOver ? "#fef2f2" : "#fafafa", transition: "all 0.15s",
                  }}
                >
                  {selectedFile ? (
                    <div>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                      <div style={{ fontWeight: 500, color: "#111827", fontSize: 13, wordBreak: "break-all" }}>{selectedFile.name}</div>
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{formatFileSize(selectedFile.size)}</div>
                      <button onClick={() => setSelectedFile(null)} style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer", marginTop: 8 }}>Changer de fichier</button>
                    </div>
                  ) : (
                    <label style={{ cursor: "pointer", display: "block" }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Glisser un fichier ici</div>
                      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>PDF · JPG · PNG · Max 20 Mo</div>
                      <span style={{ fontSize: 12, background: "#f3f4f6", color: "#4b5563", padding: "6px 14px", borderRadius: 8 }}>Parcourir</span>
                      <input type="file" style={{ display: "none" }} accept=".pdf,.jpg,.jpeg,.png" onChange={e => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }} />
                    </label>
                  )}
                </div>

                {/* Photo (mobile) */}
                <label style={{
                  display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                  border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px",
                  marginBottom: 14, background: "#fafafa",
                }}>
                  <span style={{ fontSize: 20 }}>📷</span>
                  <span style={{ fontSize: 13, color: "#374151" }}>Photographier un document</span>
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }} />
                </label>

                {/* Type de document */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Type de document</label>
                  <select
                    value={selectedType}
                    onChange={e => setSelectedType(e.target.value)}
                    style={{
                      width: "100%", border: "1px solid #e5e7eb", borderRadius: 8,
                      padding: "9px 12px", fontSize: 13, background: "#fff",
                      outline: "none", boxSizing: "border-box",
                    }}
                  >
                    <option value="">Sélectionner le type…</option>
                    {documentTypes.map(t => <option key={t.code} value={t.code}>{t.code} — {t.labelFr}</option>)}
                  </select>
                </div>

                {/* Checkbox doublon */}
                <label style={{
                  display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer",
                  border: "1px solid #fde68a", borderRadius: 10, padding: "10px 12px",
                  marginBottom: 14, background: "#fffbeb", fontSize: 12, color: "#92400e",
                }}>
                  <input type="checkbox" checked={allowDuplicate} onChange={e => setAllowDuplicate(e.target.checked)} style={{ marginTop: 2 }} />
                  <span><strong>Conserver un doublon</strong><br />À activer uniquement si vous souhaitez intentionnellement deux exemplaires identiques.</span>
                </label>

                {uploadError && (
                  <div style={{ marginBottom: 12, fontSize: 12, color: "#b91c1c", background: "#fef2f2", borderRadius: 8, padding: "8px 12px" }}>
                    {uploadError}
                  </div>
                )}

                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || !selectedType || uploading}
                  style={{
                    width: "100%", background: "#dc2626", color: "#fff", border: "none",
                    borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 600,
                    cursor: (!selectedFile || !selectedType || uploading) ? "not-allowed" : "pointer",
                    opacity: (!selectedFile || !selectedType || uploading) ? 0.5 : 1,
                  }}
                >
                  {uploading ? "Téléversement en cours…" : "Ajouter ce document"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
