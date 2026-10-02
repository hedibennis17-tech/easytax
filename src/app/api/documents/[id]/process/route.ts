import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fiscalDocuments } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { runOcrPipeline } from "@/lib/pipeline";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const taxYear: number | undefined = body.taxYear;

  const doc = await db
    .select({ id: fiscalDocuments.id, status: fiscalDocuments.status, userId: fiscalDocuments.userId })
    .from(fiscalDocuments)
    .where(and(eq(fiscalDocuments.id, id), isNull(fiscalDocuments.deletedAt)))
    .limit(1);

  if (!doc[0]) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  if (doc[0].userId !== ctx.clerkUserId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  if (doc[0].status === "processing") return NextResponse.json({ error: "Traitement déjà en cours" }, { status: 409 });

  const result = await runOcrPipeline({ documentId: id, userId: ctx.clerkUserId, taxYear });

  if (result.status === "failed") return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json(result);
}
