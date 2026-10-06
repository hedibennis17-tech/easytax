"use client";
/**
 * CreditsSection.tsx
 * Section Crédits & Prestations du questionnaire EasyTax
 *
 * Affiche les 62 programmes applicables selon:
 *   - Province choisie au triage (t0)
 *   - Situation familiale (enfants, conjoint, âge)
 *   - Type de revenus (emploi, autonome)
 *
 * L'user clique "Je veux ce crédit" pour les activer.
 * Les prestations automatiques sont affichées en info seulement.
 */

import { useState, useMemo } from "react";
import { getProgramsForProvince, getApplicablePrograms, formatProgramSummary, type CreditProgram } from "@/lib/credits-prestations";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CreditSelection {
  [programId: string]: boolean;
}

// ─── Icônes par type ──────────────────────────────────────────────────────────
function typeIcon(type: string) {
  if (type === "prestation") return "💳";
  if (type === "credit_remboursable") return "💚";
  return "📋";
}

function typeBadge(type: string, lang: string) {
  const T = (fr: string, en: string) => lang === "en" ? en : fr;
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    prestation:              { bg: "rgba(59,130,246,0.1)",  color: "#1d4ed8", label: T("Prestation auto","Auto benefit") },
    credit_remboursable:     { bg: "rgba(5,150,105,0.1)",   color: "#065f46", label: T("Remboursable","Refundable") },
    credit_non_remboursable: { bg: "rgba(107,114,128,0.1)", color: "#374151", label: T("Non remboursable","Non-refundable") },
  };
  const s = styles[type] ?? styles.prestation;
  return (
    <span style={{ fontSize: 9, fontWeight: 700, background: s.bg, color: s.color, padding: "2px 7px", borderRadius: 100, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

// ─── Carte programme ──────────────────────────────────────────────────────────
function ProgramCard({
  prog, lang, selected, onToggle,
}: {
  prog: CreditProgram; lang: string; selected: boolean; onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const T = (fr: string, en: string) => lang === "en" ? en : fr;
  const summary = formatProgramSummary(prog, lang);

  const borderColor = selected ? "#0b6b67" : "var(--border, #dde8e5)";
  const bg = selected ? "rgba(11,107,103,0.04)" : "var(--bg-card, #fff)";

  return (
    <div style={{ border: `1.5px solid ${borderColor}`, borderRadius: 12, background: bg, marginBottom: 8, overflow: "hidden", transition: "all 150ms" }}>
      {/* Header */}
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{typeIcon(prog.type)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary, #0f1f1e)", marginBottom: 3 }}>
                {summary.name}
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {typeBadge(prog.type, lang)}
                {!prog.permanent && (
                  <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(245,158,11,0.1)", color: "#92400e", padding: "2px 7px", borderRadius: 100 }}>
                    {T("Temporaire","Temporary")}
                  </span>
                )}
                {prog.t1_line && (
                  <span style={{ fontSize: 9, color: "#9fd4cc", background: "#f0f9f8", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>
                    T1 → {prog.t1_line}
                  </span>
                )}
                {prog.tp1_line && (
                  <span style={{ fontSize: 9, color: "#9fd4cc", background: "#f0f9f8", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>
                    TP-1 → {prog.tp1_line}
                  </span>
                )}
              </div>
            </div>

            {/* Bouton sélection */}
            {summary.is_automatic ? (
              <div style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600, flexShrink: 0, background: "rgba(59,130,246,0.08)", padding: "4px 8px", borderRadius: 7 }}>
                {T("Versée auto","Auto-issued")}
              </div>
            ) : (
              <button onClick={onToggle}
                style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 150ms",
                  background: selected ? "#0b6b67" : "transparent",
                  color: selected ? "#fff" : "#0b6b67",
                  border: `1.5px solid #0b6b67` }}>
                {selected ? T("✓ Sélectionné","✓ Selected") : T("Sélectionner","Select")}
              </button>
            )}
          </div>

          {/* Description courte */}
          <div style={{ fontSize: 11, color: "var(--text-muted, #526865)", marginTop: 6, lineHeight: 1.5, cursor: "pointer" }}
            onClick={() => setExpanded(e => !e)}>
            {prog.description.slice(0, 120)}{prog.description.length > 120 ? "..." : ""}
            <span style={{ color: "#9fd4cc", marginLeft: 4 }}>{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
      </div>

      {/* Détails expandables */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border, #dde8e5)", padding: "12px 14px", background: "var(--bg-base, #f7f9f8)" }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary, #526865)", lineHeight: 1.6, marginBottom: 8 }}>
            {prog.description}
          </div>

          {/* Fréquence + formulaire */}
          <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
            {prog.frequency && (
              <div>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#9fd4cc", textTransform: "uppercase" }}>Fréquence</span>
                <div style={{ fontSize: 11, color: "var(--text-primary, #0f1f1e)" }}>{prog.frequency}</div>
              </div>
            )}
            {prog.form && (
              <div>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#9fd4cc", textTransform: "uppercase" }}>Formulaire</span>
                <div style={{ fontSize: 11, color: "var(--text-primary, #0f1f1e)", fontFamily: "monospace" }}>{prog.form}</div>
              </div>
            )}
            <div>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#9fd4cc", textTransform: "uppercase" }}>Imposable</span>
              <div style={{ fontSize: 11, color: prog.taxable ? "#dc2626" : "#059669" }}>{prog.taxable ? "Oui" : "Non"}</div>
            </div>
          </div>

          {/* Montants clés 2025 */}
          {prog.key_amounts && Object.keys(prog.key_amounts).length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#9fd4cc", textTransform: "uppercase", marginBottom: 5 }}>Montants clés</div>
              {Object.entries(prog.key_amounts).slice(-1).map(([year, amounts]) => (
                <div key={year} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 5 }}>
                  {typeof amounts === "object" && amounts !== null
                    ? Object.entries(amounts as Record<string, number>).map(([k, v]) => (
                        <div key={k} style={{ background: "#fff", border: "1px solid var(--border, #dde8e5)", borderRadius: 7, padding: "5px 8px" }}>
                          <div style={{ fontSize: 9, color: "#9fd4cc", textTransform: "capitalize", marginBottom: 2 }}>{k.replace(/_/g, " ")}</div>
                          <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: "#0f1f1e" }}>
                            {typeof v === "number" ? v.toLocaleString("fr-CA") + " $" : String(v)}
                          </div>
                        </div>
                      ))
                    : null}
                </div>
              ))}
            </div>
          )}

          {/* Changements notables */}
          {prog.notable_changes.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#9fd4cc", textTransform: "uppercase", marginBottom: 5 }}>Changements récents</div>
              {prog.notable_changes.slice(0, 3).map((change, i) => (
                <div key={i} style={{ fontSize: 10, color: "var(--text-secondary, #526865)", marginBottom: 3, paddingLeft: 10, borderLeft: "2px solid #9fd4cc" }}>
                  {change}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function CreditsSection({
  lang,
  province,
  answers,
  onComplete,
}: {
  lang: string;
  province: string;
  answers: Record<string, unknown>;
  onComplete: (selectedIds: string[]) => void;
}) {
  const T = (fr: string, en: string) => lang === "en" ? en : fr;
  const [selections, setSelections] = useState<CreditSelection>({});
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "remboursable" | "prestation">("all");

  // Programmes recommandés selon la situation
  const recommended = useMemo(() =>
    getApplicablePrograms(answers, province),
    [answers, province]
  );

  // Tous les programmes de la province
  const allPrograms = useMemo(() =>
    getProgramsForProvince(province),
    [province]
  );

  const displayed = showAll ? allPrograms : recommended;

  const filtered = displayed.filter(p => {
    if (filter === "all") return true;
    if (filter === "remboursable") return p.type !== "prestation";
    if (filter === "prestation") return p.type === "prestation";
    return true;
  });

  const toggleProgram = (id: string) => {
    setSelections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedIds = Object.entries(selections).filter(([, v]) => v).map(([k]) => k);
  const autoIds = recommended.filter(p => p.type === "prestation" && !p.t1_line && !p.tp1_line).map(p => p.id);

  // Grouper par catégorie pour l'affichage
  const federal = filtered.filter(p => !p.province);
  const provincial = filtered.filter(p => p.province === province);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: "2px solid var(--border, #dde8e5)" }}>
        <span style={{ fontSize: 26 }}>🎁</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "var(--text-primary, #0f1f1e)" }}>
            {T("Crédits & Prestations 2025", "Credits & Benefits 2025")}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted, #7a9c97)" }}>
            {T(`${recommended.length} programmes détectés selon votre situation · Sélectionnez ceux qui s'appliquent.`,
               `${recommended.length} programs detected based on your situation · Select those that apply.`)}
          </div>
        </div>
        {selectedIds.length > 0 && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: "#0b6b67", fontWeight: 700 }}>
              {selectedIds.length} {T("sélectionné(s)","selected")}
            </div>
          </div>
        )}
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", scrollbarWidth: "none" }}>
        {[
          { id: "all", label: T("Tous","All") },
          { id: "remboursable", label: T("Crédits","Credits") },
          { id: "prestation", label: T("Prestations","Benefits") },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id as typeof filter)}
            style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: filter === f.id ? 700 : 400, cursor: "pointer",
              background: filter === f.id ? "#0b6b67" : "var(--bg-card, #fff)",
              color: filter === f.id ? "#fff" : "var(--text-muted, #526865)",
              border: `1px solid ${filter === f.id ? "#0b6b67" : "var(--border, #dde8e5)"}` }}>
            {f.label}
          </button>
        ))}
        <button onClick={() => setShowAll(s => !s)}
          style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 7, fontSize: 11, cursor: "pointer", marginLeft: "auto",
            background: showAll ? "rgba(11,107,103,0.08)" : "var(--bg-card, #fff)",
            color: "#0b6b67", border: "1px solid #9fd4cc" }}>
          {showAll ? T(`← Suggérés (${recommended.length})`,`← Suggested (${recommended.length})`) : T(`Tous les programmes (${allPrograms.length})`,`All programs (${allPrograms.length})`)}
        </button>
      </div>

      {/* Prestations automatiques (info) */}
      {!showAll && autoIds.length > 0 && (
        <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", marginBottom: 4 }}>
            💳 {T("Prestations versées automatiquement (aucune démarche requise)","Benefits issued automatically (no action required)")}
          </div>
          <div style={{ fontSize: 11, color: "#1e40af" }}>
            {recommended
              .filter(p => p.type === "prestation" && !p.t1_line && !p.tp1_line)
              .map(p => lang === "en" ? p.name_en : p.name_fr)
              .join(" · ")}
          </div>
        </div>
      )}

      {/* Fédéraux */}
      {federal.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9fd4cc", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            🇨🇦 {T("Programmes fédéraux","Federal programs")} ({federal.length})
          </div>
          {federal.map(prog => (
            <ProgramCard key={prog.id} prog={prog} lang={lang}
              selected={!!selections[prog.id]}
              onToggle={() => toggleProgram(prog.id)} />
          ))}
        </div>
      )}

      {/* Provinciaux */}
      {provincial.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9fd4cc", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            {province === "QC" ? "⚜️" : "🏛️"} {T(`Programmes ${province}`,"Province programs")} ({provincial.length})
          </div>
          {provincial.map(prog => (
            <ProgramCard key={prog.id} prog={prog} lang={lang}
              selected={!!selections[prog.id]}
              onToggle={() => toggleProgram(prog.id)} />
          ))}
        </div>
      )}

      {/* Résumé sélection */}
      {selectedIds.length > 0 && (
        <div style={{ background: "rgba(11,107,103,0.05)", border: "1px solid rgba(11,107,103,0.2)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0b6b67", marginBottom: 6 }}>
            ✓ {selectedIds.length} {T("programme(s) sélectionné(s)","program(s) selected")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {selectedIds.map(id => {
              const prog = allPrograms.find(p => p.id === id);
              return prog ? (
                <span key={id} style={{ fontSize: 10, background: "#fff", border: "1px solid #9fd4cc", color: "#0b6b67", padding: "2px 8px", borderRadius: 100 }}>
                  {lang === "en" ? prog.name_en : prog.name_fr}
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* Bouton continuer */}
      <button onClick={() => onComplete([...selectedIds, ...autoIds])}
        style={{ width: "100%", padding: "13px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, background: "#0b6b67", color: "#fff", border: "none", cursor: "pointer" }}>
        {selectedIds.length > 0
          ? T(`Continuer avec ${selectedIds.length} crédit(s) sélectionné(s) →`,`Continue with ${selectedIds.length} credit(s) selected →`)
          : T("Continuer →","Continue →")}
      </button>
    </div>
  );
}
