import Link from "next/link";
import { PublicNav } from "@/components/AppNav";

export default function Home() {
  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <PublicNav />

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium mb-8"
          style={{
            background: "rgba(22,163,74,0.1)",
            color: "#16A34A",
            border: "1px solid rgba(22,163,74,0.2)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          Saison fiscale 2025 — Ouverte
        </div>

        <h1
          className="text-4xl sm:text-5xl font-bold leading-tight mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          Vos impôts canadiens.<br />
          <span className="et-logo-easy">Enfin simples.</span>
        </h1>

        <p
          className="text-lg sm:text-xl max-w-2xl mx-auto mb-10"
          style={{ color: "var(--text-secondary)" }}
        >
          Téléversez vos T4, RL-1 et autres documents. Notre moteur fiscal
          analyse tout et prépare votre déclaration fédérale et québécoise.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/sign-up"
            className="et-btn et-btn-primary text-base px-8 py-3.5"
          >
            Déclarer mes impôts →
          </Link>
          <a
            href="#comment-ca-marche"
            className="et-btn et-btn-outline text-base px-8 py-3.5"
          >
            Comment ça marche
          </a>
        </div>

        <p className="mt-5 text-sm" style={{ color: "var(--text-muted)" }}>
          Déclaration simple gratuite · Pas de carte requise
        </p>
      </section>

      {/* ── BADGES ────────────────────────────────────────── */}
      <section
        className="py-6 border-y"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--border)",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-center gap-6 text-sm" style={{ color: "var(--text-secondary)" }}>
          {[
            { icon: "🇨🇦", text: "Déclaration T1 fédérale" },
            { icon: "⚜️", text: "Déclaration TP-1 Québec" },
            { icon: "📄", text: "OCR automatique" },
            { icon: "🔒", text: "Chiffrement AES-256" },
            { icon: "🧾", text: "T4 · RL-1 · T5 · T4A" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              <span className="text-base">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ─────────────────────────────── */}
      <section id="comment-ca-marche" className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-3" style={{ color: "var(--text-primary)" }}>
          Aussi simple que 1, 2, 3
        </h2>
        <p className="text-center mb-14" style={{ color: "var(--text-secondary)" }}>
          Pas de formulaires complexes. Juste vos documents et quelques questions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              step: "01",
              icon: "📂",
              title: "Téléversez vos documents",
              desc: "T4, RL-1, T5, T4A, reçus médicaux… Notre OCR extrait automatiquement toutes les données fiscales.",
              color: "#2563EB",
            },
            {
              step: "02",
              icon: "💬",
              title: "Répondez aux questions",
              desc: "Notre assistant vous guide intelligemment selon votre situation. Pas de formulaires, juste des questions simples.",
              color: "#7C3AED",
            },
            {
              step: "03",
              icon: "✅",
              title: "Voyez votre résultat",
              desc: "Remboursement estimé, validation complète, puis transmission à l'ARC et à Revenu Québec.",
              color: "#16A34A",
            },
          ].map(({ step, icon, title, desc, color }) => (
            <div key={step} className="et-card p-7 relative overflow-hidden">
              <div
                className="absolute top-0 right-0 text-[80px] font-black leading-none select-none pointer-events-none"
                style={{ color: `${color}08`, transform: "translate(8px, -8px)" }}
              >
                {step}
              </div>
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-5"
                style={{ background: `${color}15` }}
              >
                {icon}
              </div>
              <div
                className="text-[11px] font-bold mb-2"
                style={{ color }}
              >
                ÉTAPE {step}
              </div>
              <h3 className="font-bold text-base mb-2" style={{ color: "var(--text-primary)" }}>{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TARIFS ────────────────────────────────────────── */}
      <section
        className="py-20 border-y"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-center mb-3" style={{ color: "var(--text-primary)" }}>
            Tarifs transparents
          </h2>
          <p className="text-center mb-14" style={{ color: "var(--text-secondary)" }}>
            Payez seulement quand vous êtes prêt à transmettre.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                name: "Essentiel",
                price: "Gratuit",
                color: "#16A34A",
                items: ["1 personne", "1 T4 + RL-1", "Calcul fédéral + Québec", "Préparation déclaration"],
                featured: false,
              },
              {
                name: "Simple",
                price: "19,95 $",
                color: "#2563EB",
                items: ["Plusieurs T4 / T4A", "OCR automatique", "Vérification avancée", "Transmission fédérale + QC"],
                featured: false,
              },
              {
                name: "Autonome",
                price: "59,95 $",
                color: "#D97706",
                items: ["Travailleur autonome", "Revenus + dépenses", "Véhicule · bureau domicile", "Amortissement"],
                featured: true,
              },
              {
                name: "Complet",
                price: "34,95 $",
                color: "#7C3AED",
                items: ["Plusieurs employeurs", "Crédits et dépenses", "Placements simples", "Archivage documents"],
                featured: false,
              },
              {
                name: "Famille",
                price: "69,95 $",
                color: "#E5342A",
                items: ["2 adultes + enfants", "Déclarations conjointes", "Optimisation familiale", "Documents partagés"],
                featured: false,
              },
              {
                name: "Pro",
                price: "119,95 $",
                color: "#0F1117",
                items: ["Situation complexe", "Revenus étrangers", "Placements avancés", "Plusieurs sources"],
                featured: false,
                dark: true,
              },
            ].map(({ name, price, color, items, featured, dark }) => (
              <div
                key={name}
                className="rounded-2xl p-6 border relative overflow-hidden"
                style={{
                  background: dark
                    ? "#0F1117"
                    : featured
                    ? `${color}0D`
                    : "var(--bg-base)",
                  borderColor: featured ? color : "var(--border)",
                  borderWidth: featured ? 2 : 1,
                }}
              >
                {featured && (
                  <div
                    className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: color, color: "#fff" }}
                  >
                    POPULAIRE
                  </div>
                )}
                <div
                  className="text-xs font-bold mb-2"
                  style={{ color: dark ? "#888" : color }}
                >
                  {name.toUpperCase()}
                </div>
                <div
                  className="text-2xl font-bold mb-5"
                  style={{ color: dark ? "#fff" : "var(--text-primary)" }}
                >
                  {price}
                </div>
                <ul className="space-y-2 mb-6">
                  {items.map((item) => (
                    <li
                      key={item}
                      className="text-sm flex items-center gap-2"
                      style={{ color: dark ? "#9CA3AF" : "var(--text-secondary)" }}
                    >
                      <span style={{ color: "#16A34A" }}>✓</span> {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className="et-btn w-full text-sm justify-center"
                  style={{
                    background: featured ? color : dark ? "#fff" : `${color}18`,
                    color: featured ? "#fff" : dark ? "#0F1117" : color,
                  }}
                >
                  Choisir {name}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SÉCURITÉ ──────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Sécurité de niveau bancaire
        </h2>
        <p className="mb-12" style={{ color: "var(--text-secondary)" }}>
          Vos données fiscales sont parmi les plus sensibles. Nous les traitons en conséquence.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: "🔐", label: "Chiffrement AES-256" },
            { icon: "🛡️", label: "Authentification MFA" },
            { icon: "📋", label: "Journal d'audit" },
            { icon: "🔑", label: "NAS jamais exposé" },
          ].map(({ icon, label }) => (
            <div key={label} className="et-card p-6 text-center">
              <div className="text-3xl mb-3">{icon}</div>
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section
        className="py-16"
        style={{ background: "var(--et-red)" }}
      >
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Prêt à déclarer vos impôts ?
          </h2>
          <p className="text-red-100 mb-8">
            Commencez gratuitement. Payez seulement quand vous êtes prêt à transmettre.
          </p>
          <Link
            href="/sign-up"
            className="et-btn text-base px-10 py-4 font-bold"
            style={{ background: "#fff", color: "var(--et-red)" }}
          >
            Créer mon compte gratuit
          </Link>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────── */}
      <footer
        className="py-10 px-4 sm:px-6 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          <div className="font-bold" style={{ color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--et-red)" }}>Easy</span>Tax Canada
          </div>
          <div className="flex gap-5">
            {["Confidentialité", "Conditions", "Sécurité", "Contact"].map((item) => (
              <Link
                key={item}
                href={`/${item.toLowerCase()}`}
                className="hover:underline"
                style={{ color: "var(--text-muted)" }}
              >
                {item}
              </Link>
            ))}
          </div>
          <div>© 2025 EasyTax Canada.</div>
        </div>
      </footer>
    </div>
  );
}
