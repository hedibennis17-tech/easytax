import { AppNav } from "@/components/AppNav";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { db } from "@/lib/db";
import { organizations, organizationMemberships } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export default async function BusinessPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Toutes les orgs de l'utilisateur — filtrées côté serveur
  const userOrgs = await db
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

  const typeLabels: Record<string, string> = {
    BUSINESS: "Entreprise incorporée",
    TAX_FIRM: "Cabinet comptable",
    SOLE_PROPRIETORSHIP: "Entreprise individuelle",
  };

  const roleLabels: Record<string, string> = {
    OWNER: "Propriétaire",
    ADMIN: "Administrateur",
    MEMBER: "Membre",
    EMPLOYEE: "Employé",
    ACCOUNTANT: "Comptable",
    REVIEWER: "Réviseur",
  };

  return (
    <main style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <AppNav />

            <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Espace Business</h1>
            <p className="text-sm text-gray-400 mt-1">
              {userOrgs.length === 0
                ? "Aucune organisation pour le moment"
                : `${userOrgs.length} organisation${userOrgs.length > 1 ? "s" : ""}`}
            </p>
          </div>
          <CreateOrgButton />
        </div>

        {userOrgs.length === 0 ? (
          <EmptyOrgs />
        ) : (
          <div className="space-y-4">
            {userOrgs.map((org) => (
              <OrgCard
                key={org.id}
                org={org}
                typeLabel={typeLabels[org.type] ?? org.type}
                roleLabel={roleLabels[org.role] ?? org.role}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function OrgCard({
  org,
  typeLabel,
  roleLabel,
}: {
  org: { id: string; legalName: string; tradeName: string | null; province: string | null; createdAt: Date };
  typeLabel: string;
  roleLabel: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-bold text-gray-900 text-lg">{org.legalName}</h2>
          {org.tradeName && (
            <p className="text-sm text-gray-400">«&nbsp;{org.tradeName}&nbsp;»</p>
          )}
          <div className="flex gap-2 mt-2">
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {typeLabel}
            </span>
            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
              {roleLabel}
            </span>
            {org.province && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {org.province}
              </span>
            )}
          </div>
        </div>
        <Link
          href={`/business/${org.id}`}
          className="text-sm text-red-600 hover:underline font-medium"
        >
          Ouvrir →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs text-gray-500">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-gray-900">—</div>
          <div>Membres</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-gray-900">—</div>
          <div>Documents</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-gray-900">—</div>
          <div>Déclarations</div>
        </div>
      </div>
    </div>
  );
}

function EmptyOrgs() {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
      <div className="text-4xl mb-4">🏢</div>
      <h2 className="font-bold text-gray-700 mb-2">Aucune organisation</h2>
      <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
        Créez votre entreprise ou cabinet comptable pour gérer vos documents,
        employés et déclarations d&apos;entreprise.
      </p>
      <CreateOrgButton primary />
    </div>
  );
}

function CreateOrgButton({ primary }: { primary?: boolean }) {
  return (
    <Link
      href="/business/new"
      className={
        primary
          ? "bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
          : "border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
      }
    >
      + Créer une organisation
    </Link>
  );
}
