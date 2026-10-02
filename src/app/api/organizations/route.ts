import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { organizations, organizationMemberships } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createNotification } from "@/lib/org-service";

// GET /api/organizations — Organisations de l'utilisateur connecté
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const rows = await db
    .select({
      id: organizations.id,
      legalName: organizations.legalName,
      tradeName: organizations.tradeName,
      type: organizations.type,
      status: organizations.status,
      province: organizations.province,
      businessNumberLast4: organizations.businessNumberLast4,
      role: organizationMemberships.role,
      createdAt: organizations.createdAt,
    })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
    .where(
      eq(organizationMemberships.userId, userId)
    );

  return NextResponse.json({ organizations: rows });
}

// POST /api/organizations — Créer une organisation
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { legalName, tradeName, type, province, address, city, postalCode, phone, email } = body;

  if (!legalName || !type) {
    return NextResponse.json({ error: "legalName et type requis" }, { status: 400 });
  }

  const validTypes = ["BUSINESS", "TAX_FIRM", "SOLE_PROPRIETORSHIP"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  }

  // Créer l'organisation
  const [org] = await db
    .insert(organizations)
    .values({
      ownerUserId: userId,
      type,
      legalName,
      tradeName: tradeName ?? null,
      province: province ?? null,
      address: address ?? null,
      city: city ?? null,
      postalCode: postalCode ?? null,
      phone: phone ?? null,
      email: email ?? null,
    })
    .returning();

  // Le créateur devient automatiquement OWNER
  await db.insert(organizationMemberships).values({
    organizationId: org.id,
    userId,
    role: "OWNER",
    status: "active",
    acceptedAt: new Date(),
  });

  // Notification de bienvenue
  await createNotification({
    userId,
    type: "org_created",
    titleFr: `Organisation créée : ${org.legalName}`,
    titleEn: `Organization created: ${org.legalName}`,
    relatedResourceType: "organization",
    relatedResourceId: org.id,
  });

  return NextResponse.json(org, { status: 201 });
}
