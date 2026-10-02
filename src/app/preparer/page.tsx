import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { db } from "@/lib/db";
import { preparerProfiles, preparerClientAssignments, taxProfiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export default async function PreparerPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [profile] = await db.select().from(preparerProfiles)
    .where(eq(preparerProfiles.userId, userId)).limit(1);

  const clients = profile
    ? await db.select({
        assignmentId: preparerClientAssignments.id,
        status: preparerClientAssignments.status,
        assignedAt: preparerClientAssignments.assignedAt,
        authorizedTaxYears: preparerClientAssignments.authorizedTaxYears,
        clientId: taxProfiles.id,
        clientFirstName: taxProfiles.firstName,
        clientLastName: taxProfiles.lastName,
        clientProvince: taxProfiles.province,
      })
      .from(preparerClientAssignments)
      .innerJoin(taxProfiles, eq(preparerClientAssignments.clientProfileId, taxProfiles.id))
      .where(and(
        eq(preparerClientAssignments.preparerId, profile.id),
        eq(preparerClientAssignments.status, "active")
      ))
    : [];

  const stats = [
    { label: "Clients actifs",        value: clients.length, icon: "👥", color: "#2563EB" },
    { label: "Dossiers en cours",     value: "—",            icon: "📋", color: "#7C3AED" },
    { label: "En attente révision",   value: "—",            icon: "⏳", color: "#D97706" },
  ];

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <AppNav />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Espace Préparateur
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
            Gérez vos clients et leurs dossiers fiscaux
          </p>
        </div>

        {!profile ? (
          /* Pas de profil préparateur */
          <div style={{
            background: "var(--bg-card)", border: "2px dashed var(--border)",
            borderRadius: 20, padding: "60px 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🧑‍💼</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              Profil préparateur non activé
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, maxWidth: 400, margin: "0 auto 24px" }}>
              Pour accéder à l&apos;espace préparateur, activez votre profil professionnel.
              Vous pourrez ensuite gérer vos clients et leurs dossiers fiscaux.
            </p>
            <button style={{
              padding: "11px 24px", borderRadius: 12, fontSize: 14, fontWeight: 600,
              background: "var(--et-red)", color: "#fff", border: "none", cursor: "pointer",
            }}>
              Activer mon profil préparateur →
            </button>

            {/* Ce qu'offre l'espace préparateur */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10, marginTop: 32, textAlign: "left" }}>
              {[
                { icon: "👥", title: "Gestion clients",  desc: "Gérez tous vos clients dans un seul espace" },
                { icon: "📁", title: "Dossiers partagés", desc: "Accédez aux dossiers autorisés par vos clients" },
                { icon: "✅", title: "Révision fiscale",  desc: "Révisez et validez les déclarations" },
                { icon: "🔒", title: "Accès sécurisé",   desc: "Chaque accès est autorisé explicitement" },
              ].map(({ icon, title, desc }) => (
                <div key={title} style={{
                  background: "var(--bg-base)", borderRadius: 12, padding: "14px 16px",
                  border: "1px solid var(--border)",
                }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
              {stats.map(({ label, value, icon, color }) => (
                <div key={label} style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 16, padding: "18px 16px", boxShadow: "var(--shadow-sm)",
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, fontSize: 18,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: `${color}18`, marginBottom: 10,
                  }}>{icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>{value}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Liste clients */}
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 18, padding: "20px 22px", boxShadow: "var(--shadow-sm)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  Clients assignés
                </h2>
                <button style={{
                  padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 600,
                  background: "rgba(229,52,42,0.1)", color: "var(--et-red)",
                  border: "none", cursor: "pointer",
                }}>
                  + Inviter un client
                </button>
              </div>

              {clients.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 4px" }}>
                    Aucun client assigné pour le moment.
                  </p>
                  <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    Invitez vos clients à vous autoriser l&apos;accès à leur dossier.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {clients.map((c) => {
                    const years = c.authorizedTaxYears ? (JSON.parse(c.authorizedTaxYears) as number[]) : [];
                    return (
                      <div key={c.assignmentId} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 14px", borderRadius: 12,
                        background: "var(--bg-base)", border: "1px solid var(--border)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 50, fontSize: 14, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "rgba(37,99,235,0.1)", color: "#2563EB",
                          }}>
                            {c.clientFirstName?.[0] ?? "?"}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                              {c.clientFirstName} {c.clientLastName}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {c.clientProvince} · Années : {years.length > 0 ? years.join(", ") : "Toutes"}
                            </div>
                          </div>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 100,
                          background: "rgba(22,163,74,0.1)", color: "#16A34A",
                        }}>Actif</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Info sécurité */}
            <div style={{
              marginTop: 16, padding: "14px 18px", borderRadius: 12,
              background: "rgba(37,99,235,0.07)", border: "1px solid rgba(37,99,235,0.2)",
              fontSize: 13, color: "#2563EB",
            }}>
              🔒 Chaque accès à un dossier client nécessite une autorisation explicite du client.
            </div>
          </>
        )}
      </main>
    </div>
  );
}
