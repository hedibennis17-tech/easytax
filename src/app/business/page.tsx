import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NavWrapper } from "@/components/NavWrapper";
import { db } from "@/lib/db";
import { organizations, organizationMemberships } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export default async function BusinessPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Guard rôle côté serveur — double sécurité après middleware
  try {
    const { getUserByClerkId } = await import("@/lib/user-service");
    const user = await getUserByClerkId(userId);
    const allowed: string[] = ["BUSINESS", "ADMIN", "SUPER_ADMIN"];
    if (user && !allowed.includes(user.role)) {
      redirect("/dashboard");
    }
  } catch { /* silencieux */ }

  let userOrgs: { id: string; legalName: string; tradeName: string | null; type: string; status: string; province: string | null; role: string; createdAt: Date }[] = [];
  let dbError = false;
  try {
    userOrgs = await db
      .select({
        id: organizations.id,
        legalName: organizations.legalName,
        tradeName: organizations.tradeName,
        type: organizations.type,
        status: organizations.status,
        province: organizations.province,
        role: organizationMemberships.role,
        createdAt: organizations.createdAt,
      })
      .from(organizationMemberships)
      .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
      .where(
        and(
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.status, "active"),
          eq(organizations.status, "active")
        )
      );
  } catch (e) {
    console.error("business page DB error:", e);
    dbError = true;
  }

  const typeLabels: Record<string, string> = {
    BUSINESS: "Entreprise incorporée",
    TAX_FIRM: "Cabinet comptable",
    SOLE_PROPRIETORSHIP: "Entreprise individuelle",
  };

  const roleLabels: Record<string, string> = {
    OWNER: "Propriétaire", ADMIN: "Administrateur", MEMBER: "Membre",
    EMPLOYEE: "Employé", ACCOUNTANT: "Comptable", REVIEWER: "Réviseur",
  };

  const typeIcons: Record<string, string> = {
    BUSINESS: "🏛️", TAX_FIRM: "⚖️", SOLE_PROPRIETORSHIP: "🧑‍💼",
  };

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <NavWrapper />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Espace Business
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
              {userOrgs.length === 0
                ? "Aucune organisation enregistrée"
                : `${userOrgs.length} organisation${userOrgs.length > 1 ? "s" : ""} active${userOrgs.length > 1 ? "s" : ""}`}
            </p>
          </div>
          <Link href="/business/new" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: "var(--et-red)", color: "#fff", textDecoration: "none",
            boxShadow: "0 2px 8px rgba(229,52,42,0.25)",
          }}>
            + Créer une organisation
          </Link>
        </div>

        {dbError ? (
          /* Erreur DB — migration manquante */
          <div style={{
            background: "rgba(229,52,42,0.06)", border: "1.5px solid rgba(229,52,42,0.25)",
            borderRadius: 18, padding: "40px 28px", textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--et-red)", marginBottom: 8 }}>
              Migration de base de données requise
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
              Les tables de la migration 0006 doivent être appliquées. Lancez la migration via l'API admin.
            </p>
            <code style={{
              display: "block", background: "var(--bg-base)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)",
              fontFamily: "monospace",
            }}>
              GET /api/admin/migrate?token=MIGRATE_SECRET
            </code>
          </div>
        ) : userOrgs.length === 0 ? (
          /* État vide */
          <div style={{
            border: "2px dashed var(--border)", borderRadius: 20,
            padding: "64px 24px", textAlign: "center",
            background: "var(--bg-card)",
          }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🏢</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              Aucune organisation
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, maxWidth: 400, margin: "0 auto 24px" }}>
              Créez votre entreprise ou cabinet comptable pour gérer vos documents,
              employés et déclarations d&apos;entreprise.
            </p>
            <Link href="/business/new" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "11px 24px", borderRadius: 12, fontSize: 14, fontWeight: 600,
              background: "var(--et-red)", color: "#fff", textDecoration: "none",
            }}>
              + Créer mon organisation
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {userOrgs.map((org) => (
              <div key={org.id} style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 18, padding: "20px 22px",
                boxShadow: "var(--shadow-sm)",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ display: "flex", gap: 14 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, fontSize: 22,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(229,52,42,0.1)", flexShrink: 0,
                    }}>
                      {typeIcons[org.type] ?? "🏢"}
                    </div>
                    <div>
                      <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 3px" }}>
                        {org.legalName}
                      </h2>
                      {org.tradeName && (
                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>
                          « {org.tradeName} »
                        </p>
                      )}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                          background: "rgba(37,99,235,0.1)", color: "#2563EB",
                        }}>{typeLabels[org.type] ?? org.type}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                          background: "rgba(22,163,74,0.1)", color: "#16A34A",
                        }}>{roleLabels[org.role] ?? org.role}</span>
                        {org.province && (
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                            background: "var(--bg-card-hover)", color: "var(--text-secondary)",
                          }}>{org.province}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link href={`/business/${org.id}`} style={{
                    padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 600,
                    background: "var(--bg-card-hover)", color: "var(--text-primary)",
                    textDecoration: "none", border: "1px solid var(--border)", flexShrink: 0,
                  }}>
                    Ouvrir →
                  </Link>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {[
                    { label: "Membres", value: "—" },
                    { label: "Documents", value: "—" },
                    { label: "Déclarations", value: "—" },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      background: "var(--bg-base)", borderRadius: 10, padding: "10px 12px", textAlign: "center",
                    }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info types */}
        <div style={{ marginTop: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>
            Types d&apos;organisations disponibles
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
            {[
              { icon: "🏛️", name: "Entreprise incorporée", desc: "Inc., Ltd., Corp., s.e.n.c.r.l." },
              { icon: "🧑‍💼", name: "Entreprise individuelle", desc: "Travailleur autonome enregistré" },
              { icon: "⚖️", name: "Cabinet comptable", desc: "CPA, comptable, préparateur fiscal" },
            ].map(({ icon, name, desc }) => (
              <div key={name} style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12,
              }}>
                <span style={{ fontSize: 22 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
