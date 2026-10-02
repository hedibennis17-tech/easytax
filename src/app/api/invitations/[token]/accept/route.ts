import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { acceptInvitation } from "@/lib/org-service";

// POST /api/invitations/[token]/accept
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { token } = await params;

  const result = await acceptInvitation(token, userId);

  if (!result.success) {
    const messages: Record<string, string> = {
      invitation_not_found: "Invitation introuvable ou déjà utilisée",
      invitation_expired: "Cette invitation a expiré",
    };
    return NextResponse.json(
      { error: messages[result.reason ?? ""] ?? "Erreur" },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, type: result.invitation?.type });
}
