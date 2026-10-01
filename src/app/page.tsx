import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* NAV */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-red-600">Easy</span>
          <span className="text-2xl font-bold text-gray-900">Tax</span>
          <span className="ml-2 text-xs bg-red-50 text-red-600 border border-red-200 rounded px-2 py-0.5 font-medium">CANADA</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Connexion</Link>
          <Link href="/signup" className="text-sm bg-red-600 text-white rounded-lg px-4 py-2 hover:bg-red-700 transition-colors">
            Commencer — Gratuit
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 text-sm text-green-700 mb-8">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          Saison fiscale 2025 — Ouverte
        </div>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          Vos impôts canadiens.<br />
          <span className="text-red-600">Enfin simples.</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          Téléversez vos T4, RL-1 et autres documents. 
          Notre moteur fiscal analyse tout et prépare votre déclaration fédérale et québécoise.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup" className="bg-red-600 text-white rounded-xl px-8 py-4 text-lg font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-100">
            Déclarer mes impôts →
          </Link>
          <Link href="#comment-ca-marche" className="border border-gray-200 text-gray-700 rounded-xl px-8 py-4 text-lg font-semibold hover:bg-gray-50 transition-colors">
            Comment ça marche
          </Link>
        </div>
        <p className="mt-6 text-sm text-gray-400">
          Déclaration simple gratuite · Pas de carte requise
        </p>
      </section>

      {/* BADGES */}
      <section className="bg-gray-50 py-8 border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇨🇦</span> Déclaration fédérale T1
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">⚜️</span> Déclaration Québec TP-1
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📄</span> OCR automatique des feuillets
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🔒</span> Chiffrement bancaire
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🧾</span> T4 · RL-1 · T5 · T4A et plus
          </div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section id="comment-ca-marche" className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
          Aussi simple que 1, 2, 3
        </h2>
        <p className="text-center text-gray-500 mb-14">Pas de formulaires complexes. Juste vos documents et quelques questions.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: "01",
              icon: "📂",
              title: "Téléversez vos documents",
              desc: "T4, RL-1, T5, T4A, reçus médicaux… Notre moteur OCR extrait automatiquement toutes les données fiscales.",
            },
            {
              step: "02",
              icon: "💬",
              title: "Répondez à quelques questions",
              desc: "Notre assistant fiscal vous guide intelligemment selon votre situation. Pas de formulaires, juste des questions simples.",
            },
            {
              step: "03",
              icon: "✅",
              title: "Voyez votre résultat",
              desc: "Remboursement estimé, validation complète, puis transmission officielle à l'ARC et à Revenu Québec.",
            },
          ].map((item) => (
            <div key={item.step} className="relative bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
              <div className="text-xs font-bold text-red-400 mb-4">{item.step}</div>
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TARIFS */}
      <section className="bg-gray-50 py-20 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Tarifs transparents</h2>
          <p className="text-center text-gray-500 mb-14">Payez seulement quand vous êtes prêt à transmettre.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                name: "Essentiel",
                price: "Gratuit",
                color: "border-green-200 bg-green-50",
                badge: "bg-green-100 text-green-700",
                items: ["1 personne", "1 T4 + RL-1", "Calcul fédéral + Québec", "Préparation de la déclaration"],
                cta: "Commencer",
                ctaColor: "bg-green-600 hover:bg-green-700",
              },
              {
                name: "Simple",
                price: "19,95 $",
                color: "border-blue-200 bg-blue-50",
                badge: "bg-blue-100 text-blue-700",
                items: ["Plusieurs T4 / T4A", "OCR automatique", "Vérification avancée", "Transmission fédérale + QC"],
                cta: "Choisir Simple",
                ctaColor: "bg-blue-600 hover:bg-blue-700",
              },
              {
                name: "Autonome",
                price: "59,95 $",
                color: "border-orange-200 bg-orange-50",
                badge: "bg-orange-100 text-orange-700",
                items: ["Travailleur autonome", "Revenus + dépenses", "Véhicule · bureau domicile", "Amortissement"],
                cta: "Choisir Autonome",
                ctaColor: "bg-orange-600 hover:bg-orange-700",
              },
              {
                name: "Complet",
                price: "34,95 $",
                color: "border-purple-200 bg-purple-50",
                badge: "bg-purple-100 text-purple-700",
                items: ["Plusieurs employeurs", "Crédits et dépenses", "Placements simples", "Archivage des documents"],
                cta: "Choisir Complet",
                ctaColor: "bg-purple-600 hover:bg-purple-700",
              },
              {
                name: "Famille",
                price: "69,95 $",
                color: "border-red-200 bg-red-50",
                badge: "bg-red-100 text-red-700",
                items: ["2 adultes + enfants", "Déclarations conjointes", "Optimisation familiale", "Documents partagés"],
                cta: "Choisir Famille",
                ctaColor: "bg-red-600 hover:bg-red-700",
              },
              {
                name: "Pro",
                price: "119,95 $",
                color: "border-gray-300 bg-gray-900",
                badge: "bg-gray-700 text-gray-100",
                textColor: "text-white",
                descColor: "text-gray-300",
                items: ["Situation complexe", "Revenus étrangers", "Placements avancés", "Plusieurs sources"],
                cta: "Choisir Pro",
                ctaColor: "bg-white text-gray-900 hover:bg-gray-100",
              },
            ].map((plan) => (
              <div key={plan.name} className={`border-2 rounded-2xl p-6 ${plan.color}`}>
                <div className={`inline-block text-xs font-bold px-2 py-1 rounded-full mb-3 ${plan.badge}`}>
                  {plan.name}
                </div>
                <div className={`text-2xl font-bold mb-4 ${plan.textColor || "text-gray-900"}`}>{plan.price}</div>
                <ul className="space-y-2 mb-6">
                  {plan.items.map((item) => (
                    <li key={item} className={`text-sm flex items-center gap-2 ${plan.descColor || "text-gray-600"}`}>
                      <span className="text-green-500">✓</span> {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`block text-center text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors ${plan.ctaColor}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SÉCURITÉ */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Sécurité de niveau bancaire</h2>
        <p className="text-gray-500 mb-12">Vos données fiscales sont parmi les plus sensibles qui soient. Nous les traitons en conséquence.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: "🔐", label: "Chiffrement AES-256" },
            { icon: "🛡️", label: "Authentification MFA" },
            { icon: "📋", label: "Journal d'audit" },
            { icon: "🔑", label: "NAS jamais exposé" },
          ].map((item) => (
            <div key={item.label} className="bg-gray-50 rounded-xl p-6">
              <div className="text-3xl mb-3">{item.icon}</div>
              <div className="text-sm font-medium text-gray-700">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-red-600 py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Prêt à déclarer vos impôts ?
          </h2>
          <p className="text-red-100 mb-8">Commencez gratuitement. Payez seulement quand vous êtes prêt à transmettre.</p>
          <Link href="/signup" className="inline-block bg-white text-red-600 font-bold rounded-xl px-10 py-4 text-lg hover:bg-red-50 transition-colors">
            Créer mon compte gratuit
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="font-bold text-gray-600">
            <span className="text-red-600">Easy</span>Tax Canada
          </div>
          <div className="flex gap-6">
            <Link href="/confidentialite" className="hover:text-gray-600">Confidentialité</Link>
            <Link href="/conditions" className="hover:text-gray-600">Conditions</Link>
            <Link href="/securite" className="hover:text-gray-600">Sécurité</Link>
            <Link href="/contact" className="hover:text-gray-600">Contact</Link>
          </div>
          <div>© 2025 EasyTax Canada. Tous droits réservés.</div>
        </div>
      </footer>
    </main>
  );
}
