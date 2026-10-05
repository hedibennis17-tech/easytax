import type { OcrDocumentResult, OcrProvider } from "./provider";

type TextAnchor = {
  textSegments?: Array<{ startIndex?: string | number | null; endIndex?: string | number | null }> | null;
};

type Layout = { textAnchor?: TextAnchor | null; confidence?: number | null };

type DocumentAiPage = {
  pageNumber?: number | null;
  layout?: Layout | null;
  lines?: Array<{ layout?: Layout | null }> | null;
  paragraphs?: Array<{ layout?: Layout | null }> | null;
  formFields?: Array<{ fieldName?: Layout | null; fieldValue?: Layout | null }> | null;
  tables?: Array<{
    headerRows?: Array<{ cells?: Array<{ layout?: Layout | null }> | null }> | null;
    bodyRows?: Array<{ cells?: Array<{ layout?: Layout | null }> | null }> | null;
  }> | null;
};

type DocumentAiDocument = {
  text?: string | null;
  pages?: DocumentAiPage[] | null;
  entities?: Array<{ type?: string | null; mentionText?: string | null; textAnchor?: TextAnchor | null }> | null;
  error?: { message?: string | null } | null;
};

function textFromAnchor(fullText: string, anchor?: TextAnchor | null): string {
  return (anchor?.textSegments ?? [])
    .map(segment => {
      const start = Number(segment.startIndex ?? 0);
      const end = Number(segment.endIndex ?? start);
      return Number.isFinite(start) && Number.isFinite(end) && end > start
        ? fullText.slice(start, end)
        : "";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return [...new Set(values.map(value => value?.replace(/\s+/g, " ").trim()).filter(Boolean) as string[])];
}

/**
 * Form Parser et les extracteurs spécialisés rendent souvent les montants dans
 * formFields / tables. Cette fonction les remet en lignes « libellé : valeur »
 * afin que l'extracteur fiscal puisse les lire, même si le texte visuel du T4
 * a été réordonné par la mise en page.
 */
export function buildDocumentAiText(document: DocumentAiDocument): {
  fullText: string;
  pageTexts: string[];
  structuredFragmentCount: number;
} {
  const rawText = String(document.text ?? "").trim();
  const structuredFragments: string[] = [];
  const pageTexts: string[] = [];

  for (const page of document.pages ?? []) {
    const pageFragments: string[] = [];

    for (const field of page.formFields ?? []) {
      const label = textFromAnchor(rawText, field.fieldName?.textAnchor);
      const value = textFromAnchor(rawText, field.fieldValue?.textAnchor);
      if (label && value) {
        const pair = `${label}: ${value}`;
        pageFragments.push(pair);
        structuredFragments.push(pair);
      }
    }

    for (const table of page.tables ?? []) {
      for (const row of [...(table.headerRows ?? []), ...(table.bodyRows ?? [])]) {
        const cells = uniqueNonEmpty((row.cells ?? []).map(cell => textFromAnchor(rawText, cell.layout?.textAnchor)));
        if (cells.length) {
          const rowText = cells.join(" | ");
          pageFragments.push(rowText);
          structuredFragments.push(rowText);
        }
      }
    }

    const layoutText = textFromAnchor(rawText, page.layout?.textAnchor);
    const lineTexts = uniqueNonEmpty((page.lines ?? []).map(line => textFromAnchor(rawText, line.layout?.textAnchor)));
    const paragraphTexts = uniqueNonEmpty((page.paragraphs ?? []).map(paragraph => textFromAnchor(rawText, paragraph.layout?.textAnchor)));
    pageTexts.push(uniqueNonEmpty([layoutText, ...pageFragments, ...lineTexts, ...paragraphTexts]).join("\n"));
  }

  for (const entity of document.entities ?? []) {
    const value = entity.mentionText?.trim() || textFromAnchor(rawText, entity.textAnchor);
    if (value) structuredFragments.push(entity.type ? `${entity.type}: ${value}` : value);
  }

  return {
    fullText: uniqueNonEmpty([rawText, ...structuredFragments, ...pageTexts]).join("\n"),
    pageTexts,
    structuredFragmentCount: uniqueNonEmpty(structuredFragments).length,
  };
}

/** Google Document AI : OCR, Form Parser et Custom Extractor. */
export class GoogleDocumentAiProvider implements OcrProvider {
  readonly name = "google";

  private getConfig() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!projectId || !processorId || !credentialsJson) {
      throw new Error(
        "Google Document AI non configuré. Variables manquantes : " +
        "GOOGLE_CLOUD_PROJECT_ID, GOOGLE_DOCUMENT_AI_PROCESSOR_ID, GOOGLE_APPLICATION_CREDENTIALS_JSON",
      );
    }
    return { projectId, processorId, credentialsJson, location: process.env.GOOGLE_DOCUMENT_AI_LOCATION ?? "us" };
  }

  async processDocument(params: { buffer: Buffer; mimeType: string; documentId: string }): Promise<OcrDocumentResult> {
    const start = Date.now();
    const { projectId, processorId, credentialsJson, location } = this.getConfig();

    let DocumentProcessorServiceClient: new (options: Record<string, unknown>) => {
      processDocument: (request: Record<string, unknown>) => Promise<Array<{ document?: DocumentAiDocument }>>;
    };
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      DocumentProcessorServiceClient = require("@google-cloud/documentai").DocumentProcessorServiceClient;
    } catch {
      throw new Error("Package @google-cloud/documentai non installé sur le serveur.");
    }

    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(credentialsJson) as Record<string, unknown>;
    } catch {
      throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON n’est pas un JSON valide.");
    }

    const apiEndpoint = location === "us" || location === "eu" ? `${location}-documentai.googleapis.com` : undefined;
    const client = new DocumentProcessorServiceClient({ credentials, ...(apiEndpoint ? { apiEndpoint } : {}) });
    const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    const [result] = await client.processDocument({
      name: processorName,
      rawDocument: { content: params.buffer.toString("base64"), mimeType: params.mimeType },
      skipHumanReview: true,
    });

    const document = result.document;
    if (!document) throw new Error("Google Document AI a répondu sans document analysable.");
    if (document.error?.message) throw new Error(`Google Document AI : ${document.error.message}`);

    const { fullText, pageTexts, structuredFragmentCount } = buildDocumentAiText(document);
    if (!fullText.trim()) {
      throw new Error(
        "Google Document AI n’a retourné aucun texte lisible. Vérifiez que le processeur est un OCR, Form Parser ou Custom Extractor et que le fichier est lisible.",
      );
    }

    const pages = (document.pages ?? []).map((page, index) => ({
      pageNumber: page.pageNumber ?? index + 1,
      text: pageTexts[index] || fullText,
      confidence: Math.round(Math.max(0, Math.min(1, page.layout?.confidence ?? 0.9)) * 100),
    }));
    if (!pages.length) pages.push({ pageNumber: 1, text: fullText, confidence: 90 });

    console.info("[ocr/google] Document AI parsed", {
      documentId: params.documentId,
      pageCount: pages.length,
      textLength: fullText.length,
      structuredFragmentCount,
    });

    return {
      pages,
      fullText,
      overallConfidence: Math.round(pages.reduce((sum, page) => sum + page.confidence, 0) / pages.length),
      provider: "google",
      processingTimeMs: Date.now() - start,
    };
  }
}
