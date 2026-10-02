/**
 * Interface abstraite OcrProvider
 * Permet de switcher entre Google Document AI, mock, Tesseract, etc.
 * sans modifier le reste de l'application.
 */

export interface OcrPageResult {
  pageNumber: number;
  text: string;           // texte brut extrait
  confidence: number;     // 0-100
  error?: string;
}

export interface OcrDocumentResult {
  pages: OcrPageResult[];
  fullText: string;       // texte concaténé de toutes les pages
  overallConfidence: number;
  provider: string;
  processingTimeMs: number;
  error?: string;
}

export interface OcrProvider {
  readonly name: string;
  processDocument(params: {
    buffer: Buffer;
    mimeType: string;
    documentId: string;
  }): Promise<OcrDocumentResult>;
}

/**
 * Retourne le provider actif selon la variable d'env OCR_PROVIDER
 * Par défaut : mock (si pas de credentials configurés)
 */
export async function getOcrProvider(): Promise<OcrProvider> {
  const providerName = process.env.OCR_PROVIDER ?? "mock";

  if (providerName === "google") {
    const { GoogleDocumentAiProvider } = await import("./google-document-ai");
    return new GoogleDocumentAiProvider();
  }

  // Défaut — mock pour dev/test sans credentials
  const { MockOcrProvider } = await import("./mock-provider");
  return new MockOcrProvider();
}
