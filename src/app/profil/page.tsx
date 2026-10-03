import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NavWrapper } from "@/components/NavWrapper";
import { db } from "@/lib/db";
import { users, taxProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function ProfilPage() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const [userRow] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
  const [profile] = await db.select().from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);

  const hasProfil  = !!profile;
  const isComplete = hasProfil && !!profile?.firstName && !!profile?.province;

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <NavWrapper />
      <main style={{ maxWidth: 620, margin: "0 auto", padding: "28px 16px 60px" }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px" }}>Mon profil EasyTax</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Ces informations apparaissent sur votre déclaration T1 / TP-1</p>
        </div>

        {/* ALERTE profil incomplet */}
        {!isComplete && (
          <div style={{
            background: "rgba(229,52,42,0.08)", border: "2px solid rgba(229,52,42,0.4)",
            borderRadius: 16, padding: "20px", marginBottom: 20,
          }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--et-red)", marginBottom: 8 }}>
              Profil fiscal incomplet
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
              Votre profil EasyTax n&apos;est pas encore configuré. Vous devez le compléter
              avant de pouvoir uploader des documents ou produire votre déclaration.
            </p>
            <Link href="/onboarding" style={{
              display: "inline-block", padding: "12px 24px", borderRadius: 12,
              background: "var(--et-red)", color: "#fff", textDecoration: "none",
              fontSize: 14, fontWeight: 700,
            }}>
              Créer mon profil fiscal →
            </Link>
          </div>
        )}

        {/* Carte profil */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, padding: "22px 20px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Informations fiscales</h2>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
              background: isComplete ? "rgba(22,163,74,0.12)" : "rgba(229,52,42,0.10)",
              color: isComplete ? "#16A34A" : "var(--et-red)",
            }}>
              {isComplete ? "✓ Complet" : "Incomplet"}
            </span>
          </div>

          {[
            { label: "Prénom",           value: profile?.firstName,                   required: true  },
            { label: "Nom de famille",   value: profile?.lastName,                    required: true  },
            { label: "Date de naissance",value: profile?.dateOfBirth ? String(profile.dateOfBirth) : null, required: false },
            { label: "Province",         value: profile?.province ?? null,             required: true  },
            { label: "Téléphone",        value: profile?.phone ?? null,               required: false },
            { label: "Email",            value: userRow?.email ?? null,               required: false },
          ].map(({ label, value, required }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2 }}>
                  {label}{required && <span style={{ color: "var(--et-red)", marginLeft: 3 }}>*</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: value ? 600 : 400, color: value ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {value ?? "—"}
                </div>
              </div>
              {!value && required && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: "rgba(229,52,42,0.10)", color: "var(--et-red)", flexShrink: 0 }}>
                  Requis
                </span>
              )}
            </div>
          ))}

          <Link href="/onboarding" style={{
            display: "block", textAlign: "center", padding: "12px 0",
            borderRadius: 12, marginTop: 18, fontSize: 13, fontWeight: 700, textDecoration: "none",
            background: isComplete ? "var(--bg-base)" : "var(--et-red)",
            color: isComplete ? "var(--text-secondary)" : "#fff",
            border: isComplete ? "1px solid var(--border)" : "none",
          }}>
            {isComplete ? "✏️ Modifier mon profil" : "Compléter maintenant →"}
          </Link>
        </div>

        {/* Compte */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, padding: "18px 20px", marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 14px" }}>Compte EasyTax</h2>
          {[
            { label: "Rôle",          value: userRow?.role ?? "INDIVIDUAL" },
            { label: "Profil fiscal", value: hasProfil ? "Créé ✓" : "Manquant ⚠️" },
            { label: "Compte",        value: userRow?.email ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{label}</span>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Déconnexion */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{userRow?.email}</span>
            <Link href="/sign-out" style={{
              padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700,
              background: "rgba(229,52,42,0.08)", color: "var(--et-red)",
              border: "1px solid rgba(229,52,42,0.2)", textDecoration: "none",
            }}>
              Déconnexion
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}
