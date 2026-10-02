import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fiscalDocuments } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { runOcrPipeline } from "@/lib/pipeline";

function getUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

// POST /api/documents/[id]/process
// Lance le pipeline OCR + classification + extraction pour un document
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const taxYear: number | undefined = body.taxYear;

  // Vérifier ownership avant de lancer
  const doc = await db
    .select({ id: fiscalDocuments.id, status: fiscalDocuments.status, userId: fiscalDocuments.userId })
    .from(fiscalDocuments)
    .where(and(eq(fiscalDocuments.id, id), isNull(fiscalDocuments.deletedAt)))
    .limit(1);

  if (!doc[0]) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  if (doc[0].userId !== userId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  // Ne pas re-traiter si déjà en cours
  if (doc[0].status === "processing") {
    return NextResponse.json({ error: "Traitement déjà en cours" }, { status: 409 });
  }

  // Lancer le pipeline (synchrone pour l'instant — async queue à l'étape suivante)
  const result = await runOcrPipeline({ documentId: id, userId, taxYear });

  if (result.status === "failed") {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result, { status: 200 });
}
