export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black tracking-tight">
            Easy<span className="text-blue-400">Tax</span>
          </span>
          <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-medium">Canada</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <a href="#" className="hover:text-white transition-colors">Particuliers</a>
          <a href="#" className="hover:text-white transition-colors">Travailleurs autonomes</a>
          <a href="#" className="hover:text-white transition-colors">Entreprises</a>
          <a href="#" className="hover:text-white transition-colors">Tarifs</a>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2">
            Connexion
          </button>
          <button className="text-sm bg-blue-600 hover:bg-blue-500 transition-colors px-4 py-2 rounded-lg font-medium">
            Commencer gratuitement
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-8 pt-24 pb-32 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm px-4 py-2 rounded-full mb-8">
          <span>🇨🇦</span>
          <span>Conçu pour les résidents canadiens · Fédéral + Québec</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight">
          Votre impôt,{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            simplifié.
          </span>
        </h1>

        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
          Déposez vos documents, répondez à quelques questions. 
          EasyTax prépare et transmet votre déclaration fédérale et Québec automatiquement.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 transition-all px-8 py-4 rounded-xl text-lg font-semibold shadow-lg shadow-blue-500/20">
            Déclarer maintenant — c&apos;est gratuit
          </button>
          <button className="w-full sm:w-auto border border-white/10 hover:border-white/20 transition-colors px-8 py-4 rounded-xl text-lg text-slate-300">
            Voir comment ça fonctionne →
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto text-center">
          {[
            { value: "2 min", label: "Pour commencer" },
            { value: "100%", label: "Sécurisé" },
            { value: "0 $", label: "Pour commencer" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-black text-white">{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white/5 border-y border-white/10 py-24">
        <div className="max-w-6xl mx-auto px-8">
          <h2 className="text-3xl font-black text-center mb-16">
            3 étapes. Pas 200 cases.
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: "📁",
                title: "Déposez vos documents",
                desc: "T4, RL-1, T5 et autres feuillets. Photo ou PDF — notre moteur OCR extrait tout automatiquement.",
              },
              {
                step: "02",
                icon: "💬",
                title: "Répondez aux questions",
                desc: "On vous guide avec des questions simples. Pas de formulaires T1 de 50 pages. Juste ce qui vous concerne.",
              },
              {
                step: "03",
                icon: "🚀",
                title: "Transmission automatique",
                desc: "EasyTax transmet votre déclaration à l'ARC et à Revenu Québec. Vous recevez la confirmation directement.",
              },
            ].map((item) => (
              <div key={item.step} className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-blue-500/30 transition-colors">
                <div className="text-4xl mb-4">{item.icon}</div>
                <div className="text-xs text-blue-400 font-mono font-bold mb-2">ÉTAPE {item.step}</div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 max-w-6xl mx-auto px-8">
        <h2 className="text-3xl font-black text-center mb-4">Tarifs transparents</h2>
        <p className="text-slate-400 text-center mb-16">Vous voyez votre remboursement estimé avant de payer.</p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { name: "Essentiel", price: "0", color: "from-slate-600 to-slate-700", badge: "Gratuit", desc: "Déclaration simple · 1 T4 · 1 personne" },
            { name: "Simple", price: "19,95", color: "from-blue-600 to-blue-700", badge: "Populaire", desc: "Plusieurs feuillets · OCR · Fédéral + Québec" },
            { name: "Autonome", price: "59,95", color: "from-purple-600 to-purple-700", badge: "", desc: "Travailleur autonome · Dépenses · Kilométrage" },
            { name: "Famille", price: "69,95", color: "from-orange-600 to-orange-700", badge: "", desc: "2 adultes + enfants · Optimisation familiale" },
          ].map((plan) => (
            <div key={plan.name} className={`relative bg-gradient-to-b ${plan.color} rounded-2xl p-6 border border-white/10`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  {plan.badge}
                </div>
              )}
              <div className="text-lg font-bold mb-1">{plan.name}</div>
              <div className="text-3xl font-black mb-1">
                {plan.price === "0" ? "Gratuit" : `${plan.price} $`}
              </div>
              <p className="text-white/60 text-xs mb-6">{plan.desc}</p>
              <button className="w-full bg-white/15 hover:bg-white/25 transition-colors rounded-lg py-2 text-sm font-medium">
                Choisir
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-8 text-center text-slate-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-xl font-black text-white">Easy<span className="text-blue-400">Tax</span></span>
          <span className="text-xs text-slate-500">Canada</span>
        </div>
        <p>© 2025 EasyTax Canada. Tous droits réservés.</p>
        <p className="mt-2 text-xs">
          EasyTax n&apos;est pas affilié à l&apos;Agence du revenu du Canada ni à Revenu Québec.
        </p>
      </footer>
    </main>
  );
}
