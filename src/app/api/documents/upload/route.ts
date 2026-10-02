import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fiscalDocuments, documentTypes, taxProfiles, taxYears, documentAuditLogs } from "@/db/schema";
import { validateFile, buildStorageKey, computeSHA256, uploadDocument, randomUUID } from "@/lib/storage";
import { eq, and, isNull } from "drizzle-orm";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Données invalides" }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  const documentTypeCode = formData.get("documentTypeCode") as string | null;
  const taxYearId = formData.get("taxYearId") as string | null;
  const taxReturnId = formData.get("taxReturnId") as string | null;

  if (!file || !documentTypeCode || !taxYearId) return NextResponse.json({ error: "file, documentTypeCode et taxYearId requis" }, { status: 400 });

  const validation = validateFile({ mimeType: file.type, sizeBytes: file.size, filename: file.name });
  if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });

  const profile = await db.select({ id: taxProfiles.id }).from(taxProfiles).where(eq(taxProfiles.userId, ctx.clerkUserId)).limit(1);
  if (profile.length === 0) return NextResponse.json({ error: "Profil fiscal introuvable" }, { status: 404 });

  const year = await db.select({ id: taxYears.id }).from(taxYears).where(eq(taxYears.id, taxYearId)).limit(1);
  if (year.length === 0) return NextResponse.json({ error: "Année fiscale introuvable" }, { status: 404 });

  const docType = await db.select({ id: documentTypes.id }).from(documentTypes).where(and(eq(documentTypes.code, documentTypeCode), eq(documentTypes.isActive, true))).limit(1);
  if (docType.length === 0) return NextResponse.json({ error: "Type de document inconnu" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = computeSHA256(buffer);

  const duplicate = await db.select({ id: fiscalDocuments.id, originalFilename: fiscalDocuments.originalFilename }).from(fiscalDocuments)
    .where(and(eq(fiscalDocuments.userId, ctx.clerkUserId), eq(fiscalDocuments.sha256Hash, sha256), eq(fiscalDocuments.taxYearId, taxYearId), isNull(fiscalDocuments.deletedAt))).limit(1);

  if (duplicate.length > 0) return NextResponse.json({ error: "duplicate_detected", message: "Ce document semble déjà avoir été ajouté.", existingDocumentId: duplicate[0].id }, { status: 409 });

  const documentId = randomUUID();
  const storageKey = buildStorageKey({ userId: ctx.clerkUserId, taxYearId, documentId, mimeType: file.type });

  try { await uploadDocument({ buffer, storageKey, mimeType: file.type, originalFilename: file.name }); }
  catch (err) { console.error("[upload] Storage error:", err); return NextResponse.json({ error: "Erreur stockage" }, { status: 500 }); }

  const [created] = await db.insert(fiscalDocuments).values({
    id: documentId, userId: ctx.clerkUserId, taxProfileId: profile[0].id, taxYearId,
    taxReturnId: taxReturnId ?? undefined, documentTypeId: docType[0].id,
    originalFilename: file.name, mimeType: file.type, fileSizeBytes: file.size,
    storagePath: `tax-documents/${ctx.clerkUserId}/${taxYearId}/`, storageKey,
    sha256Hash: sha256, source: "user_upload", status: "stored",
  }).returning({ id: fiscalDocuments.id, status: fiscalDocuments.status });

  await db.insert(documentAuditLogs).values({
    documentId: created.id, userId: ctx.clerkUserId, action: "document_uploaded",
    metadata: JSON.stringify({ documentTypeCode, mimeType: file.type, fileSizeBytes: file.size }),
  });

  return NextResponse.json({ id: created.id, status: created.status, message: "Document ajouté." }, { status: 201 });
}
