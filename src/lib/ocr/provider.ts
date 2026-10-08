/**
 * Interface abstraite OcrProvider
 * Permet de switcher entre Mistral OCR, mock, etc.
 * sans modifier le reste de l'application.
 *
 * Provider actif : contrôlé par la variable d'env OCR_PROVIDER
 *   "mistral" (défaut en production) → MistralOcrProvider
 *   "mock"                           → MockOcrProvider (dev uniquement)
 */

export interface OcrPageResult {
  pageNumber: number;
  text: string;       // texte brut / Markdown extrait
  confidence: number; // 0-100
  error?: string;
}

export interface OcrDocumentResult {
  pages: OcrPageResult[];
  fullText: string;          // texte concaténé de toutes les pages
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
 * Par défaut en production : mistral
 * Par défaut en dev        : mock (si pas de clé configurée)
 */
export async function getOcrProvider(): Promise<OcrProvider> {
  const providerName = process.env.OCR_PROVIDER ?? "mistral";

  if (providerName === "mistral") {
    const { MistralOcrProvider } = await import("./mistral-ocr");
    return new MistralOcrProvider();
  }

  if (process.env.NODE_ENV === "production" && process.env.OCR_ALLOW_MOCK !== "true") {
    throw new Error(
      "L'analyse OCR réelle n'est pas configurée. Configurez Mistral OCR (MISTRAL_API_KEY) avant de traiter des documents fiscaux."
    );
  }

  // Mock autorisé uniquement en développement ou lors d'un test explicitement activé.
  const { MockOcrProvider } = await import("./mock-provider");
  return new MockOcrProvider();
}
