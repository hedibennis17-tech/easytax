import type { OcrProvider, OcrDocumentResult } from "./provider";

/**
 * GoogleDocumentAiProvider
 * Actif quand OCR_PROVIDER=google et que les variables sont configurées :
 *   GOOGLE_CLOUD_PROJECT_ID
 *   GOOGLE_DOCUMENT_AI_PROCESSOR_ID
 *   GOOGLE_APPLICATION_CREDENTIALS_JSON
 *   GOOGLE_DOCUMENT_AI_LOCATION (optionnel, "us" par défaut)
 *
 * Client installé : @google-cloud/documentai
 */
export class GoogleDocumentAiProvider implements OcrProvider {
  readonly name = "google";

  private getConfig() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

    if (!projectId || !processorId || !credentialsJson) {
      throw new Error(
        "Google Document AI non configuré. Variables manquantes : " +
        "GOOGLE_CLOUD_PROJECT_ID, GOOGLE_DOCUMENT_AI_PROCESSOR_ID, GOOGLE_APPLICATION_CREDENTIALS_JSON"
      );
    }

    const location = process.env.GOOGLE_DOCUMENT_AI_LOCATION ?? "us";
    return { projectId, processorId, credentialsJson, location };
  }

  async processDocument(params: {
    buffer: Buffer;
    mimeType: string;
    documentId: string;
  }): Promise<OcrDocumentResult> {
    const start = Date.now();
    const { projectId, processorId, credentialsJson, location } = this.getConfig();

    // Chargement dynamique — évite l'erreur si le package n'est pas installé
    let DocumentProcessorServiceClient: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require("@google-cloud/documentai");
      DocumentProcessorServiceClient = module.DocumentProcessorServiceClient;
    } catch {
      throw new Error(
        "Package @google-cloud/documentai non installé. " +
        "Lancez : npm install @google-cloud/documentai"
      );
    }

    const credentials = JSON.parse(credentialsJson);
    // Les processeurs Document AI sont régionaux : us et eu utilisent leurs endpoints dédiés.
    const apiEndpoint = location === "us" || location === "eu"
      ? `${location}-documentai.googleapis.com`
      : undefined;
    const client = new DocumentProcessorServiceClient({
      credentials,
      ...(apiEndpoint ? { apiEndpoint } : {}),
    });

    const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    const [result] = await client.processDocument({
      name: processorName,
      rawDocument: {
        content: params.buffer.toString("base64"),
        mimeType: params.mimeType,
      },
    });

    const doc = result.document;
    const pages = (doc?.pages ?? []).map((page: any, i: number) => ({
      pageNumber: i + 1,
      text: extractPageText(doc?.text ?? "", page),
      confidence: Math.round((page.layout?.confidence ?? 0.9) * 100),
    }));

    const overallConfidence =
      pages.length > 0
        ? Math.round(pages.reduce((sum: number, p: any) => sum + p.confidence, 0) / pages.length)
        : 0;

    return {
      pages,
      fullText: doc?.text ?? "",
      overallConfidence,
      provider: "google",
      processingTimeMs: Date.now() - start,
    };
  }
}

function extractPageText(fullText: string, page: any): string {
  const segments = page.layout?.textAnchor?.textSegments ?? [];
  return segments
    .map((seg: any) =>
      fullText.slice(parseInt(seg.startIndex ?? "0"), parseInt(seg.endIndex ?? "0"))
    )
    .join("");
}
