"use client";

import Link from "next/link";
import { useState } from "react";

// Types de documents pour la démo (seront chargés depuis /api/documents/types)
const DOCUMENT_TYPES_DEMO = [
  { code: "T4",       labelFr: "T4",        category: "employment" },
  { code: "RL-1",     labelFr: "RL-1",      category: "employment" },
  { code: "T4A",      labelFr: "T4A",       category: "employment" },
  { code: "T5",       labelFr: "T5",        category: "investment" },
  { code: "RL-2",     labelFr: "RL-2",      category: "investment" },
  { code: "MEDICAL",  labelFr: "Médical",   category: "medical"    },
  { code: "DONATION", labelFr: "Dons",      category: "donations"  },
  { code: "OTHER",    labelFr: "Autre",     category: "other"      },
];

const CATEGORY_LABELS: Record<string, string> = {
  employment:     "Revenus d'emploi",
  investment:     "Placements",
  medical:        "Médical",
  donations:      "Dons",
  education:      "Études",
  self_employment:"Travail autonome",
  other:          "Autres",
};

const STATUS_DISPLAY: Record<string, { icon: string; label: string; color: string }> = {
  stored:              { icon: "✅", label: "Ajouté",       color: "text-green-600" },
  verified:            { icon: "✅", label: "Vérifié",      color: "text-green-700" },
  needs_review:        { icon: "⚠️", label: "À vérifier",  color: "text-yellow-600" },
  processing:          { icon: "⏳", label: "En traitement", color: "text-blue-600" },
  processed:           { icon: "✅", label: "Traité",       color: "text-green-600" },
  archived:            { icon: "📦", label: "Archivé",      color: "text-gray-400"  },
  rejected:            { icon: "❌", label: "Rejeté",       color: "text-red-600"   },
  uploaded:            { icon: "⬆️", label: "Téléversé",   color: "text-blue-500"  },
};

// Données démo — remplacées par /api/documents à l'étape auth
const DEMO_DOCS = [
  { id: "1", typeCode: "T4",      typeLabelFr: "T4 — Rémunération payée",       status: "stored",       originalFilename: "T4_2025_ABC.pdf",    fileSizeBytes: 102400, uploadedAt: "2025-03-10", year: 2025 },
  { id: "2", typeCode: "RL-1",    typeLabelFr: "RL-1 — Revenus d'emploi",       status: "stored",       originalFilename: "RL1_2025.pdf",        fileSizeBytes: 89600,  uploadedAt: "2025-03-10", year: 2025 },
  { id: "3", typeCode: "T5",      typeLabelFr: "T5 — Revenus de placements",    status: "needs_review", originalFilename: "T5_2025_RBC.pdf",    fileSizeBytes: 54000,  uploadedAt: "2025-03-12", year: 2025 },
  { id: "4", typeCode: "MEDICAL", typeLabelFr: "Reçus médicaux",                status: "stored",       originalFilename: "recu_medical_jan.jpg", fileSizeBytes: 210000, uploadedAt: "2025-03-15", year: 2025 },
];

type UploadState = "idle" | "uploading" | "success" | "error";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function DocumentsPage() {
  const [filterYear] = useState("2025");
  const [filterType, setFilterType] = useState("all");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedType, setSelectedType] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const filteredDocs = DEMO_DOCS.filter((doc) => {
    if (filterType !== "all" && doc.typeCode !== filterType) return false;
    return true;
  });

  // Grouper par catégorie
  const grouped = filteredDocs.reduce<Record<string, typeof DEMO_DOCS>>((acc, doc) => {
    const type = DOCUMENT_TYPES_DEMO.find((t) => t.code === doc.typeCode);
    const cat = type?.category ?? "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setSelectedFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setSelectedFile(f);
  }

  async function handleUpload() {
    if (!selectedFile || !selectedType) return;
    setUploadState("uploading");
    setUploadProgress(0);

    // Simulation de progression (l'API réelle sera branchée à l'étape auth)
    const interval = setInterval(() => {
      setUploadProgress((p) => {
        if (p >= 90) { clearInterval(interval); return 90; }
        return p + 15;
      });
    }, 200);

    // TODO: appel réel à /api/documents/upload avec FormData
    await new Promise((r) => setTimeout(r, 1500));
    clearInterval(interval);
    setUploadProgress(100);
    setUploadState("success");

    setTimeout(() => {
      setShowUploadModal(false);
      setUploadState("idle");
      setUploadProgress(0);
      setSelectedFile(null);
      setSelectedType("");
    }, 1500);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1">
          <span className="text-xl font-bold text-red-600">Easy</span>
          <span className="text-xl font-bold text-gray-900">Tax</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <Link href="/dossier" className="hover:text-gray-900">Mon dossier</Link>
          <span className="font-medium text-gray-900">Mes documents</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes documents fiscaux</h1>
            <p className="text-gray-500 text-sm mt-1">Coffre-fort · Saison {filterYear}</p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-red-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <span>📄</span> Ajouter un document
          </button>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilterType("all")}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterType === "all" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600"}`}
          >
            Tous ({DEMO_DOCS.length})
          </button>
          {DOCUMENT_TYPES_DEMO.map((t) => (
            <button
              key={t.code}
              onClick={() => setFilterType(t.code)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterType === t.code ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600"}`}
            >
              {t.code}
            </button>
          ))}
        </div>

        {/* Documents groupés par catégorie */}
        {Object.keys(grouped).length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">📂</div>
            <h3 className="font-semibold text-gray-900 mb-1">Aucun document</h3>
            <p className="text-gray-400 text-sm mb-4">Ajoutez vos T4, RL-1 et autres feuillets fiscaux.</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-red-600 text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-red-700"
            >
              📄 Ajouter un document
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, docs]) => (
              <section key={cat} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {docs.map((doc) => {
                    const st = STATUS_DISPLAY[doc.status] ?? STATUS_DISPLAY.stored;
                    return (
                      <div key={doc.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                        {/* Icône type */}
                        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600 font-bold text-xs flex-shrink-0">
                          {doc.typeCode.slice(0, 3)}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">
                            {doc.typeLabelFr}
                          </div>
                          <div className="text-xs text-gray-400 truncate mt-0.5">
                            {doc.originalFilename} · {formatFileSize(doc.fileSizeBytes)}
                          </div>
                        </div>
                        {/* Statut */}
                        <div className={`text-xs font-medium flex items-center gap-1 flex-shrink-0 ${st.color}`}>
                          <span>{st.icon}</span>
                          <span className="hidden sm:inline">{st.label}</span>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                            Voir
                          </button>
                          <button className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                            ↓
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Résumé */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-xl">🔒</span>
          <div className="text-sm">
            <div className="font-semibold text-blue-900 mb-0.5">Coffre-fort sécurisé</div>
            <div className="text-blue-700">
              Vos documents sont chiffrés et stockés de façon sécurisée.
              Aucune donnée n'est partagée sans votre autorisation.
              Les liens de téléchargement expirent après 15 minutes.
            </div>
          </div>
        </div>
      </div>

      {/* Modal Upload */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900">Ajouter un document</h2>
              <button
                onClick={() => { setShowUploadModal(false); setSelectedFile(null); setSelectedType(""); setUploadState("idle"); }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {uploadState === "success" ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">✅</div>
                <div className="font-semibold text-gray-900">Document ajouté</div>
                <div className="text-gray-400 text-sm mt-1">Votre document a été enregistré dans le coffre-fort.</div>
              </div>
            ) : (
              <>
                {/* Zone glisser-déposer */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center mb-4 transition-colors ${dragOver ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                >
                  {selectedFile ? (
                    <div>
                      <div className="text-2xl mb-2">📄</div>
                      <div className="font-medium text-gray-900 text-sm truncate">{selectedFile.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{formatFileSize(selectedFile.size)}</div>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="text-xs text-red-500 mt-2 hover:underline"
                      >
                        Changer de fichier
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <div className="text-3xl mb-2">📁</div>
                      <div className="text-sm font-medium text-gray-700 mb-1">
                        Glisser un fichier ici
                      </div>
                      <div className="text-xs text-gray-400 mb-3">PDF · JPG · PNG · Max 20 Mo</div>
                      <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg">
                        Parcourir
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                      />
                    </label>
                  )}
                </div>

                {/* Mobile : photo */}
                <label className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-50 mb-4">
                  <span className="text-xl">📷</span>
                  <span>Photographier un document</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>

                {/* Type de document */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Type de document
                  </label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                  >
                    <option value="">Sélectionner...</option>
                    {DOCUMENT_TYPES_DEMO.map((t) => (
                      <option key={t.code} value={t.code}>{t.labelFr}</option>
                    ))}
                  </select>
                </div>

                {/* Barre de progression */}
                {uploadState === "uploading" && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Téléversement...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-red-500 h-1.5 rounded-full transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {uploadState === "error" && (
                  <div className="mb-4 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    Erreur lors du téléversement. Vérifiez le fichier et réessayez.
                  </div>
                )}

                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || !selectedType || uploadState === "uploading"}
                  className="w-full bg-red-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {uploadState === "uploading" ? "Téléversement..." : "Ajouter ce document"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
