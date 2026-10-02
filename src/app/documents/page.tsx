"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

const DOCUMENT_TYPES = [
  { code: "T4", labelFr: "T4", category: "employment" },
  { code: "RL-1", labelFr: "RL-1", category: "employment" },
  { code: "T4A", labelFr: "T4A", category: "employment" },
  { code: "T5", labelFr: "T5", category: "investment" },
  { code: "RL-2", labelFr: "RL-2", category: "investment" },
  { code: "MEDICAL", labelFr: "Médical", category: "medical" },
  { code: "DONATION", labelFr: "Dons", category: "donations" },
  { code: "OTHER", labelFr: "Autre", category: "other" },
];

const CATEGORY_LABELS: Record<string, string> = {
  employment: "Revenus d'emploi",
  investment: "Placements",
  medical: "Médical",
  donations: "Dons",
  education: "Études",
  self_employment: "Travail autonome",
  other: "Autres",
};

const STATUS_DISPLAY: Record<string, { icon: string; label: string; color: string }> = {
  stored:               { icon: "✅", label: "Ajouté",        color: "text-green-600" },
  verified:             { icon: "✅", label: "Vérifié",       color: "text-green-700" },
  needs_review:         { icon: "⚠️", label: "À vérifier",   color: "text-yellow-600" },
  processing:           { icon: "⏳", label: "En traitement", color: "text-blue-600" },
  ocr_completed:        { icon: "🔍", label: "OCR fait",      color: "text-blue-600" },
  extracted:            { icon: "📊", label: "Extrait",       color: "text-purple-600" },
  ready_for_tax_return: { icon: "✅", label: "Validé",        color: "text-green-700" },
  archived:             { icon: "📦", label: "Archivé",       color: "text-gray-400" },
  processing_failed:    { icon: "❌", label: "Erreur",        color: "text-red-600" },
  uploaded:             { icon: "⬆️", label: "Téléversé",    color: "text-blue-500" },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
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
};

// Récupérer le taxYearId pour 2025 depuis l'API
async function getTaxYearId(): Promise<string | null> {
  try {
    const res = await fetch("/api/tax-years");
    if (!res.ok) return null;
    const data = await res.json();
    const year2025 = data.years?.find((y: any) => y.year === 2025);
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

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents ?? []);
      }
    } catch { /* silencieux */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDocs();
    getTaxYearId().then(setTaxYearId);
  }, [loadDocs]);

  const filteredDocs = filterType === "all" ? docs : docs.filter(d => d.typeCode === filterType);

  const grouped = filteredDocs.reduce<Record<string, Doc[]>>((acc, doc) => {
    const cat = doc.typeCategory ?? "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  async function handleUpload() {
    if (!selectedFile || !selectedType) return;
    setUploading(true);
    setUploadError("");

    try {
      // Si pas de taxYearId, créer l'année 2025 d'abord
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

      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Erreur upload");

      setUploadDone(true);
      setTimeout(() => {
        setShowModal(false);
        setUploadDone(false);
        setSelectedFile(null);
        setSelectedType("");
        setUploading(false);
        loadDocs(); // Recharger la liste
      }, 1200);
    } catch (e: any) {
      setUploadError(e.message ?? "Erreur");
      setUploading(false);
    }
  }

  function openModal() {
    setShowModal(true);
    setUploadDone(false);
    setUploadError("");
    setSelectedFile(null);
    setSelectedType("");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1">
          <span className="text-xl font-bold text-red-600">Easy</span>
          <span className="text-xl font-bold text-gray-900">Tax</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <Link href="/dashboard" className="hover:text-gray-900">Dashboard</Link>
          <span className="font-medium text-gray-900">Mes documents</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes documents fiscaux</h1>
            <p className="text-gray-500 text-sm mt-1">Coffre-fort · Saison 2025</p>
          </div>
          <button onClick={openModal}
            className="bg-red-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-red-700 transition-colors flex items-center gap-2">
            <span>📄</span> Ajouter un document
          </button>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setFilterType("all")}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterType === "all" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
            Tous ({docs.length})
          </button>
          {DOCUMENT_TYPES.map(t => (
            <button key={t.code} onClick={() => setFilterType(t.code)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterType === t.code ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
              {t.code}
            </button>
          ))}
        </div>

        {/* Documents */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-red-500 rounded-full animate-spin mx-auto mb-3" />
            Chargement...
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">📂</div>
            <h3 className="font-semibold text-gray-900 mb-1">Aucun document</h3>
            <p className="text-gray-400 text-sm mb-4">Ajoutez vos T4, RL-1 et autres feuillets fiscaux.</p>
            <button onClick={openModal} className="bg-red-600 text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-red-700">
              📄 Ajouter un document
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, catDocs]) => (
              <section key={cat} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {catDocs.map(doc => {
                    const st = STATUS_DISPLAY[doc.status] ?? STATUS_DISPLAY.stored;
                    return (
                      <div key={doc.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600 font-bold text-xs flex-shrink-0">
                          {doc.typeCode?.slice(0, 3)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">{doc.typeLabelFr}</div>
                          <div className="text-xs text-gray-400 truncate mt-0.5">
                            {doc.originalFilename} · {formatFileSize(doc.fileSizeBytes)}
                          </div>
                        </div>
                        <div className={`text-xs font-medium flex items-center gap-1 flex-shrink-0 ${st.color}`}>
                          <span>{st.icon}</span>
                          <span className="hidden sm:inline">{st.label}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Link href={`/documents/${doc.id}/extraction`}
                            className="text-xs text-blue-600 hover:underline">
                            OCR
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-xl">🔒</span>
          <div className="text-sm">
            <div className="font-semibold text-blue-900 mb-0.5">Coffre-fort sécurisé</div>
            <div className="text-blue-700">Vos documents sont chiffrés. Les liens de téléchargement expirent après 15 minutes.</div>
          </div>
        </div>
      </div>

      {/* Modal Upload */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900">Ajouter un document</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {uploadDone ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-3">✅</div>
                <div className="font-semibold text-gray-900">Document ajouté</div>
                <div className="text-gray-400 text-sm mt-1">Enregistré dans le coffre-fort.</div>
              </div>
            ) : (
              <>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setSelectedFile(f); }}
                  className={`border-2 border-dashed rounded-xl p-6 text-center mb-4 transition-colors ${dragOver ? "border-red-400 bg-red-50" : "border-gray-200"}`}>
                  {selectedFile ? (
                    <div>
                      <div className="text-2xl mb-2">📄</div>
                      <div className="font-medium text-gray-900 text-sm truncate">{selectedFile.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{formatFileSize(selectedFile.size)}</div>
                      <button onClick={() => setSelectedFile(null)} className="text-xs text-red-500 mt-2 hover:underline">Changer</button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <div className="text-3xl mb-2">📁</div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Glisser un fichier ici</div>
                      <div className="text-xs text-gray-400 mb-3">PDF · JPG · PNG · Max 20 Mo</div>
                      <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg">Parcourir</span>
                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }} />
                    </label>
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-50 mb-4">
                  <span className="text-xl">📷</span>
                  <span>Photographier un document</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }} />
                </label>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type de document</label>
                  <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                    <option value="">Sélectionner...</option>
                    {DOCUMENT_TYPES.map(t => <option key={t.code} value={t.code}>{t.code} — {t.labelFr}</option>)}
                  </select>
                </div>

                {uploadError && (
                  <div className="mb-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{uploadError}</div>
                )}

                <button onClick={handleUpload}
                  disabled={!selectedFile || !selectedType || uploading}
                  className="w-full bg-red-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {uploading ? "Téléversement..." : "Ajouter ce document"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
