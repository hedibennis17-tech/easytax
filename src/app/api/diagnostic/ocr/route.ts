import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { taxProfiles, taxReturns, fiscalDocuments, documentExtractions, extractionFields, documentPages, documentAuditLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const url = new URL(req.url);
  const docId = url.searchParams.get("docId");
  const steps: string[] = [];
  const errors: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const details: Record<string, any> = {};

  try {
    const [profile] = await db.select({ id: taxProfiles.id }).from(taxProfiles).where(eq(taxProfiles.userId, userId)).limit(1);
    steps.push(`${profile ? "✓" : "✗"} Profil: ${profile?.id.slice(0,8) ?? "ABSENT"}`);
    const [tr] = profile ? await db.select({ id: taxReturns.id }).from(taxReturns).where(eq(taxReturns.profileId, profile.id)).orderBy(desc(taxReturns.updatedAt)).limit(1) : [null];
    steps.push(`${tr ? "✓" : "✗"} TaxReturn: ${tr?.id.slice(0,8) ?? "ABSENT"}`);

    const docs = await db.select({ id: fiscalDocuments.id, status: fiscalDocuments.status, mimeType: fiscalDocuments.mimeType, storageKey: fiscalDocuments.storageKey, taxReturnId: fiscalDocuments.taxReturnId, updatedAt: fiscalDocuments.updatedAt, documentTypeId: fiscalDocuments.documentTypeId })
      .from(fiscalDocuments).where(eq(fiscalDocuments.userId, userId)).orderBy(desc(fiscalDocuments.updatedAt)).limit(10);
    steps.push(`✓ Documents: ${docs.length}`);
    details.documents = docs.map(d => ({ id: d.id.slice(0,8), full_id: d.id, status: d.status, mime: d.mimeType, storageKey: d.storageKey, linkedTR: d.taxReturnId === tr?.id }));

    const target = docId ? docs.find(d => d.id === docId || d.id.startsWith(docId)) : docs[0];
    if (!target) { errors.push("Aucun document — uploader un feuillet d'abord"); }
    else {
      steps.push(`✓ Cible: ${target.id.slice(0,8)} status=${target.status} mime=${target.mimeType}`);
      if (!target.storageKey) errors.push("storageKey manquant — fichier non uploadé sur S3");
      if (!target.taxReturnId) errors.push("taxReturnId null sur le document — non lié au dossier fiscal");

      const [ext] = await db.select({ id: documentExtractions.id, status: documentExtractions.status, ocrProvider: documentExtractions.ocrProvider, overallConfidence: documentExtractions.overallConfidence, errorMessage: documentExtractions.errorMessage, extractedAt: documentExtractions.extractedAt, classificationReason: documentExtractions.classificationReason })
        .from(documentExtractions).where(eq(documentExtractions.fiscalDocumentId, target.id)).limit(1);
      if (!ext) { errors.push("Aucune extraction — pipeline pas déclenché ou crash avant écriture DB"); steps.push("✗ Extraction: ABSENTE"); }
      else {
        steps.push(`✓ Extraction: status=${ext.status} provider=${ext.ocrProvider ?? "?"} conf=${ext.overallConfidence}`);
        details.extraction = { ...ext, id: ext.id.slice(0,8) };
        if (ext.errorMessage) errors.push(`Erreur OCR: ${ext.errorMessage}`);

        const fields = await db.select({ code: extractionFields.fieldCode, value: extractionFields.rawOcrValue, conf: extractionFields.ocrConfidence })
          .from(extractionFields).where(eq(extractionFields.extractionId, ext.id));
        steps.push(`${fields.length > 0 ? "✓" : "✗"} ExtractionFields: ${fields.length} champs`);
        details.fields = fields.slice(0,20);
        if (fields.length === 0) errors.push("0 champs extraits — extracteur n'a rien trouvé dans le texte OCR");
      }

      const pages = await db.select({ p: documentPages.pageNumber, s: documentPages.ocrStatus, e: documentPages.ocrError, t: documentPages.ocrText, c: documentPages.ocrConfidence })
        .from(documentPages).where(eq(documentPages.documentId, target.id));
      steps.push(`${pages.length > 0 ? "✓" : "✗"} Pages OCR: ${pages.length}`);
      details.pages = pages.map(p => ({ page: p.p, status: p.s, error: p.e, textLen: p.t?.length ?? 0, conf: p.c }));
      if (pages.length === 0) errors.push("0 pages OCR — Google Document AI pas appelé ou crash S3");
      pages.forEach(p => {
        if (p.e) errors.push(`Page ${p.p}: ${p.e}`);
        if ((p.t?.length ?? 0) < 50) errors.push(`Page ${p.p}: texte trop court (${p.t?.length ?? 0} chars) — PDF vide ou illisible`);
      });

      const logs = await db.select({ action: documentAuditLogs.action, meta: documentAuditLogs.metadata, at: documentAuditLogs.createdAt })
        .from(documentAuditLogs).where(eq(documentAuditLogs.documentId, target.id)).orderBy(desc(documentAuditLogs.createdAt)).limit(15);
      steps.push(`✓ Audit: ${logs.length} événements`);
      details.auditLog = logs.map(l => ({ action: l.action, at: l.at, meta: l.meta ? (() => { try { return JSON.parse(l.meta as string); } catch { return l.meta; } })() : null }));
    }

    const hasGoogle = !!(process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PROCESSOR_ID);
    const hasS3 = !!(process.env.NEON_STORAGE_BUCKET ?? process.env.AWS_S3_BUCKET);
    steps.push(`${hasGoogle ? "✓" : "✗"} Google DocAI env: ${hasGoogle ? "OK" : "MANQUANT"}`);
    steps.push(`${hasS3 ? "✓" : "✗"} S3 bucket env: ${hasS3 ? "OK" : "MANQUANT"}`);
    if (!hasGoogle) errors.push("GOOGLE_CLOUD_PROJECT_ID ou GOOGLE_CLOUD_PROCESSOR_ID manquant dans .env");
    if (!hasS3) errors.push("NEON_STORAGE_BUCKET manquant dans .env");

  } catch(e) { errors.push(`Exception: ${e instanceof Error ? e.message : String(e)}`); }

  return NextResponse.json({ ok: errors.length === 0, steps, errors, details });
}