"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [status, setStatus] = useState<"syncing" | "done" | "error">("syncing");

  useEffect(() => {
    if (!isLoaded || !user) return;

    async function syncUser() {
      try {
        // Sync Clerk → EasyTax users table
        const res = await fetch("/api/auth/sync", { method: "POST" });
        if (!res.ok) throw new Error("Erreur sync");

        const data = await res.json();

        // Marquer l'onboarding comme complété
        await fetch("/api/auth/complete-onboarding", { method: "POST" });

        setStatus("done");
        setTimeout(() => router.push("/dashboard"), 800);
      } catch {
        setStatus("error");
      }
    }

    syncUser();
  }, [isLoaded, user, router]);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mb-6">
          <span className="text-3xl font-bold text-red-600">Easy</span>
          <span className="text-3xl font-bold text-gray-900">Tax</span>
        </div>

        {status === "syncing" && (
          <>
            <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Préparation de votre espace…
            </h1>
            <p className="text-gray-500 text-sm">
              Création de votre dossier EasyTax
            </p>
          </>
        )}

        {status === "done" && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Bienvenue sur EasyTax !
            </h1>
            <p className="text-gray-500 text-sm">
              Redirection vers votre tableau de bord…
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Une erreur est survenue
            </h1>
            <p className="text-gray-500 text-sm mb-4">
              Impossible de créer votre compte EasyTax.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white rounded-xl px-6 py-2 text-sm font-semibold"
            >
              Réessayer
            </button>
          </>
        )}
      </div>
    </main>
  );
}
