import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, HeadObjectCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash, randomUUID } from "crypto";

const BUCKET = process.env.NEON_STORAGE_BUCKET ?? "uploads";
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB ?? "20");
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Types MIME autorisés pour les documents fiscaux
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

export const s3 = new S3Client({
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  region: process.env.AWS_REGION ?? "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

/**
 * Valider un fichier avant stockage
 */
export function validateFile(file: {
  mimeType: string;
  sizeBytes: number;
  filename: string;
}): { valid: boolean; error?: string } {
  // Vérifier le type MIME
  if (!ALLOWED_MIME_TYPES.includes(file.mimeType as AllowedMimeType)) {
    return {
      valid: false,
      error: `Type de fichier non accepté. Types acceptés : PDF, JPG, PNG.`,
    };
  }

  // Vérifier la taille
  if (file.sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Fichier trop volumineux. Maximum : ${MAX_FILE_SIZE_MB} MB.`,
    };
  }

  // Vérifier que le fichier n'est pas vide
  if (file.sizeBytes === 0) {
    return { valid: false, error: "Le fichier est vide." };
  }

  // Vérifier l'extension
  const ext = file.filename.split(".").pop()?.toLowerCase();
  const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "webp"];
  if (!ext || !allowedExtensions.includes(ext)) {
    return { valid: false, error: "Extension de fichier non acceptée." };
  }

  return { valid: true };
}

/**
 * Construire un chemin de stockage sécurisé et non-prévisible
 * Format: tax-documents/{userId}/{taxYearId}/{documentUuid}
 * JAMAIS le nom original, JAMAIS le NAS
 */
export function buildStorageKey(params: {
  userId: string;
  taxYearId: string;
  documentId: string;
  mimeType: string;
}): string {
  const ext = params.mimeType === "application/pdf" ? "pdf"
    : params.mimeType.startsWith("image/") ? params.mimeType.split("/")[1]
    : "bin";

  return `tax-documents/${params.userId}/${params.taxYearId}/${params.documentId}.${ext}`;
}

/**
 * Calculer le hash SHA-256 d'un buffer (détection doublons + intégrité)
 */
export function computeSHA256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Upload un document fiscal vers Neon Object Storage
 */
export async function uploadDocument(params: {
  buffer: Buffer;
  storageKey: string;
  mimeType: string;
  originalFilename: string;
}): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    const name = (error as { name?: string }).name;
    if (status === 404 || name === "NotFound" || name === "NoSuchBucket") {
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    } else {
      throw error;
    }
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: params.storageKey,
      Body: params.buffer,
      ContentType: params.mimeType,
      // Métadonnées non-sensibles uniquement
      Metadata: {
        "original-filename-safe": encodeURIComponent(params.originalFilename).slice(0, 200),
        "uploaded-at": new Date().toISOString(),
      },
    })
  );
  // Ne jamais créer une ligne SQL pointant vers une clé absente. Cette sonde
  // transforme un stockage incohérent en erreur d’upload immédiate, plutôt
  // qu’en échec OCR incompréhensible plus tard.
  await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: params.storageKey }));
}

/**
 * Générer une URL signée temporaire (15 minutes max)
 * Jamais d'URL publique permanente pour les documents fiscaux
 */
export async function getSignedDownloadUrl(
  storageKey: string,
  expiresInSeconds = 900 // 15 minutes
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: storageKey,
  });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

/**
 * Supprimer physiquement un fichier (uniquement pour suppression explicite auditée)
 */
export async function deleteFromStorage(storageKey: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
    })
  );
}

export { randomUUID, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB };
