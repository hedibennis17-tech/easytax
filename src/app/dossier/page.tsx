"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { NavClient } from "@/components/NavClient";
import { CATALOG_DOCUMENT_TYPES, catalogDocumentLabelFr } from "@/lib/document-intelligence/catalog";

// ─── Types ───────────────────────────────────────────────────────────────────
type DocStatus = "empty" | "uploading" | "analyzing" | "done" | "rejected" | "error";

interface DocSlot {
  id: string;
  typeCode: string;
  typeLabel: string;
  status: DocStatus;
  fileName?: string;
  documentId?: string;
  errorMessage?: string;
  progress?: number; // 0-100
}

// ─── Types de documents ────────────────────────────────────────────────────
type PickerType = { code: string; label: string; desc: string };
const DOC_TYPES: PickerType[] = [
  { code: "AUTO", label: "Détection automatique", desc: "EasyTax prouve le type avant toute extraction" },
  ...CATALOG_DOCUMENT_TYPES.map(document => ({
    code: document.code,
    label: catalogDocumentLabelFr(document.code),
    desc: `${document.authority} · ${document.family.replaceAll("_", " ")}`,
  })),
  { code: "OTHER", label: "Autre document fiscal", desc: "À classer manuellement après analyse" },
];

// ─── Composant bloc document ──────────────────────────────────────────────
function DocBlock({
  slot, onUpload, onRemove,
}: {
  slot: DocSlot;
  onUpload: (id: string, file: File) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{
      border: `1px solid ${slot.status === "done" ? "#b6ddd6" : slot.status === "error" || slot.status === "rejected" ? "#fca5a5" : "#dde8e5"}`,
      borderRadius: 12,
      background: slot.status === "done" ? "#f0faf8" : slot.status === "error" || slot.status === "rejected" ? "#fff5f5" : "#fff",
      padding: "14px 16px",
      transition: "all 200ms",
    }}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(slot.id, f); }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Icône statut */}
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: slot.status === "done" ? "#d1fae5" : slot.status === "error" || slot.status === "rejected" ? "#fee2e2" : "#f0f4f3",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16,
        }}>
          {slot.status === "done" ? "✓" :
           slot.status === "error" ? "✕" : slot.status === "rejected" ? "⚠" :
           slot.status === "uploading" || slot.status === "analyzing" ? "⋯" :
           "📄"}
        </div>

        {/* Infos */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f1e" }}>
            {slot.typeLabel}
          </div>
          {slot.status === "empty" && (
            <div style={{ fontSize: 11, color: "#7a9c97" }}>En attente · PDF, JPG, PNG</div>
          )}
          {slot.status === "uploading" && (
            <div style={{ fontSize: 11, color: "#0b6b67" }}>Téléversement...</div>
          )}
          {slot.status === "analyzing" && (
            <div style={{ fontSize: 11, color: "#0b6b67" }}>Analyse OCR en cours...</div>
          )}
          {slot.status === "done" && (
            <div style={{ fontSize: 11, color: "#059669", fontWeight: 500 }}>{slot.fileName} · Analysé</div>
          )}
          {slot.status === "error" && (
            <div style={{ fontSize: 11, color: "#dc2626" }}>{slot.errorMessage ?? "Erreur — réessayer"}</div>
          )}
          {slot.status === "rejected" && (
            <div style={{ fontSize: 11, color: "#b91c1c" }}>{slot.errorMessage ?? "Type rejeté — ouvrez le détail pour choisir le bon feuillet."}</div>
          )}

          {/* Barre de progression */}
          {(slot.status === "uploading" || slot.status === "analyzing") && (
            <div style={{ height: 2, background: "#dde8e5", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
              <div style={{
                height: "100%", background: "#0b6b67", borderRadius: 2,
                width: `${slot.progress ?? 30}%`,
                transition: "width 400ms ease",
              }} />
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {slot.status === "empty" && (
            <button
              onClick={() => inputRef.current?.click()}
              style={{
                padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: "#0b6b67", color: "#fff", border: "none", cursor: "pointer",
              }}
            >
              Choisir
            </button>
          )}
          {slot.status === "error" && (
            <button
              onClick={() => inputRef.current?.click()}
              style={{
                padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: "#dc2626", color: "#fff", border: "none", cursor: "pointer",
              }}
            >
              Réessayer
            </button>
          )}
          {slot.status === "done" && (
            <Link
              href={slot.documentId ? `/documents/${slot.documentId}/extraction` : "/documents"}
              style={{
                padding: "6px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                background: "transparent", color: "#0b6b67", border: "1px solid #b6ddd6", cursor: "pointer",
              }}
            >
              Voir
            </Link>
          )}
          {slot.status === "rejected" && slot.documentId && (
            <Link href={`/documents/${slot.documentId}/extraction`} style={{ padding: "6px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "transparent", color: "#b91c1c", border: "1px solid #fca5a5" }}>
              Voir le rejet
            </Link>
          )}
          <button
            onClick={() => onRemove(slot.id)}
            title={slot.documentId ? "Supprimer définitivement ce feuillet" : "Retirer ce feuillet"}
            style={{
              padding: "6px 8px", borderRadius: 7, fontSize: 11,
              background: "transparent", color: slot.documentId ? "#b91c1c" : "#a0b4b0", border: "none", cursor: "pointer",
            }}
          >
            {slot.documentId ? "Supprimer" : "✕"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Groupe de feuillets pour un type ────────────────────────────────────
function DocGroup({
  typeCode, typeLabel, typeDesc, slots, onUpload, onRemove, onAddSlot,
}: {
  typeCode: string; typeLabel: string; typeDesc: string;
  slots: DocSlot[];
  onUpload: (id: string, file: File) => void;
  onRemove: (id: string) => void;
  onAddSlot: (typeCode: string) => void;
}) {
  const doneCount = slots.filter(s => s.status === "done").length;

  return (
    <div style={{
      border: "1px solid #dde8e5", borderRadius: 14,
      background: "#fff", overflow: "hidden",
      marginBottom: 10,
    }}>
      {/* En-tête du groupe */}
      <div style={{
        padding: "12px 16px", borderBottom: "1px solid #edf2f0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1f1e" }}>{typeLabel}</div>
          <div style={{ fontSize: 11, color: "#7a9c97" }}>{typeDesc}</div>
        </div>
        {doneCount > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
            background: "#d1fae5", color: "#059669",
          }}>
            {doneCount} analysé{doneCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Feuillets */}
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {slots.map(slot => (
          <DocBlock key={slot.id} slot={slot} onUpload={onUpload} onRemove={onRemove} />
        ))}

        {/* Ajouter un feuillet */}
        <button
          onClick={() => onAddSlot(typeCode)}
          style={{
            padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: "transparent", color: "#0b6b67",
            border: "1px dashed #9fd4cc", cursor: "pointer",
            textAlign: "left",
          }}
        >
          + Ajouter un feuillet {typeLabel.split(" — ")[0]} supplémentaire
        </button>
      </div>
    </div>
  );
}

// ─── SÉLECTEUR DE TYPE ────────────────────────────────────────────────────
function TypePicker({ onSelect }: { onSelect: (type: PickerType) => void }) {
  const [query, setQuery] = useState("");
  const filtered = DOC_TYPES.filter(t =>
    t.code.toLowerCase().includes(query.toLowerCase()) ||
    t.label.toLowerCase().includes(query.toLowerCase()) ||
    t.desc.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{
      border: "1px solid #dde8e5", borderRadius: 14, background: "#fff",
      padding: "16px", marginBottom: 10,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1f1e", marginBottom: 10 }}>
        Quel document souhaitez-vous ajouter ?
      </div>
      <input
        type="text"
        placeholder="Rechercher un type (T4, T5, REER...)"
        value={query}
        onChange={e => setQuery(e.target.value)}
        autoFocus
        style={{
          width: "100%", padding: "9px 12px", borderRadius: 8,
          border: "1px solid #dde8e5", fontSize: 13, outline: "none",
          marginBottom: 10, boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
        {filtered.map(t => (
          <button
            key={t.code}
            onClick={() => onSelect(t)}
            style={{
              padding: "9px 12px", borderRadius: 8, textAlign: "left",
              border: "1px solid transparent", background: "transparent",
              cursor: "pointer", display: "flex", gap: 10, alignItems: "center",
              transition: "background 120ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f0faf8")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5,
              background: "#edf7f5", color: "#0b6b67", flexShrink: 0,
            }}>{t.code}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1f1e" }}>{t.label}</div>
              <div style={{ fontSize: 11, color: "#7a9c97" }}>{t.desc}</div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div style={{ fontSize: 13, color: "#7a9c97", padding: "12px", textAlign: "center" }}>
            Aucun résultat · <button onClick={() => onSelect({ code: "OTHER", label: "Autre document", desc: "Classification par IA" })} style={{ color: "#0b6b67", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Ajouter quand même</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────
export default function DossierPage() {
  // groups: { typeCode, typeLabel, typeDesc, slots }
  const [groups, setGroups] = useState<{
    typeCode: string; typeLabel: string; typeDesc: string; slots: DocSlot[];
  }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [totalDone, setTotalDone] = useState(0);
  const [totalSlots, setTotalSlots] = useState(0);

  useEffect(() => {
    let done = 0, total = 0;
    groups.forEach(g => { g.slots.forEach(s => { total++; if (s.status === "done") done++; }); });
    setTotalDone(done);
    setTotalSlots(total);
  }, [groups]);

  const addGroup = useCallback((type: PickerType) => {
    setShowPicker(false);
    const slotId = `${type.code}-${Date.now()}`;
    setGroups(g => {
      const existing = g.find(x => x.typeCode === type.code);
      if (existing) {
        // Ajouter un slot au groupe existant
        return g.map(x => x.typeCode === type.code
          ? { ...x, slots: [...x.slots, { id: slotId, typeCode: type.code, typeLabel: `${type.code} — Feuillet ${x.slots.length + 1}`, status: "empty" as DocStatus }] }
          : x
        );
      }
      return [...g, {
        typeCode: type.code,
        typeLabel: type.label,
        typeDesc: type.desc,
        slots: [{ id: slotId, typeCode: type.code, typeLabel: `${type.code} — Feuillet 1`, status: "empty" as DocStatus }],
      }];
    });
  }, []);

  const addSlot = useCallback((typeCode: string) => {
    setGroups(g => g.map(x => {
      if (x.typeCode !== typeCode) return x;
      const n = x.slots.length + 1;
      const slotId = `${typeCode}-${Date.now()}`;
      return { ...x, slots: [...x.slots, { id: slotId, typeCode, typeLabel: `${typeCode} — Feuillet ${n}`, status: "empty" as DocStatus }] };
    }));
  }, []);

  const removeSlot = useCallback(async (id: string) => {
    const slot = groups.flatMap(group => group.slots).find(candidate => candidate.id === id);
    if (slot?.documentId) {
      const accepted = window.confirm(`Supprimer définitivement « ${slot.fileName ?? slot.typeLabel} » ?\n\nLe fichier, son OCR et les montants provenant de ce feuillet seront retirés. Cette action est irréversible.`);
      if (!accepted) return;
      const response = await fetch(`/api/documents/${slot.documentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE_PERMANENTLY" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(data.error ?? "Suppression impossible");
        return;
      }
    }
    setGroups(g => g
      .map(x => ({ ...x, slots: x.slots.filter(s => s.id !== id) }))
      .filter(x => x.slots.length > 0)
    );
  }, [groups]);

  const handleUpload = useCallback(async (id: string, file: File) => {
    const group = groups.find(g => g.slots.some(s => s.id === id));
    if (!group) return;
    setGroups(g => g.map(x => ({ ...x, slots: x.slots.map(s => s.id === id ? { ...s, status: "uploading" as DocStatus, progress: 10, errorMessage: undefined } : s) })));
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("documentTypeCode", group.typeCode);
      form.append("taxYear", "2025");
      // L’ajout d’un feuillet supplémentaire est le choix explicite de
      // conserver une seconde copie, même si le fichier est identique.
      form.append("allowDuplicate", "true");
      setGroups(g => g.map(x => ({ ...x, slots: x.slots.map(s => s.id === id ? { ...s, progress: 35 } : s) })));
      const upload = await fetch("/api/documents/upload", { method: "POST", body: form });
      const uploadText = await upload.text();
      const uploadData = (uploadText ? JSON.parse(uploadText) : {}) as { id?: string; existingDocumentId?: string; message?: string; error?: string };
      if (!upload.ok) throw new Error(uploadData.message || uploadData.error || "Échec du téléversement");
      const documentId = uploadData.id;
      if (!documentId) throw new Error("Le serveur n’a pas retourné l’identifiant du document. Veuillez réessayer.");
      setGroups(g => g.map(x => ({ ...x, slots: x.slots.map(s => s.id === id ? { ...s, status: "analyzing" as DocStatus, progress: 60, documentId, fileName: file.name } : s) })));
      const processed = await fetch(`/api/documents/${documentId}/process`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taxYear: 2025 }) });
      const processText = await processed.text();
      const processData = (processText ? JSON.parse(processText) : {}) as { status?: string; error?: string; detectedType?: string };
      if (!processed.ok || processData.status === "failed") throw new Error(processData.error || "Échec de l’analyse OCR");
      if (processData.status === "rejected") {
        setGroups(g => g.map(x => ({ ...x, slots: x.slots.map(s => s.id === id ? { ...s, status: "rejected" as DocStatus, progress: 100, documentId, fileName: file.name, errorMessage: `Type analysé : ${processData.detectedType ?? "inconnu"}. Aucun montant n’a été ajouté.` } : s) })));
        return;
      }
      setGroups(g => g.map(x => ({ ...x, slots: x.slots.map(s => s.id === id ? { ...s, status: "done" as DocStatus, progress: 100, documentId } : s) })));
    } catch (error) {
      setGroups(g => g.map(x => ({ ...x, slots: x.slots.map(s => s.id === id ? { ...s, status: "error" as DocStatus, progress: 0, errorMessage: error instanceof Error ? error.message : "Erreur inconnue" } : s) })));
    }
  }, [groups]);
  const docsPct = totalSlots > 0 ? Math.round((totalDone / totalSlots) * 100) : 0;

  return (
    <div style={{ background: "#f7f9f8", minHeight: "100vh" }}>
      <NavClient />

      <main style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px 80px" }}>

        {/* ── En-tête ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f1f1e", margin: "0 0 4px" }}>
            Mon dossier fiscal 2025
          </h1>
          <p style={{ fontSize: 13, color: "#526865", margin: 0, lineHeight: 1.5 }}>
            Téléversez vos feuillets — le système extrait les données automatiquement.
          </p>
        </div>

        {/* ── Progression globale ──────────────────────────────────── */}
        <div style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0f1f1e" }}>Documents analysés</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0b6b67" }}>{totalDone} / {totalSlots || "—"}</span>
          </div>
          <div style={{ height: 4, background: "#edf2f0", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${docsPct}%`, background: "#0b6b67", borderRadius: 4, transition: "width 500ms ease" }} />
          </div>

          {/* Flow OCR */}
          <div style={{ display: "flex", gap: 0, marginTop: 12, borderTop: "1px solid #edf2f0", paddingTop: 12 }}>
            {["Upload", "OCR", "Extraction", "Validation", "Calcul"].map((step, i) => (
              <div key={step} style={{ flex: 1, textAlign: "center" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", margin: "0 auto 4px",
                  background: i === 0 && totalSlots > 0 ? "#0b6b67" : "#edf2f0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  color: i === 0 && totalSlots > 0 ? "#fff" : "#a0b4b0",
                }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: 10, color: "#7a9c97" }}>{step}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Documents ajoutés ────────────────────────────────────── */}
        {groups.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            {groups.map(g => (
              <DocGroup
                key={g.typeCode}
                typeCode={g.typeCode}
                typeLabel={g.typeLabel}
                typeDesc={g.typeDesc}
                slots={g.slots}
                onUpload={handleUpload}
                onRemove={removeSlot}
                onAddSlot={addSlot}
              />
            ))}
          </div>
        )}

        {/* ── Sélecteur de type ou zone d'ajout ────────────────────── */}
        {showPicker ? (
          <div>
            <TypePicker onSelect={addGroup} />
            <button
              onClick={() => setShowPicker(false)}
              style={{ width: "100%", padding: "10px 0", borderRadius: 10, fontSize: 13, background: "transparent", color: "#7a9c97", border: "1px solid #dde8e5", cursor: "pointer" }}
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowPicker(true)}
            style={{
              width: "100%", padding: "18px 0", borderRadius: 12, fontSize: 14, fontWeight: 600,
              background: "#fff", color: "#0b6b67",
              border: "1.5px dashed #9fd4cc", cursor: "pointer",
              marginBottom: 16,
            }}
          >
            + Ajouter un document fiscal
          </button>
        )}

        {/* ── Types courants (raccourcis rapides) ──────────────────── */}
        {!showPicker && groups.length === 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#7a9c97", marginBottom: 8 }}>Documents courants</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {DOC_TYPES.slice(0, 8).map(t => (
                <button
                  key={t.code}
                  onClick={() => addGroup(t)}
                  style={{
                    padding: "10px 12px", borderRadius: 10, textAlign: "left",
                    background: "#fff", border: "1px solid #dde8e5", cursor: "pointer",
                    transition: "border-color 120ms",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "#9fd4cc")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "#dde8e5")}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0b6b67", marginBottom: 3 }}>{t.code}</div>
                  <div style={{ fontSize: 12, color: "#0f1f1e", fontWeight: 500, lineHeight: 1.3 }}>
                    {t.label.split(" — ")[1] || t.label}
                  </div>
                  <div style={{ fontSize: 10, color: "#7a9c97", marginTop: 2 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Séparateur ───────────────────────────────────────────── */}
        <div style={{ borderTop: "1px solid #dde8e5", margin: "20px 0" }} />

        {/* ── Questionnaire complémentaire ─────────────────────────── */}
        <div style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1f1e", marginBottom: 3 }}>
                Questions supplémentaires
              </div>
              <div style={{ fontSize: 12, color: "#526865", lineHeight: 1.4 }}>
                Bureau à domicile, véhicule, famille — ce qui ne figure pas sur les feuillets.
              </div>
            </div>
            <Link href="/questionnaire" style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: "#0b6b67", color: "#fff", textDecoration: "none", flexShrink: 0,
            }}>
              Commencer →
            </Link>
          </div>
        </div>

        {/* ── Résumé fiscal ────────────────────────────────────────── */}
        <Link href="/resume" style={{ textDecoration: "none" }}>
          <div style={{
            background: "#fff", border: "1px solid #dde8e5", borderRadius: 14,
            padding: "14px 16px", display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1f1e", marginBottom: 3 }}>
                Résumé fiscal préliminaire
              </div>
              <div style={{ fontSize: 12, color: "#526865" }}>Disponible après validation des documents.</div>
            </div>
            <span style={{ fontSize: 18, color: "#a0b4b0" }}>→</span>
          </div>
        </Link>

        {/* ── Note légale ──────────────────────────────────────────── */}
        <div style={{ marginTop: 20, fontSize: 11, color: "#a0b4b0", textAlign: "center", lineHeight: 1.5 }}>
          EasyTax produit des résultats <strong>préliminaires</strong>. Aucune déclaration n&apos;est transmise sans votre validation explicite.
        </div>

      </main>
    </div>
  );
}
