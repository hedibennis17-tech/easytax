import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1">
          <span className="text-xl font-bold text-red-600">Easy</span>
          <span className="text-xl font-bold text-gray-900">Tax</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Jean Tremblay</span>
          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold text-sm">J</div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Bonjour Jean 👋</h1>
          <p className="text-gray-500 mt-1">Saison fiscale 2025 — Votre déclaration est en cours.</p>
        </div>

        {/* Progression */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">🟢 Déclaration 2025</h2>
            <span className="text-sm text-gray-500">Progression : 20%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-6">
            <div className="bg-red-500 h-2 rounded-full" style={{ width: "20%" }}></div>
          </div>
          <div className="space-y-2">
            {[
              { label: "Identité", status: "✅" },
              { label: "Situation familiale", status: "⏳" },
              { label: "Revenus", status: "⏳" },
              { label: "Documents", status: "⏳" },
              { label: "Dépenses et crédits", status: "⏳" },
              { label: "Déclaration fédérale", status: "⏳" },
              { label: "Déclaration Québec", status: "⏳" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-700">{item.label}</span>
                <span>{item.status}</span>
              </div>
            ))}
          </div>
          <button className="mt-6 w-full bg-red-600 text-white rounded-xl py-3 font-semibold hover:bg-red-700 transition-colors">
            Continuer ma déclaration →
          </button>
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: "📄", label: "Ajouter un document", desc: "T4, RL-1, T5, reçus…" },
            { icon: "🧾", label: "Mes feuillets", desc: "0 document importé" },
            { icon: "💰", label: "Résultat estimé", desc: "Compléter d'abord" },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm cursor-pointer hover:border-red-200 transition-colors">
              <div className="text-2xl mb-3">{card.icon}</div>
              <div className="font-semibold text-gray-900 text-sm">{card.label}</div>
              <div className="text-xs text-gray-500 mt-1">{card.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
