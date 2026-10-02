import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { assertOrgAdmin, createInvitation } from "@/lib/org-service";

// POST /api/organizations/[id]/invite — Inviter un membre
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id: orgId } = await params;

  // Seul OWNER ou ADMIN peut inviter
  const isAdmin = await assertOrgAdmin(userId, orgId);
  if (!isAdmin) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json();
  const { email, role } = body;

  if (!email || !role) {
    return NextResponse.json({ error: "email et role requis" }, { status: 400 });
  }

  const validRoles = ["ADMIN", "MEMBER", "EMPLOYEE", "ACCOUNTANT", "REVIEWER"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
  }

  const invitation = await createInvitation({
    type: "ORG_MEMBER",
    organizationId: orgId,
    invitedEmail: email,
    role,
    createdByUserId: userId,
    expiresInDays: 7,
  });

  // En production: envoyer un email avec le lien /invitations/[token]/accept
  // Pour l'instant, retourner le token (dev only)
  return NextResponse.json({
    invitationId: invitation.id,
    token: invitation.token, // À retirer en prod — envoyer par email uniquement
    expiresAt: invitation.expiresAt,
    message: `Invitation créée pour ${email}`,
  }, { status: 201 });
}
