import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  fiscalDocuments,
  documentTypes,
  taxProfiles,
  taxYears,
  documentAuditLogs,
} from "@/db/schema";
import {
  validateFile,
  buildStorageKey,
  computeSHA256,
  uploadDocument,
  randomUUID,
} from "@/lib/storage";
import { eq, and, isNull } from "drizzle-orm";

function getUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

// POST /api/documents/upload
export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Lire le multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const documentTypeCode = formData.get("documentTypeCode") as string | null;
  const taxYearId = formData.get("taxYearId") as string | null;
  const taxReturnId = formData.get("taxReturnId") as string | null;

  if (!file || !documentTypeCode || !taxYearId) {
    return NextResponse.json(
      { error: "Champs requis manquants : file, documentTypeCode, taxYearId" },
      { status: 400 }
    );
  }

  // 1. Valider le fichier
  const validation = validateFile({
    mimeType: file.type,
    sizeBytes: file.size,
    filename: file.name,
  });

  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // 2. Vérifier que le profil appartient à cet utilisateur
  const profile = await db
    .select({ id: taxProfiles.id })
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, userId))
    .limit(1);

  if (profile.length === 0) {
    return NextResponse.json(
      { error: "Profil fiscal introuvable" },
      { status: 404 }
    );
  }

  // 3. Vérifier que l'année fiscale existe
  const year = await db
    .select({ id: taxYears.id })
    .from(taxYears)
    .where(eq(taxYears.id, taxYearId))
    .limit(1);

  if (year.length === 0) {
    return NextResponse.json(
      { error: "Année fiscale introuvable" },
      { status: 404 }
    );
  }

  // 4. Vérifier le type de document
  const docType = await db
    .select({ id: documentTypes.id, code: documentTypes.code })
    .from(documentTypes)
    .where(and(eq(documentTypes.code, documentTypeCode), eq(documentTypes.isActive, true)))
    .limit(1);

  if (docType.length === 0) {
    return NextResponse.json(
      { error: "Type de document inconnu" },
      { status: 400 }
    );
  }

  // 5. Lire le buffer et calculer le hash
  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = computeSHA256(buffer);

  // 6. Détecter les doublons (même hash, même utilisateur, même année, non-supprimé)
  const duplicate = await db
    .select({ id: fiscalDocuments.id, originalFilename: fiscalDocuments.originalFilename })
    .from(fiscalDocuments)
    .where(
      and(
        eq(fiscalDocuments.userId, userId),
        eq(fiscalDocuments.sha256Hash, sha256),
        eq(fiscalDocuments.taxYearId, taxYearId),
        isNull(fiscalDocuments.deletedAt)
      )
    )
    .limit(1);

  if (duplicate.length > 0) {
    return NextResponse.json(
      {
        error: "duplicate_detected",
        message: "Ce document semble déjà avoir été ajouté.",
        existingDocumentId: duplicate[0].id,
        existingFilename: duplicate[0].originalFilename,
      },
      { status: 409 }
    );
  }

  // 7. Construire un chemin de stockage non-prévisible
  const documentId = randomUUID();
  const storageKey = buildStorageKey({
    userId,
    taxYearId,
    documentId,
    mimeType: file.type,
  });

  // 8. Uploader vers Neon Object Storage
  try {
    await uploadDocument({
      buffer,
      storageKey,
      mimeType: file.type,
      originalFilename: file.name,
    });
  } catch (err) {
    console.error("[upload] Storage error:", err);
    return NextResponse.json(
      { error: "Erreur lors du stockage du fichier" },
      { status: 500 }
    );
  }

  // 9. Enregistrer les métadonnées en DB
  const [created] = await db
    .insert(fiscalDocuments)
    .values({
      id: documentId,
      userId,
      taxProfileId: profile[0].id,
      taxYearId,
      taxReturnId: taxReturnId ?? undefined,
      documentTypeId: docType[0].id,
      originalFilename: file.name,
      mimeType: file.type,
      fileSizeBytes: file.size,
      storagePath: `tax-documents/${userId}/${taxYearId}/`,
      storageKey,
      sha256Hash: sha256,
      source: "user_upload",
      status: "stored",
    })
    .returning({
      id: fiscalDocuments.id,
      status: fiscalDocuments.status,
      originalFilename: fiscalDocuments.originalFilename,
    });

  // 10. Audit log (sans données sensibles)
  await db.insert(documentAuditLogs).values({
    documentId: created.id,
    userId,
    action: "document_uploaded",
    metadata: JSON.stringify({
      documentTypeCode,
      mimeType: file.type,
      fileSizeBytes: file.size,
      // JAMAIS : NAS, contenu, revenus, sha256 dans les logs
    }),
  });

  return NextResponse.json(
    {
      id: created.id,
      status: created.status,
      message: "Document ajouté avec succès.",
    },
    { status: 201 }
  );
}
