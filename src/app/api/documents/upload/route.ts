import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  fiscalDocuments, documentTypes, taxProfiles,
  taxYears, documentAuditLogs, users,
} from "@/db/schema";
import { validateFile, buildStorageKey, computeSHA256, uploadDocument, randomUUID } from "@/lib/storage";
import { eq, and, isNull } from "drizzle-orm";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";
import { auth, currentUser } from "@clerk/nextjs/server";

/**
 * Auto-provisionne le profil fiscal + l'année 2025 si absents.
 * Appelé au premier upload — zéro friction pour le client.
 */
async function ensureTaxProfile(clerkUserId: string): Promise<{ profileId: string; yearId: string }> {
  // 1. Assurer que l'user EasyTax existe
  let easyTaxUser = await db.select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName })
    .from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1).then(r => r[0] ?? null);

  if (!easyTaxUser) {
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses?.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ?? "";
    const [created] = await db.insert(users).values({
      clerkUserId,
      email,
      firstName: clerkUser?.firstName ?? null,
      lastName: clerkUser?.lastName ?? null,
      role: "INDIVIDUAL",
      status: "active",
      onboardingCompleted: false,
    }).returning({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName });
    easyTaxUser = created;
  }

  // 2. Assurer que le profil fiscal existe
  let profile = await db.select({ id: taxProfiles.id })
    .from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1).then(r => r[0] ?? null);

  if (!profile) {
    const [created] = await db.insert(taxProfiles).values({
      userId: clerkUserId,
      firstName: easyTaxUser.firstName ?? "—",
      lastName:  easyTaxUser.lastName  ?? "—",
      email:     easyTaxUser.email,
      province:  "QC", // défaut Québec — modifiable dans le profil
    }).returning({ id: taxProfiles.id });
    profile = created;
  }

  // 3. Assurer que l'année 2025 existe
  let year = await db.select({ id: taxYears.id })
    .from(taxYears).where(eq(taxYears.year, 2025)).limit(1).then(r => r[0] ?? null);

  if (!year) {
    const [created] = await db.insert(taxYears).values({
      year: 2025,
      status: "open",
      filingDeadlineFederal: "2026-04-30",
      filingDeadlineQuebec:  "2026-04-30",
    }).returning({ id: taxYears.id });
    year = created;
  }

  return { profileId: profile.id, yearId: year.id };
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return unauthorized();

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Données invalides" }, { status: 400 }); }

  const file             = formData.get("file")             as File   | null;
  const documentTypeCode = formData.get("documentTypeCode") as string | null;
  const taxReturnId      = formData.get("taxReturnId")      as string | null;
  // taxYearId est optionnel — on utilise 2025 par défaut
  const taxYearIdParam   = formData.get("taxYearId")        as string | null;

  if (!file || !documentTypeCode) {
    return NextResponse.json({ error: "file et documentTypeCode requis" }, { status: 400 });
  }

  const validation = validateFile({ mimeType: file.type, sizeBytes: file.size, filename: file.name });
  if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });

  // ── Auto-provisioning profil + année ──────────────────────────────────────
  const { profileId, yearId } = await ensureTaxProfile(clerkUserId);
  const taxYearId = taxYearIdParam ?? yearId;

  // ── Type de document ──────────────────────────────────────────────────────
  const docType = await db.select({ id: documentTypes.id })
    .from(documentTypes)
    .where(and(eq(documentTypes.code, documentTypeCode), eq(documentTypes.isActive, true)))
    .limit(1);

  if (docType.length === 0) {
    // Type inconnu → utiliser "OTHER" par défaut
    const other = await db.select({ id: documentTypes.id })
      .from(documentTypes).where(eq(documentTypes.code, "OTHER")).limit(1);
    if (other.length === 0) {
      return NextResponse.json({ error: `Type de document "${documentTypeCode}" inconnu` }, { status: 400 });
    }
    docType.push(other[0]);
  }

  // ── Dédup ─────────────────────────────────────────────────────────────────
  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = computeSHA256(buffer);

  const duplicate = await db.select({ id: fiscalDocuments.id, originalFilename: fiscalDocuments.originalFilename })
    .from(fiscalDocuments)
    .where(and(
      eq(fiscalDocuments.userId, clerkUserId),
      eq(fiscalDocuments.sha256Hash, sha256),
      eq(fiscalDocuments.taxYearId, taxYearId),
      isNull(fiscalDocuments.deletedAt),
    )).limit(1);

  if (duplicate.length > 0) {
    return NextResponse.json({
      error: "duplicate_detected",
      message: "Ce document semble déjà avoir été ajouté.",
      existingDocumentId: duplicate[0].id,
    }, { status: 409 });
  }

  // ── Upload S3 ─────────────────────────────────────────────────────────────
  const documentId = randomUUID();
  const storageKey = buildStorageKey({ userId: clerkUserId, taxYearId, documentId, mimeType: file.type });

  try {
    await uploadDocument({ buffer, storageKey, mimeType: file.type, originalFilename: file.name });
  } catch (err) {
    console.error("[upload] Storage error:", err);
    return NextResponse.json({ error: "Erreur stockage" }, { status: 500 });
  }

  // ── Insérer en DB ─────────────────────────────────────────────────────────
  const [created] = await db.insert(fiscalDocuments).values({
    id:             documentId,
    userId:         clerkUserId,
    taxProfileId:   profileId,
    taxYearId,
    taxReturnId:    taxReturnId ?? undefined,
    documentTypeId: docType[0].id,
    originalFilename: file.name,
    mimeType:       file.type,
    fileSizeBytes:  file.size,
    storagePath:    `tax-documents/${clerkUserId}/${taxYearId}/`,
    storageKey,
    sha256Hash:     sha256,
    source:         "user_upload",
    status:         "stored",
  }).returning({ id: fiscalDocuments.id, status: fiscalDocuments.status });

  await db.insert(documentAuditLogs).values({
    documentId: created.id,
    userId: clerkUserId,
    action: "document_uploaded",
    metadata: JSON.stringify({ documentTypeCode, mimeType: file.type, fileSizeBytes: file.size }),
  });

  return NextResponse.json({
    id: created.id,
    status: created.status,
    message: "Document ajouté.",
    profileCreated: !profileId, // flag pour le front
  }, { status: 201 });
}
