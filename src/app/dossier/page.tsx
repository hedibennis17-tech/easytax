import { auth } from "@clerk/nextjs/server";
import { requireProfile } from "@/lib/require-profile";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NavWrapper } from "@/components/NavWrapper";

// ─── Mapping T4 cases → réponses questionnaire ────────────────────────────────
// Quand l'OCR lit un T4, ces données alimentent automatiquement les réponses
export const T4_TO_ANSWERS: Record<string, { questionId: string; label: string }> = {
  box_14:          { questionId: "t1",   label: "Revenu d'emploi (case 14)"        },
  box_22:          { questionId: "e_tax_withheld", label: "Impôt retenu (case 22)" },
  box_16:          { questionId: "e_cpp", label: "Cotisation RPC/RRQ (case 16)"    },
  box_18:          { questionId: "e_ei",  label: "Cotisation AE (case 18)"         },
  box_44:          { questionId: "d9",   label: "Cotisations syndicales (case 44)" },
  employer_name:   { questionId: "e_employer_name", label: "Nom employeur"         },
};

export const DOCUMENT_TYPES = [
  {
    code: "T4", label: "T4 — Rémunération d'un employeur",
    icon: "💼", color: "#2563EB",
    autoFills: ["Revenus d'emploi", "Impôt retenu", "Cotisations RPC/AE"],
    hint: "Le plus courant — un T4 par employeur",
    answersModule: "emploi",
  },
  {
    code: "RL1", label: "Relevé 1 (RL-1) — Québec",
    icon: "⚜️", color: "#7C3AED",
    autoFills: ["Revenus d'emploi QC", "RRQ", "RQAP", "Impôt QC"],
    hint: "Obligatoire pour résidents du Québec",
    answersModule: "emploi",
  },
  {
    code: "T4A", label: "T4A — Autres revenus",
    icon: "💰", color: "#059669",
    autoFills: ["Pensions", "Bourses", "CNESST", "Allocations de retraite"],
    hint: "CNESST, retraite, bourses d'études, subventions",
    answersModule: "autres_revenus",
  },
  {
    code: "T4E", label: "T4E — Assurance-emploi",
    icon: "🛡️", color: "#D97706",
    autoFills: ["Prestations AE", "Impôt retenu"],
    hint: "Si vous avez reçu des prestations d'AE en 2025",
    answersModule: "autres_revenus",
  },
  {
    code: "T5", label: "T5 — Revenus de placements",
    icon: "📈", color: "#0891B2",
    autoFills: ["Intérêts", "Dividendes", "Institution financière"],
    hint: "Intérêts de banque, dividendes d'actions",
    answersModule: "placements",
  },
  {
    code: "T3", label: "T3 — Revenus de fiducie / fonds",
    icon: "📊", color: "#0891B2",
    autoFills: ["Dividendes de fonds", "Gains en capital", "Intérêts"],
    hint: "Fonds communs de placement, REER, CELI",
    answersModule: "placements",
  },
  {
    code: "T4RSP", label: "T4RSP — Retrait REER",
    icon: "🏦", color: "#7C3AED",
    autoFills: ["Montant retiré du REER", "Impôt retenu"],
    hint: "Si vous avez retiré de l'argent d'un REER",
    answersModule: "autres_revenus",
  },
  {
    code: "RRSP_RECEIPT", label: "Reçu de cotisation REER",
    icon: "🧾", color: "#16A34A",
    autoFills: ["Montant de cotisation REER 2025"],
    hint: "Reçus émis par votre institution financière",
    answersModule: "deductions",
  },
  {
    code: "T2202", label: "T2202 — Frais de scolarité",
    icon: "🎓", color: "#7C3AED",
    autoFills: ["Frais de scolarité", "Mois admissibles", "Établissement"],
    hint: "Université, cégep, collège — émis par l'établissement",
    answersModule: "deductions",
  },
  {
    code: "OTHER", label: "Autre document fiscal",
    icon: "📄", color: "#6B7280",
    autoFills: ["Classification automatique par IA"],
    hint: "T5013, RL-2, reçus médicaux, dons, T1135...",
    answersModule: null,
  },
];

export default async function DossierPage() {
  await requireProfile();
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <NavWrapper />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" }}>

        {/* ── En-tête ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 6px" }}>
            Mon dossier fiscal 2025
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
            Commencez par téléverser vos feuillets — le système lit et extrait automatiquement toutes les données.
          </p>
        </div>

        {/* ── Bannière OCR — le cœur du système ───────────────────────── */}
        <div style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #2563EB 100%)",
          borderRadius: 20, padding: "22px 24px", marginBottom: 24, color: "#fff",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ fontSize: 36, flexShrink: 0 }}>🤖</div>
            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700 }}>
                Analyse automatique par IA
              </h2>
              <p style={{ margin: "0 0 14px", fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>
                Téléversez vos feuillets (T4, T5, RL-1...) et le système extrait automatiquement
                toutes les cases fiscales. Vos réponses se remplissent seules.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["📄 Upload", "🔍 OCR", "📊 Extraction", "✅ Validation", "🧮 Calcul"].map((step, i) => (
                  <span key={i} style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px",
                    borderRadius: 100, background: "rgba(255,255,255,0.15)",
                  }}>{step}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Commencer par les documents ─────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              📎 Téléversez vos documents
            </h2>
            <Link href="/documents" style={{
              fontSize: 12, fontWeight: 600, color: "var(--et-red)", textDecoration: "none",
              padding: "6px 12px", borderRadius: 8, background: "rgba(229,52,42,0.08)",
            }}>
              Voir le coffre →
            </Link>
          </div>

          {/* Bouton principal d'upload */}
          <Link href="/documents" style={{ textDecoration: "none" }}>
            <div style={{
              border: "2px dashed #2563EB", borderRadius: 18, padding: "28px 20px",
              textAlign: "center", background: "rgba(37,99,235,0.03)",
              marginBottom: 14, cursor: "pointer", transition: "all 200ms",
            }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📤</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#2563EB", marginBottom: 6 }}>
                Ajouter un document fiscal
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                PDF, JPG, PNG, HEIC · Analyse OCR automatique
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                + Ajouter autant de feuillets que nécessaire (T4×3, T5×2...)
              </div>
            </div>
          </Link>

          {/* Grille types de documents */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {DOCUMENT_TYPES.slice(0, 8).map((dt) => (
              <Link key={dt.code} href="/documents" style={{ textDecoration: "none" }}>
                <div style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 14, padding: "14px", cursor: "pointer",
                  transition: "all 150ms",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>{dt.icon}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 6px",
                      borderRadius: 100, background: `${dt.color}15`, color: dt.color,
                    }}>{dt.code}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, lineHeight: 1.3 }}>
                    {dt.label.split(" — ")[1]}
                  </div>
                  <div style={{ fontSize: 10, color: "#16A34A", fontWeight: 600 }}>
                    ↳ Auto-remplit : {dt.autoFills[0]}{dt.autoFills.length > 1 ? ` +${dt.autoFills.length - 1}` : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Flow: Document → OCR → Réponses ─────────────────────────── */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, padding: "18px 20px", marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 14px" }}>
            Comment ça marche ?
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { icon: "📤", step: "1", title: "Vous uploadez votre T4", desc: "PDF ou photo de votre feuillet", color: "#2563EB" },
              { icon: "🔍", step: "2", title: "L'IA lit le document", desc: "OCR extrait toutes les cases (14, 16, 18, 22...)", color: "#7C3AED" },
              { icon: "📊", step: "3", title: "Les données sont mappées", desc: "Case 14 → Revenus d'emploi · Case 22 → Impôt retenu", color: "#059669" },
              { icon: "👀", step: "4", title: "Vous validez ou corrigez", desc: "Chaque valeur est présentée avec sa source", color: "#D97706" },
              { icon: "🧮", step: "5", title: "Le moteur calcule", desc: "Résumé fiscal préliminaire T1 + TP-1", color: "#E5342A" },
            ].map((item, i, arr) => (
              <div key={i}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0" }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 50, flexShrink: 0,
                    background: `${item.color}15`, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 18,
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                      {item.desc}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 800, color: item.color,
                    background: `${item.color}12`, padding: "2px 7px", borderRadius: 100,
                  }}>
                    {item.step}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ marginLeft: 18, borderLeft: "2px dashed var(--border)", height: 8 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Complément questionnaire ──────────────────────────────────── */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 28 }}>📝</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>
                Questions supplémentaires
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Après vos documents, quelques questions sur ce qui ne figure pas sur les feuillets
                (bureau à domicile, dépenses de véhicule, situation familiale...)
              </div>
            </div>
            <Link href="/questionnaire" style={{
              padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700,
              background: "var(--et-red)", color: "#fff", textDecoration: "none", flexShrink: 0,
            }}>
              Compléter →
            </Link>
          </div>
        </div>

        {/* ── Résumé fiscal ─────────────────────────────────────────────── */}
        <Link href="/resume" style={{ textDecoration: "none" }}>
          <div style={{
            background: "linear-gradient(135deg, #064e3b, #065f46)",
            border: "1px solid rgba(22,163,74,0.3)", borderRadius: 18, padding: "16px 18px",
            display: "flex", alignItems: "center", gap: 12, color: "#fff",
          }}>
            <div style={{ fontSize: 28 }}>🧮</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Résumé fiscal préliminaire</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Disponible après validation des documents</div>
            </div>
            <span style={{ fontSize: 18, opacity: 0.7 }}>→</span>
          </div>
        </Link>

        {/* ── Avertissement ─────────────────────────────────────────────── */}
        <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(217,119,6,0.07)", border: "1px solid rgba(217,119,6,0.2)", fontSize: 11, color: "#D97706" }}>
          ⚠️ EasyTax produit des résultats <strong>préliminaires</strong>. Aucune déclaration n&apos;est transmise
          sans votre validation explicite. Ne jamais simuler NETFILE/ImpôtNet.
        </div>

      </main>
    </div>
  );
}
