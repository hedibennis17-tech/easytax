import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-bold text-red-600">Easy</span>
            <span className="text-2xl font-bold text-gray-900">Tax</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-2">Créer votre compte</h1>
          <p className="text-gray-500 text-sm">Commencez votre déclaration fiscale gratuitement</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Prénom</label>
                <input type="text" placeholder="Jean" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
                <input type="text" placeholder="Tremblay" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Courriel</label>
              <input type="email" placeholder="jean@exemple.ca" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
              <input type="password" placeholder="••••••••" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Province de résidence</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white">
                <option value="QC">Québec</option>
                <option value="ON">Ontario</option>
                <option value="BC">Colombie-Britannique</option>
                <option value="AB">Alberta</option>
                <option value="OTHER">Autre province</option>
              </select>
            </div>
            <button className="w-full bg-red-600 text-white rounded-lg py-3 text-sm font-semibold hover:bg-red-700 transition-colors mt-2">
              Créer mon compte
            </button>
          </div>
          <p className="text-center text-sm text-gray-500 mt-6">
            Déjà un compte ?{" "}
            <Link href="/login" className="text-red-600 font-medium hover:underline">Se connecter</Link>
          </p>
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          En créant un compte, vous acceptez nos{" "}
          <Link href="/conditions" className="underline">conditions d&#39;utilisation</Link>{" "}
          et notre{" "}
          <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.
        </p>
      </div>
    </main>
  );
}
