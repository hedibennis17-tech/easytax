import type { OcrProvider, OcrDocumentResult } from "./provider";

/**
 * GoogleDocumentAiProvider
 * Actif quand OCR_PROVIDER=google
 *
 * Variables requises:
 *   GOOGLE_CLOUD_PROJECT_ID
 *   GOOGLE_DOCUMENT_AI_PROCESSOR_ID
 *   GOOGLE_APPLICATION_CREDENTIALS_JSON
 *   GOOGLE_DOCUMENT_AI_LOCATION (optionnel, défaut: "us")
 *
 * CORRECTION CRITIQUE:
 * Google Document AI Form Parser retourne les données dans TROIS endroits:
 *   1. doc.text               → texte brut complet (utilisé pour classification)
 *   2. doc.entities[]         → champs nommés (OCR intelligent)
 *   3. doc.pages[].formFields → paires clé/valeur de formulaire
 *
 * Le code précédent ne lisait que doc.text → 0 champs extraits.
 * Ce code lit les trois sources et les fusionne dans fullText ET dans structuredFields.
 */

export interface GoogleStructuredField {
  name: string;       // ex: "box_14", "Box 14", "Employment income"
  value: string;      // ex: "52000.00"
  confidence: number; // 0-100
  pageNumber: number;
}

export interface OcrDocumentResultExtended extends OcrDocumentResult {
  structuredFields?: GoogleStructuredField[];
  entities?: GoogleStructuredField[];
}

export class GoogleDocumentAiProvider implements OcrProvider {
  readonly name = "google";

  private getConfig() {
    const projectId  = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const processorId= process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
    const credJson   = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const location   = process.env.GOOGLE_DOCUMENT_AI_LOCATION ?? "us";

    if (!projectId || !processorId || !credJson) {
      throw new Error(
        "Google Document AI: variables manquantes → " +
        "GOOGLE_CLOUD_PROJECT_ID, GOOGLE_DOCUMENT_AI_PROCESSOR_ID, GOOGLE_APPLICATION_CREDENTIALS_JSON"
      );
    }
    return { projectId, processorId, credJson, location };
  }

  async processDocument(params: {
    buffer: Buffer;
    mimeType: string;
    documentId: string;
  }): Promise<OcrDocumentResultExtended> {
    const start = Date.now();
    const { projectId, processorId, credJson, location } = this.getConfig();

    // Chargement dynamique du SDK Google
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let DocumentProcessorServiceClient: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("@google-cloud/documentai");
      DocumentProcessorServiceClient = mod.DocumentProcessorServiceClient
        ?? mod.v1?.DocumentProcessorServiceClient
        ?? mod.default?.DocumentProcessorServiceClient;
      if (!DocumentProcessorServiceClient) throw new Error("Client non trouvé dans le module");
    } catch {
      throw new Error(
        "Package @google-cloud/documentai absent. Lancez: npm install @google-cloud/documentai"
      );
    }

    const credentials = JSON.parse(credJson);
    const client = new DocumentProcessorServiceClient({
      credentials,
      apiEndpoint: `${location}-documentai.googleapis.com`,
    });

    const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    const [result] = await client.processDocument({
      name: processorName,
      rawDocument: {
        content: params.buffer.toString("base64"),
        mimeType: params.mimeType,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = result?.document as any;
    if (!doc) throw new Error("Google Document AI: réponse vide");

    const fullText: string = doc.text ?? "";

    // ── 1. Pages + texte brut ──────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pages = ((doc.pages ?? []) as any[]).map((page: any, i: number) => ({
      pageNumber: i + 1,
      text: extractPageText(fullText, page),
      confidence: Math.round((page.layout?.confidence ?? 0.85) * 100),
    }));

    const overallConfidence =
      pages.length > 0
        ? Math.round(pages.reduce((s: number, p: { confidence: number }) => s + p.confidence, 0) / pages.length)
        : 0;

    // ── 2. Entities (Form Parser / Specialized) ─────────────────────────────
    // ex: { type: "box_14", mentionText: "52,000.00", confidence: 0.98 }
    const structuredFields: GoogleStructuredField[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const entity of (doc.entities ?? []) as any[]) {
      const name  = entity.type ?? entity.mention ?? "";
      const value = entity.mentionText ?? entity.normalizedValue?.text ?? "";
      const conf  = Math.round((entity.confidence ?? 0.85) * 100);
      const pageN = entity.pageAnchor?.pageRefs?.[0]?.page ? parseInt(entity.pageAnchor.pageRefs[0].page) + 1 : 1;
      if (name && value) {
        structuredFields.push({ name: name.trim(), value: value.trim(), confidence: conf, pageNumber: pageN });
      }
    }

    // ── 3. FormFields (paires clé/valeur) ───────────────────────────────────
    // ex: fieldName.textContent="Box 14", fieldValue.textContent="52,000.00"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const page of (doc.pages ?? []) as any[]) {
      const pageN = (page.pageNumber ?? 1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const ff of (page.formFields ?? []) as any[]) {
        const name  = extractText(fullText, ff.fieldName)?.trim()  ?? "";
        const value = extractText(fullText, ff.fieldValue)?.trim() ?? "";
        const conf  = Math.round((ff.fieldValue?.confidence ?? ff.fieldName?.confidence ?? 0.8) * 100);
        if (name && value) {
          structuredFields.push({ name, value, confidence: conf, pageNumber: pageN });
        }
      }

      // ── 4. Tables (certains T4 sont en tableau) ─────────────────────────
      type TableCell = { layout?: unknown; cells?: TableCell[] };
      type TableRow  = { cells?: TableCell[] };
      type DocTable  = { headerRows?: TableRow[]; bodyRows?: TableRow[] };
      for (const table of (page.tables ?? []) as DocTable[]) {
        for (const row of [...(table.headerRows ?? []), ...(table.bodyRows ?? [])] as TableRow[]) {
          const cells = (row.cells ?? []) as TableCell[];
          if (cells.length >= 2) {
            const name  = extractText(fullText, cells[0].layout)?.trim() ?? "";
            const value = extractText(fullText, cells[1].layout)?.trim() ?? "";
            if (name && value) {
              structuredFields.push({ name, value, confidence: 75, pageNumber: pageN });
            }
          }
        }
      }

      // ── 5. Tokens (chiffres isolés) ─────────────────────────────────────
      // Pour les T4 où les montants sont des tokens sans libellé associé,
      // on les injecte dans le texte brut pour que l'extracteur regex puisse les lire.
    }

    // ── Construire un fullText enrichi ──────────────────────────────────────
    // On ajoute les champs structurés au texte brut sous forme "clé: valeur"
    // pour que l'extracteur regex existant puisse les matcher
    let enrichedText = fullText;
    if (structuredFields.length > 0) {
      enrichedText += "\n\n--- STRUCTURED FIELDS ---\n";
      for (const f of structuredFields) {
        enrichedText += `${f.name}: ${f.value}\n`;
      }
    }

    return {
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: fullText, confidence: overallConfidence }],
      fullText: enrichedText,
      overallConfidence,
      provider: "google",
      processingTimeMs: Date.now() - start,
      structuredFields,
      entities: structuredFields,
    };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPageText(fullText: string, page: any): string {
  const segments = page.layout?.textAnchor?.textSegments ?? [];
  if (segments.length === 0) return "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (segments as any[])
    .map((seg: { startIndex?: string; endIndex?: string }) =>
      fullText.slice(parseInt(seg.startIndex ?? "0"), parseInt(seg.endIndex ?? "0"))
    )
    .join("");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(fullText: string, layout: any): string {
  if (!layout) return "";
  const segments = layout.textAnchor?.textSegments ?? [];
  if (segments.length === 0) return "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (segments as any[])
    .map((seg: { startIndex?: string; endIndex?: string }) =>
      fullText.slice(parseInt(seg.startIndex ?? "0"), parseInt(seg.endIndex ?? "0"))
    )
    .join("");
}
