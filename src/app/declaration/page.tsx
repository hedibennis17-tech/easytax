"use client";
/**
 * /declaration — Page déclaration T1 + TP-1
 * Accordéon par section · Données synchronisées depuis la DB
 * Toutes les lignes éditables · Calcul en temps réel · Validation finale
 */
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { NavClient } from "@/components/NavClient";
import { useApp } from "@/components/ThemeProvider";
import { ProvincialResultNotice, ResultsNotices } from "@/components/declaration/ResultsNotices";
import type { QuestionnaireProgress } from "@/lib/questionnaire-progress";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DeclarationLine {
  line: string;
  label_fr: string;
  label_en: string;
  section: string;
  amountCents: number;
  isEditable: boolean;
  source: "ocr" | "manual" | "calculated" | "empty";
  bold?: boolean;
  isTotal?: boolean;
  formula?: string;
}

interface DeclarationData {
  meta: {
    taxYear: number;
    province: string;
    provinceName: string;
    form: string;
    provincialForm: string;
    provincialAuthority: string;
    isQC: boolean;
    profileName: string;
    sinLastFour: string | null;
    address: string;
    isPreliminary: boolean;
  };
  t1: DeclarationLine[];
  tp1: DeclarationLine[];
  summary: {
    totalRevenuCents: number;
    revenuNetCents: number;
    revenuImposableCents: number;
    federal: { taxBeforeCredits: number; nonRefundableCredits: number; refundableCredits: number; taxPayable: number; withheld: number; balance: number; isRefund: boolean };
    provincial: { taxBeforeCredits: number; nonRefundableCredits: number; refundableCredits: number; taxPayable: number; withheld: number; balance: number; isRefund: boolean };
    totalBalance: number;
    isRefund: boolean;
  };
  questionnaireProgress: QuestionnaireProgress | null;
  questionnaireDatabase: {
    sessionId: string;
    questionnaireType: string;
    status: string;
    currentStep: string | null;
    progressPct: number;
    syncedEntries: number;
    pendingEntries: number;
  } | null;
  questionnaireAnswers: Array<{
    id: string;
    section: string;
    sectionFr: string;
    sectionEn: string;
    questionFr: string;
    questionEn: string;
    type: string;
    value: unknown;
    displayValue: string;
    validated: boolean;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtCAD(cents: number): string {
  if (cents === 0) return "—";
  return (cents / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2 }) + " $";
}
function parseCents(s: string): number {
  const n = parseFloat(s.replace(/[$,\s ]/g, "").replace(",", "."));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function QuestionnaireProgressCard({ progress, database, lang }: { progress: QuestionnaireProgress | null; database: DeclarationData["questionnaireDatabase"]; lang: string }) {
  const T = (fr: string, en: string) => lang === "en" ? en : fr;
  const [isOpen, setIsOpen] = useState(true);
  if (!progress) {
    return (
      <div style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f1f1e" }}>{T("Progression du questionnaire", "Questionnaire progress")}</div>
        <div style={{ color: "#7a9c97", fontSize: 12, marginTop: 5 }}>{T("Aucun brouillon détaillé n’est encore enregistré.", "No detailed draft has been saved yet.")}</div>
      </div>
    );
  }
  return (
    <section aria-label={T("Résumé du questionnaire", "Questionnaire summary")} style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
      <button type="button" onClick={() => setIsOpen(value => !value)} aria-expanded={isOpen}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 16px", background: "transparent", border: 0, cursor: "pointer", textAlign: "left" }}>
        <span>
          <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: "#0f1f1e" }}>{T("Résumé du questionnaire", "Questionnaire summary")}</span>
          <span style={{ display: "block", fontSize: 11, color: "#7a9c97", marginTop: 2 }}>{progress.questionsAnswered} / {progress.questionsApplicable} {T("questions répondues", "questions answered")}{progress.province ? ` · ${progress.province}` : ""}</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}><strong style={{ color: "#0b6b67", fontSize: 20 }}>{progress.globalPercent}%</strong><span aria-hidden="true" style={{ color: "#0b6b67", fontSize: 20, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 160ms" }}>⌄</span></span>
      </button>
      {isOpen && <div style={{ padding: "0 16px 14px" }}>
        <div style={{ height: 8, background: "#e8f1ef", borderRadius: 99, overflow: "hidden", marginBottom: 12 }}><div style={{ width: `${Math.min(100, Math.max(0, progress.globalPercent))}%`, height: "100%", background: "#0b6b67", borderRadius: 99 }} /></div>
        <div style={{ display: "grid", gap: 7 }}>
          {progress.sections.map(section => (
            <div key={section.code} style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) 1.5fr auto", gap: 8, alignItems: "center", fontSize: 11 }}>
              <span style={{ color: "#526865", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{section.icon} {lang === "en" ? section.en : section.fr}</span>
              <div style={{ height: 5, background: "#eef4f2", borderRadius: 99, overflow: "hidden" }}><div style={{ width: `${section.percent}%`, height: "100%", background: section.completed ? "#059669" : "#9fd4cc", borderRadius: 99 }} /></div>
              <span style={{ minWidth: 62, textAlign: "right", color: section.completed ? "#059669" : "#7a9c97" }}>{section.answered}/{section.total} · {section.percent}%</span>
            </div>
          ))}
        </div>
        {database && <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #eef4f2", display: "flex", flexWrap: "wrap", gap: 8, fontSize: 10, color: "#526865" }}>
          <span>{T("État", "Status")}: <strong>{database.status}</strong></span><span>{T("Étape", "Step")}: <strong>{database.currentStep ?? "—"}</strong></span><span>{T("Entrées synchronisées", "Synced entries")}: <strong>{database.syncedEntries}</strong></span>{database.pendingEntries > 0 && <span style={{ color: "#d97706" }}>{T("À synchroniser", "Pending")}: <strong>{database.pendingEntries}</strong></span>}
        </div>}
        <div style={{ color: "#a0b4b0", fontSize: 10, marginTop: 10 }}>{T("Les réponses sont sauvegardées automatiquement après chaque étape.", "Answers are saved automatically after each step.")}</div>
      </div>}
    </section>
  );
}

function QuestionnaireAnswersAccordion({ answers, progress, provinceName, lang }: {
  answers: DeclarationData["questionnaireAnswers"];
  progress: QuestionnaireProgress | null;
  provinceName: string;
  lang: string;
}) {
  const T = (fr: string, en: string) => lang === "en" ? en : fr;
  const [rows, setRows] = useState(answers);
  const [openSector, setOpenSector] = useState<"federal" | "provincial">("federal");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => setRows(answers), [answers]);
  const provincial = rows.filter(row => row.section === "ma_province");
  const federal = rows.filter(row => row.section !== "ma_province");
  const sections = (items: typeof rows) => Array.from(new Set(items.map(row => row.section))).map(code => ({
    code,
    rows: items.filter(row => row.section === code),
    titleFr: items.find(row => row.section === code)?.sectionFr ?? code,
    titleEn: items.find(row => row.section === code)?.sectionEn ?? code,
  }));
  const federalProgress = progress?.sections.filter(section => section.code !== "ma_province").reduce((sum, section) => sum + section.total, 0) ?? federal.length;
  const federalAnswered = progress?.sections.filter(section => section.code !== "ma_province").reduce((sum, section) => sum + section.answered, 0) ?? federal.length;
  const provincialProgress = progress?.sections.find(section => section.code === "ma_province");

  const updateRow = async (id: string, value: unknown, validated?: boolean) => {
    const response = await fetch("/api/questionnaire/answer", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: id, value, validated }) });
    if (!response.ok) throw new Error("save failed");
    setRows(current => current.map(row => row.id === id ? { ...row, value, displayValue: String(value), validated: validated ?? row.validated } : row));
  };
  const removeRow = async (id: string) => {
    const response = await fetch("/api/questionnaire/answer", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: id }) });
    if (!response.ok) throw new Error("delete failed");
    setRows(current => current.filter(row => row.id !== id));
  };
  const renderSector = (sector: "federal" | "provincial", items: typeof rows, answered: number, total: number, percent: number) => (
    <div style={{ border: "1px solid #dde8e5", borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
      <button type="button" onClick={() => setOpenSector(openSector === sector ? "federal" : sector)} aria-expanded={openSector === sector}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 14px", background: "#fff", border: 0, cursor: "pointer", textAlign: "left" }}>
        <span><strong style={{ color: "#0f1f1e" }}>{sector === "federal" ? "🇨🇦 " + T("Fédéral", "Federal") : `🏛️ ${provinceName}`}</strong><span style={{ display: "block", color: "#7a9c97", fontSize: 11, marginTop: 3 }}>{answered}/{total} {T("questions", "questions")} · {percent}% · {items.length} {T("réponses sauvegardées", "saved answers")}</span></span>
        <span style={{ color: "#0b6b67", fontSize: 20, transform: openSector === sector ? "rotate(180deg)" : "none", transition: "transform 160ms" }}>⌄</span>
      </button>
      {openSector === sector && <div style={{ padding: "0 10px 10px", background: "#fbfdfc" }}>
        {sections(items).map(section => {
          const open = openSections[`${sector}-${section.code}`] ?? true;
          return <div key={section.code} style={{ borderTop: "1px solid #eef4f2" }}>
            <button type="button" onClick={() => setOpenSections(current => ({ ...current, [`${sector}-${section.code}`]: !open }))} aria-expanded={open}
              style={{ width: "100%", display: "flex", justifyContent: "space-between", padding: "10px 4px", background: "transparent", border: 0, cursor: "pointer", textAlign: "left" }}>
              <strong style={{ fontSize: 12, color: "#526865" }}>{section.titleFr === section.titleEn ? section.titleFr : lang === "en" ? section.titleEn : section.titleFr} <span style={{ color: "#9fd4cc" }}>({section.rows.length})</span></strong><span style={{ color: "#0b6b67" }}>{open ? "−" : "+"}</span>
            </button>
            {open && section.rows.map(row => <div key={row.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(150px,0.8fr) auto", gap: 8, alignItems: "center", padding: "9px 4px", borderTop: "1px solid #f0f4f3" }}>
              <div><div style={{ fontSize: 12, color: "#0f1f1e" }}>{lang === "en" ? row.questionEn : row.questionFr}</div><div style={{ fontFamily: "monospace", fontSize: 9, color: "#9fd4cc", marginTop: 2 }}>{row.id}</div></div>
              {editing === row.id ? <input autoFocus value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { updateRow(row.id, draft).then(() => setEditing(null)).catch(() => {}); } }} style={{ width: "100%", padding: "6px 8px", border: "1px solid #0b6b67", borderRadius: 6, fontSize: 12 }} /> : <div style={{ fontSize: 12, color: "#0f1f1e", background: "#fff", borderRadius: 6, padding: "6px 8px", border: "1px solid #eef4f2", wordBreak: "break-word" }}>{row.displayValue}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, flexWrap: "wrap" }}>
                {editing === row.id ? <button type="button" onClick={() => { updateRow(row.id, draft).then(() => setEditing(null)).catch(() => {}); }} style={{ color: "#fff", background: "#0b6b67", border: 0, borderRadius: 5, padding: "5px 7px", cursor: "pointer", fontSize: 10 }}>{T("Enregistrer", "Save")}</button> : <button type="button" onClick={() => { setEditing(row.id); setDraft(row.displayValue); }} style={{ color: "#0b6b67", background: "#fff", border: "1px solid #9fd4cc", borderRadius: 5, padding: "5px 7px", cursor: "pointer", fontSize: 10 }}>{T("Modifier", "Edit")}</button>}
                <button type="button" onClick={() => updateRow(row.id, row.value, true).catch(() => {})} style={{ color: row.validated ? "#059669" : "#526865", background: row.validated ? "#ecfdf5" : "#fff", border: "1px solid #d1e8df", borderRadius: 5, padding: "5px 7px", cursor: "pointer", fontSize: 10 }}>{row.validated ? "✓ " + T("Validée", "Validated") : T("Valider", "Validate")}</button>
                <button type="button" onClick={() => { if (window.confirm(T("Supprimer cette réponse ?", "Delete this answer?"))) removeRow(row.id).catch(() => {}); }} style={{ color: "#b91c1c", background: "#fff", border: "1px solid #fecaca", borderRadius: 5, padding: "5px 7px", cursor: "pointer", fontSize: 10 }}>{T("Supprimer", "Delete")}</button>
              </div>
            </div>)}
          </div>;
        })}
        {items.length === 0 && <div style={{ padding: "12px 4px", color: "#9ca3af", fontSize: 11 }}>{T("Aucune réponse enregistrée dans ce secteur.", "No answer saved in this sector.")}</div>}
      </div>}
    </div>
  );
  return <section aria-label={T("Réponses du rapport fiscal", "Tax report answers")} style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "4px 2px 8px" }}><strong style={{ color: "#0f1f1e", fontSize: 15 }}>{T("Réponses du rapport fiscal", "Tax report answers")}</strong><span style={{ color: "#7a9c97", fontSize: 11 }}>{rows.length} {T("réponses", "answers")}</span></div>
    {renderSector("federal", federal, federalAnswered, federalProgress, federalProgress ? Math.round((federalAnswered / federalProgress) * 100) : 0)}
    {renderSector("provincial", provincial, provincialProgress?.answered ?? provincial.length, provincialProgress?.total ?? provincial.length, provincialProgress?.percent ?? (provincial.length ? 100 : 0))}
  </section>;
}

// ─── Ligne éditable inline ────────────────────────────────────────────────────
function LineRow({ line: l, onEdit }: { line: DeclarationLine; onEdit: (line: string, cents: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");

  const startEdit = () => {
    if (l.isTotal) return;
    setVal(l.amountCents ? (l.amountCents / 100).toFixed(2) : "");
    setEditing(true);
  };
  const commit = () => {
    onEdit(l.line, parseCents(val));
    setEditing(false);
  };

  const sourceDot: Record<string, string> = {
    ocr:        "#059669",
    manual:     "#d97706",
    calculated: "#3b82f6",
    empty:      "#e5e7eb",
  };
  const dotColor = sourceDot[l.source] ?? "#e5e7eb";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 0", borderBottom: "1px solid #f3f4f6",
      background: l.isTotal ? "rgba(11,107,103,0.04)" : "transparent",
    }}>
      {/* Numéro de ligne */}
      <span style={{ fontFamily: "monospace", fontSize: 10, color: "#9fd4cc", minWidth: 40, flexShrink: 0 }}>
        {l.line}
      </span>

      {/* Point source */}
      <span title={l.source} style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />

      {/* Label */}
      <span style={{ flex: 1, fontSize: 13, color: "#0f1f1e", fontWeight: l.bold ? 700 : 400, lineHeight: 1.4 }}>
        {l.label_fr}
      </span>

      {/* Montant */}
      {editing ? (
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <input autoFocus value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            style={{ width: 100, padding: "4px 8px", border: "1.5px solid #0b6b67", borderRadius: 6, fontFamily: "monospace", fontSize: 12, textAlign: "right" }} />
          <button onClick={commit} style={{ background: "#0b6b67", color: "#fff", border: "none", borderRadius: 5, width: 26, height: 26, cursor: "pointer", fontWeight: 700 }}>✓</button>
          <button onClick={() => setEditing(false)} style={{ background: "#f7f9f8", color: "#9ca3af", border: "1px solid #e5e7eb", borderRadius: 5, width: 26, height: 26, cursor: "pointer" }}>✕</button>
        </div>
      ) : (
        <div onClick={l.isTotal ? undefined : startEdit}
          style={{ minWidth: 110, textAlign: "right", cursor: l.isTotal ? "default" : "pointer", flexShrink: 0 }}>
          <span style={{ fontFamily: "monospace", fontWeight: l.bold ? 700 : 600, fontSize: l.bold ? 15 : 13,
            color: l.bold ? "#0b6b67" : l.amountCents > 0 ? "#0f1f1e" : "#d1d5db" }}>
            {fmtCAD(l.amountCents)}
          </span>
          {!l.isTotal && (
            <div style={{ fontSize: 8, color: "#c4cfcd", marginTop: 1 }}>
              {l.source === "ocr" ? "OCR ✓" : l.source === "manual" ? "Manuel ✏" : l.source === "calculated" ? "Calculé" : "Cliquer pour saisir"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Accordéon section ────────────────────────────────────────────────────────
interface AccordionSection {
  id: string;
  icon: string;
  title_fr: string;
  title_en: string;
  lines: DeclarationLine[];
  totalCents: number;
  filledCount: number;
}

function AccordionPanel({
  section, lang, defaultOpen, onEdit,
}: {
  section: AccordionSection;
  lang: string;
  defaultOpen: boolean;
  onEdit: (line: string, cents: number) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const T = (fr: string, en: string) => lang === "en" ? en : fr;

  const hasData = section.filledCount > 0;
  const borderColor = open ? "#0b6b67" : hasData ? "#9fd4cc" : "#e5e7eb";
  const headerBg = open ? "rgba(11,107,103,0.05)" : "#fff";

  return (
    <div style={{ border: `1.5px solid ${borderColor}`, borderRadius: 12, marginBottom: 8, overflow: "hidden", transition: "border-color 200ms" }}>
      {/* Header accordéon */}
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", padding: "12px 14px", background: headerBg, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{section.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0f1f1e" }}>
            {lang === "en" ? section.title_en : section.title_fr}
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
            {section.filledCount > 0
              ? `${section.filledCount} ligne${section.filledCount > 1 ? "s" : ""} remplie${section.filledCount > 1 ? "s" : ""}`
              : T("Aucune donnée — cliquer pour saisir", "No data — click to enter")}
          </div>
        </div>
        {/* Total de la section */}
        {section.totalCents !== 0 && (
          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: "#0b6b67", flexShrink: 0 }}>
            {fmtCAD(Math.abs(section.totalCents))}
          </span>
        )}
        {/* Badge nombre de lignes remplies */}
        {section.filledCount > 0 && (
          <span style={{ background: "#0b6b67", color: "#fff", borderRadius: 100, fontSize: 10, fontWeight: 700, padding: "2px 7px", flexShrink: 0 }}>
            {section.filledCount}
          </span>
        )}
        <span style={{ color: "#9fd4cc", fontSize: 14, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Contenu dépliable */}
      {open && (
        <div style={{ padding: "4px 14px 12px" }}>
          {section.lines.map(l => (
            <LineRow key={l.line} line={l} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════
export default function DeclarationPage() {
  const router = useRouter();
  const { lang } = useApp();
  const T = (fr: string, en: string) => lang === "en" ? en : fr;

  const [data,       setData]       = useState<DeclarationData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [t1Lines,    setT1Lines]    = useState<DeclarationLine[]>([]);
  const [tp1Lines,   setTp1Lines]   = useState<DeclarationLine[]>([]);
  const [activeTab,  setActiveTab]  = useState<"t1" | "provincial" | "resume">("resume");
  const [saving,     setSaving]     = useState(false);

  // ── Charger les données ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/declaration")
      .then(r => r.ok ? r.json() : null)
      .then((d: DeclarationData | null) => {
        if (!d) return;
        setData(d);
        setT1Lines(d.t1 ?? []);
        setTp1Lines(d.tp1 ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Éditer une ligne ────────────────────────────────────────────────────────
  const editT1 = useCallback((line: string, cents: number) => {
    setT1Lines(prev => prev.map(l => l.line === line ? { ...l, amountCents: cents, source: "manual" } : l));
    // Sauvegarder en DB (debounced via API)
    fetch("/api/declaration/edit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ form: "t1", line, amountCents: cents }),
    }).catch(() => {});
  }, []);

  const editTp1 = useCallback((line: string, cents: number) => {
    setTp1Lines(prev => prev.map(l => l.line === line ? { ...l, amountCents: cents, source: "manual" } : l));
    fetch("/api/declaration/edit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ form: "tp1", line, amountCents: cents }),
    }).catch(() => {});
  }, []);

  // ── Calculer les totaux en temps réel ───────────────────────────────────────
  const totalRevenu = t1Lines
    .filter(l => parseInt(l.line) >= 10000 && parseInt(l.line) <= 14999)
    .reduce((s, l) => s + l.amountCents, 0);

  const totalDed = t1Lines
    .filter(l => parseInt(l.line) >= 20600 && parseInt(l.line) <= 25999)
    .reduce((s, l) => s + l.amountCents, 0);

  const revenuNet = Math.max(0, totalRevenu - totalDed);

  const totalRetenu = t1Lines
    .filter(l => l.line === "43700")
    .reduce((s, l) => s + l.amountCents, 0);

  // ── Organiser les sections T1 en accordéon ──────────────────────────────────
  const buildT1Sections = (): AccordionSection[] => [
    {
      id: "revenus", icon: "💰", title_fr: "Revenus (lignes 10100 – 14999)", title_en: "Income (lines 10100 – 14999)",
      lines: t1Lines.filter(l => l.section === "revenus"),
      totalCents: t1Lines.filter(l => l.section === "revenus").reduce((s, l) => s + l.amountCents, 0),
      filledCount: t1Lines.filter(l => l.section === "revenus" && l.amountCents > 0).length,
    },
    {
      id: "total_revenu", icon: "📊", title_fr: "Revenu total (ligne 15000)", title_en: "Total income (line 15000)",
      lines: t1Lines.filter(l => l.line === "15000"),
      totalCents: totalRevenu,
      filledCount: totalRevenu > 0 ? 1 : 0,
    },
    {
      id: "deductions", icon: "📉", title_fr: "Déductions (lignes 20600 – 25999)", title_en: "Deductions (lines 20600 – 25999)",
      lines: t1Lines.filter(l => l.section === "deductions"),
      totalCents: totalDed,
      filledCount: t1Lines.filter(l => l.section === "deductions" && l.amountCents > 0).length,
    },
    {
      id: "revenu_net", icon: "📋", title_fr: "Revenu net & imposable (23600 / 26000)", title_en: "Net & taxable income (23600 / 26000)",
      lines: t1Lines.filter(l => ["23600","26000"].includes(l.line)),
      totalCents: revenuNet,
      filledCount: revenuNet > 0 ? 1 : 0,
    },
    {
      id: "credits", icon: "🎁", title_fr: "Crédits non remboursables (lignes 30000 – 34900)", title_en: "Non-refundable credits (lines 30000 – 34900)",
      lines: t1Lines.filter(l => l.section === "credits"),
      totalCents: t1Lines.filter(l => l.section === "credits").reduce((s, l) => s + l.amountCents, 0),
      filledCount: t1Lines.filter(l => l.section === "credits" && l.amountCents > 0).length,
    },
    {
      id: "retenues", icon: "🏦", title_fr: "Impôt retenu & crédits remboursables (43700+)", title_en: "Tax withheld & refundable credits (43700+)",
      lines: t1Lines.filter(l => l.section === "retenues"),
      totalCents: totalRetenu,
      filledCount: t1Lines.filter(l => l.section === "retenues" && l.amountCents > 0).length,
    },
    {
      id: "solde", icon: "💳", title_fr: "Remboursement / Solde dû (48400 / 48500)", title_en: "Refund / Balance owing (48400 / 48500)",
      lines: t1Lines.filter(l => l.section === "solde"),
      totalCents: t1Lines.filter(l => l.section === "solde").reduce((s, l) => s + l.amountCents, 0),
      filledCount: t1Lines.filter(l => l.section === "solde" && l.amountCents !== 0).length,
    },
  ];

  const buildTp1Sections = (): AccordionSection[] => [
    {
      id: "revenus_qc", icon: "💰", title_fr: "Revenus (lignes 100 – 199)", title_en: "Income (lines 100 – 199)",
      lines: tp1Lines.filter(l => l.section === "revenus"),
      totalCents: tp1Lines.filter(l => l.section === "revenus").reduce((s, l) => s + l.amountCents, 0),
      filledCount: tp1Lines.filter(l => l.section === "revenus" && l.amountCents > 0).length,
    },
    {
      id: "totaux_qc", icon: "📊", title_fr: "Totaux (199 / 275 / 299)", title_en: "Totals (199 / 275 / 299)",
      lines: tp1Lines.filter(l => l.section === "totaux"),
      totalCents: tp1Lines.filter(l => l.section === "totaux").reduce((s, l) => s + l.amountCents, 0),
      filledCount: tp1Lines.filter(l => l.section === "totaux" && l.amountCents > 0).length,
    },
    {
      id: "deductions_qc", icon: "📉", title_fr: "Déductions (lignes 201 – 297)", title_en: "Deductions (lines 201 – 297)",
      lines: tp1Lines.filter(l => l.section === "deductions"),
      totalCents: tp1Lines.filter(l => l.section === "deductions").reduce((s, l) => s + l.amountCents, 0),
      filledCount: tp1Lines.filter(l => l.section === "deductions" && l.amountCents > 0).length,
    },
    {
      id: "credits_qc", icon: "🎁", title_fr: "Crédits (lignes 350 – 465)", title_en: "Credits (lines 350 – 465)",
      lines: tp1Lines.filter(l => l.section === "credits"),
      totalCents: tp1Lines.filter(l => l.section === "credits").reduce((s, l) => s + l.amountCents, 0),
      filledCount: tp1Lines.filter(l => l.section === "credits" && l.amountCents > 0).length,
    },
    {
      id: "impot_qc", icon: "🏛️", title_fr: "Impôt et cotisations (401 / 430 / 450)", title_en: "Tax and contributions (401 / 430 / 450)",
      lines: tp1Lines.filter(l => l.section === "impot"),
      totalCents: tp1Lines.filter(l => l.section === "impot").reduce((s, l) => s + l.amountCents, 0),
      filledCount: tp1Lines.filter(l => l.section === "impot" && l.amountCents > 0).length,
    },
    {
      id: "retenues_qc", icon: "🏦", title_fr: "Retenues & paiements (451 – 465)", title_en: "Withholdings & payments (451 – 465)",
      lines: tp1Lines.filter(l => l.section === "retenues"),
      totalCents: tp1Lines.filter(l => l.section === "retenues").reduce((s, l) => s + l.amountCents, 0),
      filledCount: tp1Lines.filter(l => l.section === "retenues" && l.amountCents > 0).length,
    },
    {
      id: "solde_qc", icon: "💳", title_fr: "Remboursement / Solde à payer (474 / 475)", title_en: "Refund / Balance (474 / 475)",
      lines: tp1Lines.filter(l => l.section === "solde"),
      totalCents: tp1Lines.filter(l => l.section === "solde").reduce((s, l) => s + l.amountCents, 0),
      filledCount: tp1Lines.filter(l => l.section === "solde" && l.amountCents !== 0).length,
    },
  ];

  // Variables calculées — avant tout return (data peut être null)
  const isQC        = data?.meta.isQC ?? false;
  const t1Sections  = data ? buildT1Sections() : [];
  const tp1Sections = data ? buildTp1Sections() : [];
  const totalT1Filled  = t1Sections.reduce((s, sec) => s + sec.filledCount, 0);
  const totalTp1Filled = tp1Sections.reduce((s, sec) => s + sec.filledCount, 0);
  const TABS = [
    { id: "resume" as const, label: T("📊 Résumé","📊 Summary") },
    { id: "t1"     as const, label: `🇨🇦 T1 — Fédéral (${totalT1Filled})` },
    {
      id: "provincial" as const,
      label: isQC
        ? `⚜️ Québec — TP-1 (${totalTp1Filled})`
        : `🏛️ ${data?.meta.provinceName ?? T("Province", "Province")} — ${data?.meta.provincialForm ?? "428"}`,
    },
  ];

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base,#f7f9f8)" }}>
      <NavClient />
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh", flexDirection: "column", gap: 12 }}>
        <div style={{ width: 36, height: 36, border: "4px solid #dde8e5", borderTopColor: "#0b6b67", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <div style={{ fontSize: 13, color: "#7a9c97" }}>{T("Chargement de votre déclaration...","Loading your return...")}</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base,#f7f9f8)" }}>
      <NavClient />
      <main style={{ maxWidth: 620, margin: "0 auto", padding: "48px 18px" }}>
        <div style={{ background: "#fff", border: "1px solid #fde2e2", borderRadius: 14, padding: 20, color: "#8b1e1e" }}>
          {T("Les données de la déclaration ne sont pas disponibles pour le moment. Réessayez après avoir complété votre profil.",
             "Return data is not available yet. Try again after completing your profile.")}
        </div>
      </main>
    </div>
  );



  return (
    <div style={{ background: "var(--bg-base,#f7f9f8)", minHeight: "100vh" }}>
      <NavClient />
      <main style={{ maxWidth: 780, margin: "0 auto", padding: "16px 14px 80px" }}>

        {/* ── En-tête ───────────────────────────────────────────────────── */}
        <div style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 14, padding: "14px 16px", marginBottom: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontFamily: "Georgia,serif", fontSize: "clamp(1.2rem,3vw,1.6rem)", margin: "0 0 4px", color: "#0f1f1e" }}>
                📋 {T("Déclaration de revenus","Income Tax Return")} {data?.meta.taxYear ?? 2025}
              </h1>
              <div style={{ fontSize: 12, color: "#7a9c97" }}>
                {data?.meta.profileName}
                {data?.meta.sinLastFour && <span style={{ color: "#9fd4cc", marginLeft: 8 }}>NAS ···· {data.meta.sinLastFour}</span>}
                {" · "}{data?.meta.provinceName ?? ""}{" · "}{data?.meta.form ?? "T1"}
              </div>
              {data?.meta.address && <div style={{ fontSize: 10, color: "#a0b4b0", marginTop: 2 }}>{data.meta.address}</div>}
            </div>
            <button onClick={() => router.push("/questionnaire")}
              style={{ padding: "7px 12px", fontSize: 11, color: "#0b6b67", background: "transparent", border: "1px solid #9fd4cc", borderRadius: 8, cursor: "pointer" }}>
              ✏️ {T("Modifier les réponses","Edit answers")}
            </button>
          </div>
          {/* Bandeau préliminaire */}
          <div style={{ marginTop: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "6px 12px", fontSize: 11, color: "#92400e" }}>
            ⚠️ {T("Résultats PRÉLIMINAIRES — aucune déclaration n'est transmise sans votre validation explicite.",
                   "PRELIMINARY results — no return is filed without your explicit approval.")}
          </div>
        </div>

        {/* ── Onglets ───────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", scrollbarWidth: "none" }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 9, fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap",
                background: activeTab === tab.id ? "#0b6b67" : "#fff",
                color: activeTab === tab.id ? "#fff" : "#526865",
                border: `1px solid ${activeTab === tab.id ? "#0b6b67" : "#dde8e5"}` }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══ ONGLET RÉSUMÉ ════════════════════════════════════════════ */}
        {activeTab === "resume" && (
          <div>
            <QuestionnaireProgressCard progress={data.questionnaireProgress} database={data.questionnaireDatabase} lang={lang} />
            <QuestionnaireAnswersAccordion answers={data.questionnaireAnswers} progress={data.questionnaireProgress} provinceName={data.meta.provinceName} lang={lang} />
            <ResultsNotices
              lang={lang}
              taxYear={data.meta.taxYear}
              provinceName={data.meta.provinceName}
              provincialForm={data.meta.provincialForm}
              provincialAuthority={data.meta.provincialAuthority}
              totalIncomeCents={data.summary.totalRevenuCents}
              netIncomeCents={data.summary.revenuNetCents}
              taxableIncomeCents={data.summary.revenuImposableCents}
              federal={data.summary.federal}
              provincial={data.summary.provincial}
            />

            {/* Légende sources */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, marginBottom: 14, fontSize: 10, color: "#9ca3af" }}>
              {[
                { color: "#059669", label: T("OCR — extrait des feuillets","OCR — extracted from slips") },
                { color: "#d97706", label: T("Manuel — saisi par vous","Manual — entered by you") },
                { color: "#3b82f6", label: T("Calculé — moteur fiscal","Calculated — tax engine") },
                { color: "#e5e7eb", label: T("Vide — cliquer pour saisir","Empty — click to enter") },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                  {label}
                </div>
              ))}
            </div>

            {/* Accès rapide aux onglets */}
            <div style={{ display: "grid", gap: 8 }}>
              <button onClick={() => setActiveTab("t1")} style={{ padding: "12px 14px", background: "#fff", border: "1px solid #dde8e5", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#0f1f1e", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
                <span>🇨🇦 {T("Voir le détail T1 — fédéral (104 lignes)","View T1 federal detail (104 lines)")}</span>
                <span style={{ color: "#9fd4cc" }}>→</span>
              </button>
              <button onClick={() => setActiveTab("provincial")} style={{ padding: "12px 14px", background: "#fff", border: "1px solid #dde8e5", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#0f1f1e", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
                <span>{isQC ? "⚜️" : "🏛️"} {T(`Voir le détail provincial — ${data.meta.provinceName} (${data.meta.provincialForm})`, `View provincial result — ${data.meta.provinceName} (${data.meta.provincialForm})`)}</span>
                <span style={{ color: "#9fd4cc" }}>→</span>
              </button>
            </div>

            <div style={{ marginTop: 16, fontSize: 11, color: "#a0b4b0", textAlign: "center", lineHeight: 1.6 }}>
              {T("EasyTax produit des résultats préliminaires. La transmission officielle requiert un logiciel homologué NETFILE/ImpôtNet.",
                 "EasyTax produces preliminary results. Official filing requires NETFILE/ImpôtNet certified software.")}
            </div>
          </div>
        )}

        {/* ═══ ONGLET T1 — ACCORDÉON ════════════════════════════════════ */}
        {activeTab === "t1" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#7a9c97" }}>
                🇨🇦 {T("Déclaration fédérale T1 — 2025","Federal T1 return — 2025")}
                {" · "}{totalT1Filled} {T("ligne(s) remplie(s)","line(s) filled")}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => t1Sections.forEach(() => {})}
                  style={{ fontSize: 11, color: "#0b6b67", background: "transparent", border: "1px solid #9fd4cc", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>
                  {T("Tout replier","Collapse all")}
                </button>
              </div>
            </div>

            {t1Sections.map((section, i) => (
              <AccordionPanel
                key={section.id}
                section={section}
                lang={lang}
                defaultOpen={section.filledCount > 0 || i === 0}
                onEdit={editT1}
              />
            ))}
          </div>
        )}

        {/* ═══ ONGLET PROVINCIAL — ADAPTÉ À LA PROVINCE FISCALE ═════════ */}
        {activeTab === "provincial" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#7a9c97" }}>
                {isQC ? "⚜️" : "🏛️"} {isQC
                  ? T("Déclaration Québec TP-1 — 2025", "Quebec TP-1 return — 2025")
                  : T(`Résultat ${data.meta.provinceName} — ${data.meta.provincialForm} · 2025`, `${data.meta.provinceName} result — ${data.meta.provincialForm} · 2025`)}
                {isQC && <> {" · "}{totalTp1Filled} {T("ligne(s) remplie(s)","line(s) filled")}</>}
              </div>
            </div>

            {isQC ? tp1Sections.map((section, i) => (
                <AccordionPanel
                  key={section.id}
                  section={section}
                  lang={lang}
                  defaultOpen={section.filledCount > 0 || i === 0}
                  onEdit={editTp1}
                />
              )) : (
                <ProvincialResultNotice
                  lang={lang}
                  taxYear={data.meta.taxYear}
                  provinceName={data.meta.provinceName}
                  provincialForm={data.meta.provincialForm}
                  provincialAuthority={data.meta.provincialAuthority}
                  totalIncomeCents={data.summary.totalRevenuCents}
                  netIncomeCents={data.summary.revenuNetCents}
                  taxableIncomeCents={data.summary.revenuImposableCents}
                  provincial={data.summary.provincial}
                />
              )}
          </div>
        )}

      </main>
    </div>
  );
}
