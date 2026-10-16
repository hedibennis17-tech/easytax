import type { OcrProvider, OcrDocumentResult } from "./provider";
import { PDFDocument } from "pdf-lib";

/**
 * OcrSpaceProvider
 * Actif quand OCR_PROVIDER=ocrspace
 *
 * Variables requises:
 *   OCRSPACE_API_KEY  — clé API OCR.space (gratuite ou PRO)
 *
 * Doc: https://ocr.space/ocrapi
 *
 * Moteur utilisé : Engine 3 (le plus précis, 200+ langues, tableaux, cases)
 * Fallback auto  : Engine 2 si Engine 3 échoue
 *
 * Le texte extrait est retourné en texte brut (ParsedText).
 * isTable=true active la reconnaissance de tableaux (Markdown en Engine 3).
 */

const OCR_ENDPOINT = "https://api.ocr.space/parse/image";

/**
 * Supprime le préfixe garbage qu'ajoutent certains serveurs/proxies
 * (protection CSRF/JSON hijacking: ")]}',\n" ou similaire)
 * avant les magic bytes réels du fichier (%PDF, \xFF\xD8 JPEG, \x89PNG…)
 */
function stripFilePreamble(buf: Buffer): Buffer {
  // PDF: commence par %PDF
  const pdfOffset = buf.indexOf(Buffer.from("%PDF"));
  if (pdfOffset > 0 && pdfOffset < 16) return buf.slice(pdfOffset);
  // JPEG: magic bytes FF D8
  const jpegOffset = buf.indexOf(Buffer.from([0xFF, 0xD8]));
  if (jpegOffset > 0 && jpegOffset < 16) return buf.slice(jpegOffset);
  // PNG: magic bytes 89 50 4E 47
  const pngOffset = buf.indexOf(Buffer.from([0x89, 0x50, 0x4E, 0x47]));
  if (pngOffset > 0 && pngOffset < 16) return buf.slice(pngOffset);
  return buf; // rien à stripper
}

export class OcrSpaceProvider implements OcrProvider {
  readonly name = "ocrspace";

  private getApiKey(): string {
    const key = process.env.OCRSPACE_API_KEY;
    if (!key) {
      throw new Error(
        "OcrSpaceProvider: variable manquante → OCRSPACE_API_KEY"
      );
    }
    return key;
  }

  async processDocument(params: {
    buffer: Buffer;
    mimeType: string;
    documentId: string;
  }): Promise<OcrDocumentResult> {
    const start = Date.now();
    const apiKey = this.getApiKey();

    // Strip CSRF/JSON-hijacking prefix (e.g. ")]}'," added by some servers)
    // before encoding — OCR.space rejects files that don't start with %PDF / image magic bytes
    const cleanBuffer = stripFilePreamble(params.buffer);

    // Pour les PDF multi-pages: extraire seulement la page 1
    // La page 2 des feuillets fiscaux contient les instructions (pleine de chiffres
    // de référence qui contaminent l'extraction des cases)
    let finalBuffer = cleanBuffer;
    if (params.mimeType === "application/pdf") {
      try {
        const srcPdf = await PDFDocument.load(cleanBuffer);
        if (srcPdf.getPageCount() > 1) {
          const p1Pdf = await PDFDocument.create();
          const [page1] = await p1Pdf.copyPages(srcPdf, [0]);
          p1Pdf.addPage(page1);
          const p1Bytes = await p1Pdf.save();
          finalBuffer = Buffer.from(p1Bytes);
        }
      } catch {
        // Si extraction page 1 échoue, utiliser le PDF complet
      }
    }

    // Encode le document en base64 avec data URI
    const base64 = finalBuffer.toString("base64");
    const base64Image = `data:${params.mimeType};base64,${base64}`;

    const text = await this.callOcrSpace(apiKey, base64Image, 3);

    const pages = [{
      pageNumber: 1,
      text,
      confidence: text.trim().length > 0 ? 85 : 0,
    }];

    const fullText = text;
    const overallConfidence = pages[0].confidence;

    return {
      pages,
      fullText,
      overallConfidence,
      provider: "ocrspace",
      processingTimeMs: Date.now() - start,
    };
  }

  /**
   * Appelle l'API OCR.space avec le moteur spécifié.
   * Retourne le texte extrait (ParsedText de toutes les pages concaténées).
   */
  private async callOcrSpace(
    apiKey: string,
    base64Image: string,
    engine: 2 | 3
  ): Promise<string> {
    const formData = new FormData();
    formData.append("base64Image", base64Image);
    formData.append("language", "auto");
    formData.append("OCREngine", String(engine));
    // isTable=true réorganise le texte en colonnes et brise le format séquentiel
    // des feuillets fiscaux (RL-1, T4...). On le désactive pour préserver
    // l'ordre CODE → LIBELLÉ → MONTANT ligne par ligne.
    formData.append("isTable", "false");
    formData.append("detectOrientation", "true");
    formData.append("scale", "true");
    formData.append("isOverlayRequired", "false");

    let response: Response;
    try {
      response = await fetch(OCR_ENDPOINT, {
        method: "POST",
        headers: {
          apikey: apiKey,
        },
        body: formData,
      });
    } catch (err) {
      throw new Error(
        `OCR.space réseau: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // Si Engine 3 échoue (quota dépassé), on tente Engine 2
      if (engine === 3 && (response.status === 429 || response.status === 403)) {
        console.warn("[ocrspace] Engine 3 quota dépassé, fallback Engine 2");
        return this.callOcrSpace(apiKey, base64Image, 2);
      }
      throw new Error(
        `OCR.space HTTP ${response.status}: ${body.slice(0, 200)}`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any;
    try {
      json = await response.json();
    } catch {
      throw new Error("OCR.space: réponse JSON invalide");
    }

    // OCRExitCode: 1=succès, 2=partiel, 3=échec, 4=erreur fatale
    if (json.IsErroredOnProcessing) {
      const errMsg = json.ErrorMessage ?? json.ErrorDetails ?? "Erreur OCR.space inconnue";
      // Fallback Engine 2 si Engine 3 échoue sur le traitement
      if (engine === 3) {
        console.warn(`[ocrspace] Engine 3 erreur (${errMsg}), fallback Engine 2`);
        return this.callOcrSpace(apiKey, base64Image, 2);
      }
      throw new Error(`OCR.space erreur: ${errMsg}`);
    }

    // Concaténer le texte de toutes les pages
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsedResults: any[] = json.ParsedResults ?? [];
    if (parsedResults.length === 0) {
      return "";
    }

    const allText = parsedResults
      .map((r: { ParsedText?: string }) => r.ParsedText ?? "")
      .join("\n\n")
      .trim();

    return allText;
  }
}
