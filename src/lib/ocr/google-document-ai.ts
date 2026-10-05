import type { OcrDocumentResult, OcrProvider } from "./provider";

type TextAnchor = {
  textSegments?: Array<{ startIndex?: string | number | null; endIndex?: string | number | null }> | null;
};

type Vertex = { x?: number | null; y?: number | null };
type BoundingPoly = { normalizedVertices?: Vertex[] | null };
type Layout = { textAnchor?: TextAnchor | null; confidence?: number | null; boundingPoly?: BoundingPoly | null };
type DocumentAiToken = { layout?: Layout | null };

type DocumentAiPage = {
  pageNumber?: number | null;
  layout?: Layout | null;
  tokens?: DocumentAiToken[] | null;
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

type SpatialToken = { text: string; x: number; y: number; width: number; height: number };

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

function bounds(layout?: Layout | null) {
  const vertices = layout?.boundingPoly?.normalizedVertices ?? [];
  const xs = vertices.map(vertex => Number(vertex.x)).filter(Number.isFinite);
  const ys = vertices.map(vertex => Number(vertex.y)).filter(Number.isFinite);
  if (!xs.length || !ys.length) return null;
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/**
 * Reconstitue les lignes dans leur ordre visuel à partir de la géométrie du
 * processeur Google. Le texte brut Document AI peut séparer un libellé, ses
 * dollars et ses cents; ces lignes sont une seconde preuve pour les extracteurs.
 */
export function buildSpatialLines(fullText: string, page?: DocumentAiPage | null): string[] {
  const tokens: SpatialToken[] = (page?.tokens ?? [])
    .map(token => {
      const text = textFromAnchor(fullText, token.layout?.textAnchor);
      const box = bounds(token.layout);
      return text && box ? { text, ...box } : null;
    })
    .filter((token): token is SpatialToken => Boolean(token));

  if (!tokens.length) return [];

  const rows: SpatialToken[][] = [];
  for (const token of [...tokens].sort((left, right) => left.y - right.y || left.x - right.x)) {
    const midpoint = token.y + token.height / 2;
    const row = rows.find(candidate => {
      const values = candidate.map(item => item.y + item.height / 2);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      const tolerance = Math.max(0.012, token.height * 0.85);
      return Math.abs(midpoint - average) <= tolerance;
    });
    if (row) row.push(token);
    else rows.push([token]);
  }

  return rows
    .sort((left, right) => Math.min(...left.map(item => item.y)) - Math.min(...right.map(item => item.y)))
    .map(row => row.sort((left, right) => left.x - right.x).map(token => token.text).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const MONEY = /\(?-?\$?\s*\d{1,3}(?:[\s,\u00a0]\d{3})*(?:[.,]\d{2}|\s+\d{2})\)?|\(?-?\$?\s*\d+[.,]\d{2}\)?/g;

function normalizeMoney(value: string) {
  const compact = value.replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ");
  const splitCents = compact.match(/^([0-9]{1,3}(?:[, ]\d{3})+)\s+(\d{2})$/);
  if (splitCents) return `${splitCents[1].replace(/[, ]/g, "")}.${splitCents[2]}`;
  return compact.replace(/\s+/g, "");
}

/**
 * Conserve les associations explicites « case → montant » trouvées sur une
 * ligne visuelle. Elles sont des candidats OCR, jamais une validation fiscale.
 * Les extracteurs de chaque feuillet gardent la responsabilité de vérifier le
 * numéro de case, le libellé et le mapping avant toute injection.
 */
export function buildSpatialBoxCandidates(spatialLines: string[]): string[] {
  const candidates: string[] = [];
  for (let index = 0; index < spatialLines.length; index += 1) {
    const line = spatialLines[index];
    const boxMatch = line.match(/\b(?:box|case|case)\s*[-—:]?\s*([A-Z]{1,3}|0?\d{1,3})\b/i);
    if (!boxMatch) continue;
    const boxCode = boxMatch[1].toUpperCase();
    const nearby = [line, spatialLines[index + 1] ?? ""].join(" ");
    const values = [...nearby.matchAll(MONEY)].map(match => normalizeMoney(match[0]));
    // Le numéro de case seul n’est jamais un montant. Les montants doivent avoir
    // un séparateur décimal ou être imprimés dollars + cents.
    for (const value of values) {
      if (/\d[.,]\d{2}$/.test(value) || /^\d{1,3}\d{3}\.\d{2}$/.test(value)) {
        candidates.push(`[EASYTAX_BOX code=${boxCode} value=${value}]`);
      }
    }
  }
  return [...new Set(candidates)];
}

/**
 * Form Parser et les extracteurs spécialisés rendent souvent les montants dans
 * formFields / tables. Les lignes spatiales sont ajoutées afin qu’un libellé et
 * un montant qui ont été séparés dans le texte brut restent disponibles à
 * l’extracteur du bon feuillet.
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
    const spatialLines = buildSpatialLines(rawText, page);
    const spatialBoxes = buildSpatialBoxCandidates(spatialLines);
    structuredFragments.push(...spatialBoxes);
    pageTexts.push(uniqueNonEmpty([layoutText, ...pageFragments, ...lineTexts, ...paragraphTexts, ...spatialLines, ...spatialBoxes]).join("\n"));
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

/** Google Document AI : lecture OCR et géométrie; EasyTax décide le sens fiscal. */
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
