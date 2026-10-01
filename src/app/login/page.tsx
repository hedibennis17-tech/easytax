import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-bold text-red-600">Easy</span>
            <span className="text-2xl font-bold text-gray-900">Tax</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-2">Connexion</h1>
          <p className="text-gray-500 text-sm">Accédez à votre dossier fiscal</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Courriel</label>
              <input type="email" placeholder="jean@exemple.ca" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
              <input type="password" placeholder="••••••••" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                <input type="checkbox" className="rounded" />
                Se souvenir de moi
              </label>
              <Link href="/mot-de-passe-oublie" className="text-red-600 hover:underline">Mot de passe oublié ?</Link>
            </div>
            <button className="w-full bg-red-600 text-white rounded-lg py-3 text-sm font-semibold hover:bg-red-700 transition-colors">
              Se connecter
            </button>
          </div>
          <p className="text-center text-sm text-gray-500 mt-6">
            Pas encore de compte ?{" "}
            <Link href="/signup" className="text-red-600 font-medium hover:underline">Créer mon compte</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
