import Link from "next/link";
import { PublicNav } from "@/components/AppNav";

export default function Home() {
  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <PublicNav />

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "64px 20px 48px", textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          borderRadius: 100, padding: "6px 16px", fontSize: 13, fontWeight: 600,
          background: "rgba(22,163,74,0.10)", color: "#16A34A",
          border: "1px solid rgba(22,163,74,0.20)", marginBottom: 28,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16A34A", display: "inline-block" }} />
          Saison fiscale 2025 — Ouverte
        </div>

        <h1 style={{ fontSize: "clamp(32px,6vw,54px)", fontWeight: 800, lineHeight: 1.15, margin: "0 0 20px", color: "var(--text-primary)" }}>
          Vos impôts canadiens.<br />
          <span className="et-logo-easy">Enfin simples.</span>
        </h1>
        <p style={{ fontSize: 18, color: "var(--text-secondary)", maxWidth: 580, margin: "0 auto 40px", lineHeight: 1.6 }}>
          Uploadez vos T4, RL-1 et autres feuillets. Notre IA extrait toutes les données
          et prépare votre déclaration fédérale et québécoise automatiquement.
        </p>

        {/* Badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 52 }}>
          {[
            { icon: "🇨🇦", text: "T1 fédéral" },
            { icon: "⚜️",  text: "TP-1 Québec" },
            { icon: "🤖",  text: "OCR automatique" },
            { icon: "🔒",  text: "AES-256" },
            { icon: "📄",  text: "T4 · RL-1 · T5 · T4A" },
          ].map(({ icon, text }) => (
            <span key={text} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 13px", borderRadius: 100, fontSize: 12, fontWeight: 500,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}>
              {icon} {text}
            </span>
          ))}
        </div>
      </section>

      {/* ── CHOIX DU TYPE DE COMPTE — cœur de la page ─────────────── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px 72px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, textAlign: "center", color: "var(--text-primary)", margin: "0 0 8px" }}>
          Quel type de compte souhaitez-vous créer ?
        </h2>
        <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 15, margin: "0 0 36px" }}>
          Chaque espace est distinct — choisissez selon votre situation
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>

          {/* ── PARTICULIER ─────────────────────────────────────── */}
          <div style={{
            background: "var(--bg-card)", border: "2px solid rgba(37,99,235,0.25)",
            borderRadius: 24, padding: "32px 28px", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -10, right: -10, fontSize: 80, opacity: 0.05, lineHeight: 1 }}>👤</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(37,99,235,0.10)", color: "#2563EB",
              borderRadius: 100, padding: "4px 12px", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.05em", marginBottom: 18,
            }}>
              👤 PARTICULIER
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 10px" }}>
              Déclaration personnelle
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 20px", lineHeight: 1.6 }}>
              Pour les salariés, travailleurs autonomes, retraités et toute personne physique
              devant produire une déclaration T1 / TP-1.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 28 }}>
              {[
                "Revenus d'emploi (T4 / RL-1)",
                "Travail autonome · Uber · DoorDash",
                "Revenus de placement (T5, T3)",
                "Déductions REER · Crédits familiaux",
                "Résidents du Québec — TP-1 inclus",
              ].map(item => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                  <span style={{ color: "#2563EB", fontWeight: 700, flexShrink: 0 }}>✓</span> {item}
                </div>
              ))}
            </div>
            <Link href="/sign-up?type=individual" style={{
              display: "block", textAlign: "center", padding: "13px 0",
              borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: "#2563EB", color: "#fff", textDecoration: "none",
              marginBottom: 10,
            }}>
              Créer un compte particulier →
            </Link>
            <Link href="/sign-in" style={{
              display: "block", textAlign: "center", padding: "10px 0",
              borderRadius: 12, fontSize: 13, fontWeight: 600,
              background: "rgba(37,99,235,0.07)", color: "#2563EB", textDecoration: "none",
            }}>
              Déjà un compte ? Se connecter
            </Link>
          </div>

          {/* ── ENTREPRISE ──────────────────────────────────────── */}
          <div style={{
            background: "var(--bg-card)", border: "2px solid rgba(124,58,237,0.25)",
            borderRadius: 24, padding: "32px 28px", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -10, right: -10, fontSize: 80, opacity: 0.05, lineHeight: 1 }}>🏢</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(124,58,237,0.10)", color: "#7C3AED",
              borderRadius: 100, padding: "4px 12px", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.05em", marginBottom: 18,
            }}>
              🏢 ENTREPRISE
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 10px" }}>
              Déclaration corporative
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 20px", lineHeight: 1.6 }}>
              Pour les sociétés par actions (Inc.), SARL, coopératives et toute entité
              devant produire une déclaration T2 / CO-17.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 28 }}>
              {[
                "États financiers · Revenus · Dépenses",
                "Paie des employés (T4 / RL-1 émis)",
                "TPS/TVH · TVQ — déclarations taxes",
                "Immobilisations et amortissement (DPA)",
                "Déduction pour petite entreprise",
              ].map(item => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                  <span style={{ color: "#7C3AED", fontWeight: 700, flexShrink: 0 }}>✓</span> {item}
                </div>
              ))}
            </div>
            <Link href="/sign-up?type=business" style={{
              display: "block", textAlign: "center", padding: "13px 0",
              borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: "#7C3AED", color: "#fff", textDecoration: "none",
              marginBottom: 10,
            }}>
              Créer un compte entreprise →
            </Link>
            <Link href="/sign-in" style={{
              display: "block", textAlign: "center", padding: "10px 0",
              borderRadius: 12, fontSize: 13, fontWeight: 600,
              background: "rgba(124,58,237,0.07)", color: "#7C3AED", textDecoration: "none",
            }}>
              Déjà un compte ? Se connecter
            </Link>
          </div>

          {/* ── PRÉPARATEUR ─────────────────────────────────────── */}
          <div style={{
            background: "var(--bg-card)", border: "2px solid rgba(5,150,105,0.25)",
            borderRadius: 24, padding: "32px 28px", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -10, right: -10, fontSize: 80, opacity: 0.05, lineHeight: 1 }}>🧑‍💼</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(5,150,105,0.10)", color: "#059669",
              borderRadius: 100, padding: "4px 12px", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.05em", marginBottom: 18,
            }}>
              🧑‍💼 PRÉPARATEUR
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 10px" }}>
              Espace professionnel
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 20px", lineHeight: 1.6 }}>
              Pour les comptables, fiscalistes et préparateurs fiscaux gérant
              les dossiers de plusieurs clients en parallèle.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 28 }}>
              {[
                "Console multi-clients centralisée",
                "Accès aux dossiers clients autorisés",
                "Révision et validation des données OCR",
                "Demandes de documents aux clients",
                "Calculs fiscaux et scénarios avancés",
              ].map(item => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                  <span style={{ color: "#059669", fontWeight: 700, flexShrink: 0 }}>✓</span> {item}
                </div>
              ))}
            </div>
            <Link href="/sign-up?type=preparer" style={{
              display: "block", textAlign: "center", padding: "13px 0",
              borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: "#059669", color: "#fff", textDecoration: "none",
              marginBottom: 10,
            }}>
              Créer un compte préparateur →
            </Link>
            <Link href="/sign-in" style={{
              display: "block", textAlign: "center", padding: "10px 0",
              borderRadius: 12, fontSize: 13, fontWeight: 600,
              background: "rgba(5,150,105,0.07)", color: "#059669", textDecoration: "none",
            }}>
              Déjà un compte ? Se connecter
            </Link>
          </div>

        </div>

        {/* Note aide au choix */}
        <div style={{
          marginTop: 24, padding: "14px 20px", borderRadius: 14,
          background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.18)",
          textAlign: "center", fontSize: 13, color: "#D97706",
        }}>
          💡 <strong>Pas sûr ?</strong> Si vous avez un emploi et que votre employeur vous donne un T4, choisissez <strong>Particulier</strong>.
          Si vous avez une compagnie incorporée (Inc.), choisissez <strong>Entreprise</strong>.
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ───────────────────────────────────────── */}
      <section id="comment-ca-marche" style={{
        borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
        background: "var(--bg-card)", padding: "72px 20px",
      }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, textAlign: "center", color: "var(--text-primary)", margin: "0 0 8px" }}>
            Le document comme point de départ
          </h2>
          <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 15, margin: "0 0 48px" }}>
            Plus besoin de tout entrer manuellement. L&apos;IA lit vos feuillets à votre place.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {[
              { step: "1", icon: "📤", title: "Upload votre T4", desc: "PDF ou photo — le système accepte T4, RL-1, T5, T4A et plus.", color: "#2563EB" },
              { step: "2", icon: "🔍", title: "L'IA lit le feuillet", desc: "OCR extrait case 14 (revenus), case 22 (impôt), case 16 (RPC)...", color: "#7C3AED" },
              { step: "3", icon: "📊", title: "Données mappées", desc: "Chaque case est liée automatiquement à la bonne ligne fiscale.", color: "#059669" },
              { step: "4", icon: "✅", title: "Vous validez", desc: "Vérifiez et corrigez au besoin — chaque valeur reste traçable.", color: "#D97706" },
              { step: "5", icon: "🧮", title: "Calcul automatique", desc: "Résumé T1 + TP-1 avec remboursement ou solde estimé.", color: "#E5342A" },
            ].map(({ step, icon, title, desc, color }) => (
              <div key={step} style={{
                background: "var(--bg-base)", border: "1px solid var(--border)",
                borderRadius: 18, padding: "24px 20px", position: "relative",
              }}>
                <div style={{
                  position: "absolute", top: 16, right: 16, fontSize: 11, fontWeight: 800,
                  color: color, background: `${color}12`, padding: "2px 8px", borderRadius: 100,
                }}>
                  {step}
                </div>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DOCUMENTS ACCEPTÉS ──────────────────────────────────────── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "72px 20px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, textAlign: "center", color: "var(--text-primary)", margin: "0 0 8px" }}>
          Tous vos feuillets fiscaux
        </h2>
        <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 14, margin: "0 0 40px" }}>
          Upload une fois — le système classe et extrait tout automatiquement
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          {[
            { code: "T4",       icon: "💼", label: "Revenus d'emploi",       color: "#2563EB" },
            { code: "RL-1",     icon: "⚜️",  label: "Emploi Québec",          color: "#7C3AED" },
            { code: "T4A",      icon: "💰", label: "CNESST · pension · bourses", color: "#059669" },
            { code: "T4E",      icon: "🛡️", label: "Assurance-emploi",        color: "#D97706" },
            { code: "T5",       icon: "📈", label: "Placements",              color: "#0891B2" },
            { code: "T3",       icon: "📊", label: "Fonds de placement",      color: "#0891B2" },
            { code: "T4RSP",    icon: "🏦", label: "Retrait REER",            color: "#7C3AED" },
            { code: "REER",     icon: "🧾", label: "Cotisation REER",         color: "#16A34A" },
            { code: "T2202",    icon: "🎓", label: "Frais de scolarité",      color: "#7C3AED" },
            { code: "T2201",    icon: "♿",  label: "Crédit handicap",         color: "#D97706" },
            { code: "T5008",    icon: "📉", label: "Gains en capital",        color: "#E5342A" },
            { code: "AUTRES",   icon: "📄", label: "Classification IA",       color: "#6B7280" },
          ].map(({ code, icon, label, color }) => (
            <div key={code} style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 14, padding: "16px 14px", textAlign: "center",
            }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
              <div style={{
                fontSize: 11, fontWeight: 800, color, padding: "2px 8px",
                background: `${color}12`, borderRadius: 100, display: "inline-block", marginBottom: 6,
              }}>{code}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TARIFS ──────────────────────────────────────────────────── */}
      <section style={{
        borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
        background: "var(--bg-card)", padding: "72px 20px",
      }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, textAlign: "center", color: "var(--text-primary)", margin: "0 0 8px" }}>
            Tarifs transparents
          </h2>
          <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 14, margin: "0 0 40px" }}>
            Payez seulement quand vous êtes prêt à transmettre
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
            {[
              { name: "Essentiel",  price: "Gratuit",   color: "#16A34A", items: ["1 personne","1 T4 + RL-1","Calcul fédéral + QC"], featured: false },
              { name: "Simple",     price: "19,95 $",   color: "#2563EB", items: ["Plusieurs T4","OCR automatique","Transmission ARC+RQ"], featured: false },
              { name: "Autonome",   price: "59,95 $",   color: "#D97706", items: ["Travailleur autonome","Véhicule · bureau","Amortissement"], featured: true },
              { name: "Complet",    price: "34,95 $",   color: "#7C3AED", items: ["Plusieurs employeurs","Placements","Archivage docs"], featured: false },
              { name: "Famille",    price: "69,95 $",   color: "#E5342A", items: ["2 adultes + enfants","Déclarations conjointes","Optimisation"], featured: false },
              { name: "Entreprise", price: "149,95 $",  color: "#0F1117", items: ["T2 + CO-17","Paie + taxes","DPA + états financiers"], featured: false, dark: true },
            ].map(({ name, price, color, items, featured, dark }) => (
              <div key={name} style={{
                borderRadius: 20, padding: "24px 20px", position: "relative",
                background: dark ? "#0F1117" : featured ? `${color}08` : "var(--bg-base)",
                border: `${featured ? 2 : 1}px solid ${featured ? color : "var(--border)"}`,
              }}>
                {featured && (
                  <div style={{ position: "absolute", top: 12, right: 12, fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 100, background: color, color: "#fff" }}>
                    POPULAIRE
                  </div>
                )}
                <div style={{ fontSize: 10, fontWeight: 800, color: dark ? "#888" : color, marginBottom: 6, letterSpacing: "0.06em" }}>{name.toUpperCase()}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: dark ? "#fff" : "var(--text-primary)", marginBottom: 16 }}>{price}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                  {items.map(item => (
                    <div key={item} style={{ fontSize: 12, color: dark ? "#9CA3AF" : "var(--text-secondary)", display: "flex", gap: 7 }}>
                      <span style={{ color: "#16A34A" }}>✓</span> {item}
                    </div>
                  ))}
                </div>
                <Link href={dark ? "/sign-up?type=business" : "/sign-up?type=individual"} style={{
                  display: "block", textAlign: "center", padding: "10px 0",
                  borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none",
                  background: featured ? color : dark ? "#fff" : `${color}18`,
                  color: featured ? "#fff" : dark ? "#0F1117" : color,
                }}>
                  Choisir {name}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SÉCURITÉ ────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "72px 20px", textAlign: "center" }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 8px" }}>Sécurité de niveau bancaire</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 40px" }}>Vos données fiscales sont parmi les plus sensibles. Nous les traitons en conséquence.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
          {[
            { icon: "🔐", label: "Chiffrement AES-256" },
            { icon: "🛡️", label: "Auth MFA" },
            { icon: "📋", label: "Journal d'audit complet" },
            { icon: "🔑", label: "NAS jamais exposé" },
          ].map(({ icon, label }) => (
            <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px 16px" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────────────────────────────── */}
      <section style={{ background: "var(--et-red)", padding: "64px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>
            Commencez dès aujourd&apos;hui
          </h2>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, margin: "0 0 32px" }}>
            Gratuit pour commencer. Payez seulement au moment de transmettre.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/sign-up?type=individual" style={{
              padding: "14px 28px", borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: "#fff", color: "var(--et-red)", textDecoration: "none",
            }}>
              👤 Compte particulier
            </Link>
            <Link href="/sign-up?type=business" style={{
              padding: "14px 28px", borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: "rgba(255,255,255,0.15)", color: "#fff", textDecoration: "none",
              border: "1.5px solid rgba(255,255,255,0.4)",
            }}>
              🏢 Compte entreprise
            </Link>
            <Link href="/sign-up?type=preparer" style={{
              padding: "14px 28px", borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: "rgba(255,255,255,0.15)", color: "#fff", textDecoration: "none",
              border: "1.5px solid rgba(255,255,255,0.4)",
            }}>
              🧑‍💼 Compte préparateur
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "36px 20px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, fontSize: 13, color: "var(--text-muted)" }}>
          <div style={{ fontWeight: 700 }}>
            <span style={{ color: "var(--et-red)" }}>Easy</span>Tax Canada
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {["Particuliers", "Entreprises", "Préparateurs"].map(item => (
              <Link key={item} href={`/sign-up?type=${item.toLowerCase().slice(0,-1)}`} style={{ color: "var(--text-muted)", textDecoration: "none" }}>{item}</Link>
            ))}
            {["Confidentialité", "Conditions", "Contact"].map(item => (
              <Link key={item} href={`/${item.toLowerCase()}`} style={{ color: "var(--text-muted)", textDecoration: "none" }}>{item}</Link>
            ))}
          </div>
          <div>© 2025 EasyTax Canada</div>
        </div>
      </footer>
    </div>
  );
}
