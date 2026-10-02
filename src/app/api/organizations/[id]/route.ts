import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { organizations, organizationMemberships } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { assertOrgMember } from "@/lib/org-service";

// GET /api/organizations/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  // Vérifier membership côté serveur
  const membership = await assertOrgMember(userId, id);
  if (!membership) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const [org] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, id), eq(organizations.status, "active")))
    .limit(1);

  if (!org) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });

  // Membres actifs
  const members = await db
    .select({
      id: organizationMemberships.id,
      userId: organizationMemberships.userId,
      role: organizationMemberships.role,
      status: organizationMemberships.status,
      acceptedAt: organizationMemberships.acceptedAt,
    })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, id),
        eq(organizationMemberships.status, "active")
      )
    );

  return NextResponse.json({
    organization: { ...org, businessNumberEncrypted: undefined }, // ne jamais exposer le chiffré
    members,
    currentUserRole: membership.role,
  });
}

// PATCH /api/organizations/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  const membership = await assertOrgMember(userId, id);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const { legalName, tradeName, province, address, city, postalCode, phone, email, website } = body;

  const [updated] = await db
    .update(organizations)
    .set({
      ...(legalName && { legalName }),
      ...(tradeName !== undefined && { tradeName }),
      ...(province && { province }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(postalCode !== undefined && { postalCode }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(website !== undefined && { website }),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, id))
    .returning();

  return NextResponse.json({ organization: { ...updated, businessNumberEncrypted: undefined } });
}
