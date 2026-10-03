"use client";
import { NavClient } from "@/components/NavClient";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  QUESTION_DEFINITIONS,
  getApplicableQuestions,
  getModulesToActivate,
  calculateProgress,
  getRequiredDocuments,
  MODULE_LABELS,
  type ModuleCode,
  type QuestionDef,
} from "@/lib/questionnaire-engine";

// ── SECTIONS avec ordre et labels ─────────────────────────────────────────────
const SECTIONS = [
  { code: "identity",        fr: "Identité",          en: "Identity",        icon: "👤" },
  { code: "employment",      fr: "Emploi",            en: "Employment",      icon: "💼" },
  { code: "self_employment", fr: "Travail autonome",  en: "Self-employment", icon: "🧑‍💼" },
  { code: "investment",      fr: "Revenus & location",en: "Income & rental", icon: "📈" },
  { code: "deductions",      fr: "Déductions",        en: "Deductions",      icon: "📉" },
  { code: "family",          fr: "Famille",           en: "Family",          icon: "👨‍👩‍👧" },
  { code: "credits",         fr: "Crédits",           en: "Credits",         icon: "✅" },
  { code: "provincial",      fr: "Québec",            en: "Quebec",          icon: "⚜️" },
] as const;

type Lang = "fr" | "en";

export default function QuestionnairePage() {
  const router = useRouter();
  const [lang] = useState<Lang>("fr");

  // Redirect admin vers /admin — le questionnaire est pour les INDIVIDUAL uniquement
  useEffect(() => {
    fetch("/api/user/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.role && ["ADMIN", "SUPER_ADMIN", "BUSINESS", "PREPARER"].includes(data.role)) {
          const redirectMap: Record<string, string> = {
            ADMIN: "/admin", SUPER_ADMIN: "/admin",
            BUSINESS: "/business", PREPARER: "/preparer",
          };
          router.replace(redirectMap[data.role] ?? "/dashboard");
        }
      })
      .catch(() => {});
  }, [router]);
  const t = (fr: string, en: string) => lang === "fr" ? fr : en;

  // État principal
  const [answers, setAnswers]           = useState<Record<string, string | boolean | null>>({});
  const [activeModules, setModules]     = useState<ModuleCode[]>([]);
  const [currentSection, setSection]    = useState(0);
  const [currentQIdx, setQIdx]          = useState(0);
  const [saving, setSaving]             = useState(false);
  const [done, setDone]                 = useState(false);
  const [textInput, setTextInput]       = useState("");
  const [numInput, setNumInput]         = useState("");

  // Questions applicables (recalculé à chaque réponse)
  const applicable = getApplicableQuestions("INDIVIDUAL", activeModules, answers);
  const sectionCode = SECTIONS[currentSection]?.code ?? "identity";
  const sectionQs   = applicable.filter((q) => q.section === sectionCode);
  const current: QuestionDef | undefined = sectionQs[currentQIdx];

  // Progression dynamique
  const requiredDocs = getRequiredDocuments(activeModules, answers);
  const progress = calculateProgress(applicable, answers, 0, requiredDocs.filter(d => d.required).length, 0);
  const sectionPct = sectionQs.length > 0
    ? Math.round((sectionQs.filter(q => answers[q.code] !== undefined && answers[q.code] !== null).length / sectionQs.length) * 100)
    : 100;

  // Modules actifs badges
  const modulesBadges = activeModules.filter(m => MODULE_LABELS[m]);

  const saveAnswer = useCallback(async (code: string, value: string | boolean) => {
    setSaving(true);
    const newAnswers = { ...answers, [code]: value };
    setAnswers(newAnswers);

    // Mettre à jour les modules actifs
    const newModules = getModulesToActivate(newAnswers);
    setModules(newModules);

    // Sauvegarde API
    try {
      await fetch("/api/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionCode: code,
          answerValue: String(value),
          taxReturnId: "current",
          taxYearId: "2025",
        }),
      });
    } catch { /* silencieux */ }
    setSaving(false);
  }, [answers]);

  const goNext = useCallback(() => {
    const nextIdx = currentQIdx + 1;
    if (nextIdx < sectionQs.length) {
      setQIdx(nextIdx);
      setTextInput(""); setNumInput("");
    } else {
      // Chercher la prochaine section avec des questions
      let foundSection = false;
      for (let s = currentSection + 1; s < SECTIONS.length; s++) {
        const nextSectionQs = applicable.filter(q => q.section === SECTIONS[s].code);
        if (nextSectionQs.length > 0) {
          setSection(s); setQIdx(0); setTextInput(""); setNumInput("");
          foundSection = true;
          break;
        }
      }
      if (!foundSection) setDone(true);
    }
  }, [currentQIdx, currentSection, sectionQs, applicable]);

  const handleBoolean = useCallback(async (value: boolean) => {
    if (!current) return;
    await saveAnswer(current.code, value);
    goNext();
  }, [current, saveAnswer, goNext]);

  const handleText = useCallback(async () => {
    if (!current || !textInput.trim()) return;
    await saveAnswer(current.code, textInput.trim());
    goNext();
  }, [current, textInput, saveAnswer, goNext]);

  const handleNumber = useCallback(async () => {
    if (!current || !numInput) return;
    await saveAnswer(current.code, numInput);
    goNext();
  }, [current, numInput, saveAnswer, goNext]);

  // ── VUE TERMINÉE ────────────────────────────────────────────────────────────
  if (done) {
    const docs = getRequiredDocuments(activeModules, answers);
    return (
      <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
        <NavClient />
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 16px" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
              {t("Questionnaire terminé !", "Questionnaire complete!")}
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              {t(`${progress.questionsAnswered} questions répondues · Progression globale : ${progress.globalPct} %`,
                 `${progress.questionsAnswered} questions answered · Overall progress: ${progress.globalPct}%`)}
            </p>
          </div>

          {/* Modules activés */}
          {modulesBadges.length > 0 && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 20px", marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
                {t("Modules activés pour votre dossier", "Modules activated for your file")}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {modulesBadges.map(m => {
                  const ml = MODULE_LABELS[m];
                  return (
                    <span key={m} style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 10px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                      background: "rgba(37,99,235,0.1)", color: "#2563EB",
                    }}>
                      {ml.icon} {lang === "fr" ? ml.fr : ml.en}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Documents requis */}
          {docs.length > 0 && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 20px", marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
                {t("Documents requis pour votre dossier", "Documents required for your file")}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {docs.map((doc, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "var(--bg-base)" }}>
                    <span style={{ fontSize: 16 }}>📄</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {lang === "fr" ? doc.labelFr : doc.labelEn}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100,
                      background: doc.required ? "rgba(220,38,38,0.1)" : "rgba(107,114,128,0.1)",
                      color: doc.required ? "#DC2626" : "#6B7280",
                    }}>
                      {doc.required ? t("Requis", "Required") : t("Optionnel", "Optional")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Avertissement */}
          <div style={{ background: "rgba(217,119,6,0.07)", border: "1px solid rgba(217,119,6,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#D97706" }}>
            ⚠️ {t("Ces résultats sont préliminaires. Téléversez vos documents et faites valider vos données avant le calcul fiscal.",
                   "These results are preliminary. Upload your documents and have your data validated before the tax calculation.")}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => router.push("/documents")}
              style={{ flex: 1, padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, background: "var(--et-red)", color: "#fff", border: "none", cursor: "pointer" }}
            >
              {t("Téléverser mes documents →", "Upload my documents →")}
            </button>
            <button
              onClick={() => { setDone(false); setSection(0); setQIdx(0); }}
              style={{ padding: "12px 18px", borderRadius: 12, fontSize: 14, fontWeight: 600, background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer" }}
            >
              {t("Réviser", "Review")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── VUE PRINCIPALE ───────────────────────────────────────────────────────────
  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <NavClient />

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px" }}>

        {/* ── Barre de progression globale ─────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
              {t("Déclaration 2025", "2025 Return")} — {SECTIONS[currentSection]?.icon} {t(SECTIONS[currentSection]?.fr ?? "", SECTIONS[currentSection]?.en ?? "")}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--et-red)" }}>
              {progress.globalPct}%
            </span>
          </div>
          <div style={{ height: 6, background: "var(--border)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress.globalPct}%`, background: "var(--et-red)", borderRadius: 100, transition: "width 400ms ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
            <span>{t(`${progress.questionsAnswered} / ${progress.questionsApplicable} questions`, `${progress.questionsAnswered} / ${progress.questionsApplicable} questions`)}</span>
            <span>{sectionQs.length > 0 ? `${currentQIdx + 1} / ${sectionQs.length} ${t("dans cette section", "in this section")}` : ""}</span>
          </div>
        </div>

        {/* ── Étapes sections ──────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
          {SECTIONS.map((s, i) => {
            const sQs = applicable.filter(q => q.section === s.code);
            if (sQs.length === 0) return null;
            const answered = sQs.filter(q => answers[q.code] !== undefined && answers[q.code] !== null).length;
            const pct = Math.round((answered / sQs.length) * 100);
            const active = i === currentSection;
            const done = pct === 100;
            return (
              <button key={s.code}
                onClick={() => { setSection(i); setQIdx(0); }}
                style={{
                  flexShrink: 0, padding: "6px 12px", borderRadius: 10, fontSize: 12,
                  fontWeight: active ? 700 : 500, cursor: "pointer",
                  background: active ? "var(--et-red)" : done ? "rgba(22,163,74,0.1)" : "var(--bg-card)",
                  color: active ? "#fff" : done ? "#16A34A" : "var(--text-secondary)",
                  border: `1px solid ${active ? "var(--et-red)" : done ? "rgba(22,163,74,0.3)" : "var(--border)"}`,
                  transition: "all 120ms",
                }}>
                {s.icon} {lang === "fr" ? s.fr : s.en}
                {done && !active && " ✓"}
              </button>
            );
          })}
        </div>

        {/* ── Modules actifs ───────────────────────────────────────────── */}
        {modulesBadges.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
            {modulesBadges.slice(0, 5).map(m => {
              const ml = MODULE_LABELS[m];
              if (!ml) return null;
              return (
                <span key={m} style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                  background: "rgba(37,99,235,0.09)", color: "#2563EB",
                }}>
                  {ml.icon} {lang === "fr" ? ml.fr : ml.en}
                </span>
              );
            })}
          </div>
        )}

        {/* ── Carte question ───────────────────────────────────────────── */}
        {current ? (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "28px 24px", boxShadow: "var(--shadow-md)" }}>

            {/* Indicateur section */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>
              {SECTIONS.find(s => s.code === current.section)?.icon}{" "}
              {lang === "fr"
                ? SECTIONS.find(s => s.code === current.section)?.fr
                : SECTIONS.find(s => s.code === current.section)?.en}
              {current.required && (
                <span style={{ marginLeft: 8, color: "var(--et-red)" }}>*</span>
              )}
            </div>

            {/* Question */}
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px", lineHeight: 1.4 }}>
              {lang === "fr" ? current.textFr : current.textEn}
            </h2>

            {/* Hint */}
            {(current.hintFr || current.hintEn) && (
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 24px", lineHeight: 1.5 }}>
                {lang === "fr" ? current.hintFr : current.hintEn}
              </p>
            )}

            {/* Document requis */}
            {current.documentRequired && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(37,99,235,0.07)", border: "1px solid rgba(37,99,235,0.2)",
                borderRadius: 10, padding: "8px 12px", marginBottom: 20, fontSize: 12, color: "#2563EB",
              }}>
                📎 {t(`Document requis : ${current.documentRequired}`, `Required document: ${current.documentRequired}`)}
              </div>
            )}

            {/* Réponse selon le type */}
            {current.type === "BOOLEAN" && (
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => handleBoolean(true)} disabled={saving} style={{
                  flex: 1, padding: "14px 0", borderRadius: 12, fontSize: 15, fontWeight: 700,
                  background: answers[current.code] === true ? "var(--et-red)" : "var(--et-red)",
                  color: "#fff", border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1, transition: "all 120ms",
                }}>
                  {t("Oui", "Yes")}
                </button>
                <button onClick={() => handleBoolean(false)} disabled={saving} style={{
                  flex: 1, padding: "14px 0", borderRadius: 12, fontSize: 15, fontWeight: 600,
                  background: "var(--bg-base)", color: "var(--text-secondary)",
                  border: "1.5px solid var(--border)", cursor: "pointer", opacity: saving ? 0.6 : 1, transition: "all 120ms",
                }}>
                  {t("Non", "No")}
                </button>
              </div>
            )}

            {(current.type === "TEXT" || current.type === "ADDRESS") && (
              <div>
                <input
                  type="text"
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleText(); }}
                  placeholder={t("Saisir votre réponse...", "Enter your answer...")}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none", marginBottom: 12 }}
                  autoFocus
                />
                <button onClick={handleText} disabled={!textInput.trim() || saving} style={{
                  width: "100%", padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700,
                  background: "var(--et-red)", color: "#fff", border: "none", cursor: "pointer",
                  opacity: (!textInput.trim() || saving) ? 0.5 : 1,
                }}>
                  {t("Continuer →", "Continue →")}
                </button>
              </div>
            )}

            {(current.type === "NUMBER" || current.type === "MONEY" || current.type === "DECIMAL") && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  {current.type === "MONEY" && (
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-secondary)" }}>$</span>
                  )}
                  <input
                    type="number"
                    value={numInput}
                    onChange={e => setNumInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleNumber(); }}
                    placeholder={current.type === "MONEY" ? "0.00" : "0"}
                    min={0}
                    style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
                    autoFocus
                  />
                </div>
                <button onClick={handleNumber} disabled={!numInput || saving} style={{
                  width: "100%", padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700,
                  background: "var(--et-red)", color: "#fff", border: "none", cursor: "pointer",
                  opacity: (!numInput || saving) ? 0.5 : 1,
                }}>
                  {t("Continuer →", "Continue →")}
                </button>
              </div>
            )}

            {/* Sauvegarde */}
            {saving && (
              <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
                {t("Sauvegarde...", "Saving...")}
              </p>
            )}
          </div>
        ) : (
          /* Section sans questions — passer à la suivante */
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              {t("Section non applicable", "Section not applicable")}
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
              {t("Aucune question ne vous concerne dans cette section.", "No questions apply to you in this section.")}
            </p>
            <button onClick={goNext} style={{
              padding: "10px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: "var(--et-red)", color: "#fff", border: "none", cursor: "pointer",
            }}>
              {t("Section suivante →", "Next section →")}
            </button>
          </div>
        )}

        {/* ── Navigation ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          <button
            onClick={() => {
              if (currentQIdx > 0) setQIdx(i => i - 1);
              else if (currentSection > 0) { setSection(s => s - 1); setQIdx(0); }
            }}
            disabled={currentSection === 0 && currentQIdx === 0}
            style={{
              padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500,
              background: "var(--bg-card)", color: "var(--text-secondary)",
              border: "1px solid var(--border)", cursor: "pointer",
              opacity: (currentSection === 0 && currentQIdx === 0) ? 0.4 : 1,
            }}>
            ← {t("Précédent", "Previous")}
          </button>

          <button
            onClick={() => router.push("/dossier")}
            style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500, background: "transparent", color: "var(--text-muted)", border: "none", cursor: "pointer" }}>
            {t("Sauvegarder et quitter", "Save and exit")}
          </button>
        </div>

        {/* ── Progression par section ──────────────────────────────────── */}
        <div style={{ marginTop: 28, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 20px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
            {t("Progression par section", "Progress by section")}
          </p>
          {SECTIONS.map((s) => {
            const sQs = applicable.filter(q => q.section === s.code);
            if (sQs.length === 0) return null;
            const answered = sQs.filter(q => answers[q.code] !== undefined && answers[q.code] !== null).length;
            const pct = Math.round((answered / sQs.length) * 100);
            return (
              <div key={s.code} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                  <span>{s.icon} {lang === "fr" ? s.fr : s.en}</span>
                  <span style={{ fontWeight: 600, color: pct === 100 ? "#16A34A" : "var(--text-secondary)" }}>{pct}%</span>
                </div>
                <div style={{ height: 4, background: "var(--border)", borderRadius: 100, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#16A34A" : "var(--et-red)", borderRadius: 100, transition: "width 300ms" }} />
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
