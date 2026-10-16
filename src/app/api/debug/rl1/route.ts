/**
 * GET /api/debug/rl1
 *
 * Diagnostic RL-1 : montre exactement ce que OCR.space retourne et
 * ce que le parser extrait case par case.
 *
 * Réponse JSON :
 *   ocr_brut        → texte OCR complet reçu de OCR.space
 *   lignes          → toutes les lignes numérotées (pour voir la structure)
 *   table_parsee    → résultat de parseRL1OcrTable() : code → valeur
 *   boxes_extraites → résultat de extractAllBoxes() pour chaque case RL-1
 *   cases_attendues → A, B.A, B.B, C, D, E, G, H, I avec valeur + statut
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { fiscalDocuments, documentPages, documentExtractions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { extractAllBoxes } from "@/lib/ocr/dictionnaire";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Paramètre optionnel ?docId=xxx pour cibler un document précis
  const docId = req.nextUrl.searchParams.get("docId");

  // Charger le dernier document RL-1 de l'utilisateur (ou celui demandé)
  const docsQuery = db.select({
    id: fiscalDocuments.id,
    nom: fiscalDocuments.originalFilename,
    status: fiscalDocuments.status,
    uploadedAt: fiscalDocuments.uploadedAt,
  })
    .from(fiscalDocuments)
    .where(eq(fiscalDocuments.userId, userId))
    .orderBy(desc(fiscalDocuments.uploadedAt));

  const allDocs = await docsQuery;

  // Trouver le doc RL-1 (ou celui demandé)
  let targetDoc = docId
    ? allDocs.find(d => d.id === docId)
    : allDocs[0]; // le plus récent par défaut

  if (!targetDoc) {
    return NextResponse.json({
      error: "Aucun document trouvé",
      docs_disponibles: allDocs.map(d => ({ id: d.id, nom: d.nom, uploadé: d.uploadedAt })),
    }, { status: 404 });
  }

  // Texte OCR brut
  const [page] = await db.select({ ocrText: documentPages.ocrText })
    .from(documentPages)
    .where(eq(documentPages.documentId, targetDoc.id))
    .orderBy(documentPages.pageNumber)
    .limit(1);

  const ocrBrut = page?.ocrText ?? null;

  // Extraction enregistrée
  const [extraction] = await db.select({
    classificationReason: documentExtractions.classificationReason,
    detectedTaxYear: documentExtractions.detectedTaxYear,
    status: documentExtractions.status,
    errorMessage: documentExtractions.errorMessage,
  })
    .from(documentExtractions)
    .where(eq(documentExtractions.fiscalDocumentId, targetDoc.id))
    .limit(1);

  if (!ocrBrut) {
    return NextResponse.json({
      document: { id: targetDoc.id, nom: targetDoc.nom },
      error: "Pas de texte OCR en base pour ce document",
      extraction,
      docs_disponibles: allDocs.map(d => ({ id: d.id, nom: d.nom, uploadé: d.uploadedAt })),
    }, { status: 200 });
  }

  // Découper en lignes numérotées
  const lignes = ocrBrut.split(/\r?\n/).map((l, i) => `${String(i + 1).padStart(3, "0")} | ${l}`);

  // Parser la table RL-1 (même logique que dans extractAllBoxes)
  const RL1_CODES = [
    "B.A", "B.B", "G-1", "G-2", "G-3",
    "A-1","A-2","A-3","A-4","A-5","A-6","A-7","A-9","A-10","A-11","A-12","A-13","A-14",
    "B-1","B-2","D-1","D-2","D-3","K-1",
    "L-2","L-3","L-4","L-7","L-8","L-9","L-10",
    "R-1","V-1","235",
    "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","V","W",
  ];

  function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function asMoney(raw: string | undefined): string | null {
    const v = (raw ?? "").trim();
    const n = parseFloat(v.replace(/[\s ]/g, "").replace(",", "."));
    return isNaN(n) ? null : v;
  }

  const codeRe = new RegExp(
    `^(${RL1_CODES.map(escapeRegex).join("|")})\\s*[-–—]\\s*(.{0,120})$`
  );
  const moneyLineRe = /^([0-9]{1,3}(?:[\s ][0-9]{3})*[.,][0-9]{2})$/;

  const tableParsee: Record<string, string> = {};
  const parsingSteps: string[] = [];
  let pendingCode: string | null = null;

  for (const raw of ocrBrut.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const codeMatch = line.match(codeRe);
    if (codeMatch) {
      const foundCode = codeMatch[1];
      const rest = codeMatch[2].trim();
      const inlineMatch = rest.match(/\s+([0-9]{1,3}(?:[\s ][0-9]{3})*[.,][0-9]{2})$/);
      if (inlineMatch) {
        const val = asMoney(inlineMatch[1]);
        if (val) {
          tableParsee[foundCode] = val;
          parsingSteps.push(`[INLINE] ${foundCode} = "${val}" (depuis: "${line}")`);
        }
        pendingCode = null;
      } else {
        parsingSteps.push(`[ATTENTE] ${foundCode} — prochaine ligne attendue comme montant`);
        pendingCode = foundCode;
      }
      continue;
    }

    if (pendingCode !== null) {
      const moneyMatch = line.match(moneyLineRe);
      if (moneyMatch) {
        const val = asMoney(moneyMatch[1]);
        if (val) {
          tableParsee[pendingCode] = val;
          parsingSteps.push(`[MONTANT] ${pendingCode} = "${val}" (ligne: "${line}")`);
        }
        pendingCode = null;
      } else if (line.length > 30 || /[a-zA-ZÀ-ÿ]{4,}/.test(line)) {
        parsingSteps.push(`[ANNULÉ] attente pour ${pendingCode} — ligne non-montant: "${line.slice(0, 60)}"`);
        pendingCode = null;
      } else {
        parsingSteps.push(`[IGNORÉ] ligne courte ignorée pendant attente de ${pendingCode}: "${line}"`);
      }
    }
  }

  // extractAllBoxes() complet
  const isRL1 = /RL-?1\b|Relevé\s+1/i.test(ocrBrut.slice(0, 1200));
  let boxesExtraites: object[] = [];
  try {
    const typeDetecte = extraction?.classificationReason?.match(/\b(RL-?1|RL1)\b/i) ? "RL-1" : "RL-1";
    const boxes = extractAllBoxes(ocrBrut, typeDetecte);
    boxesExtraites = boxes
      .filter(b => b.rawValue !== null || ["A","B.A","B.B","C","D","E","G","H","I"].includes(b.code))
      .map(b => ({
        code: b.code,
        label: b.label_fr,
        valeur_brute: b.rawValue,
        montant_cents: b.amountCents,
        montant_affiche: b.amountCents !== null
          ? (b.amountCents / 100).toFixed(2) + " $"
          : null,
        confiance: b.confidence,
      }));
  } catch (e) {
    boxesExtraites = [{ erreur: String(e) }];
  }

  // Cases clés attendues pour ce RL-1
  const CAS_ATTENDUS = ["A", "B.A", "B.B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const casesAttendues = CAS_ATTENDUS.map(code => ({
    code,
    dans_table: tableParsee[code] ?? null,
    dans_extractAllBoxes: boxesExtraites.find((b: any) => b.code === code) ?? null,
    statut: tableParsee[code]
      ? "✅ trouvé"
      : "❌ absent",
  }));

  return NextResponse.json({
    document: {
      id: targetDoc.id,
      nom: targetDoc.nom,
      uploadé: targetDoc.uploadedAt,
      status: targetDoc.status,
    },
    extraction_bd: extraction ?? null,
    is_rl1_détecté: isRL1,

    // Le texte brut complet — C'EST CE QU'ON VEUT VOIR
    ocr_brut_complet: ocrBrut,
    ocr_lignes_numérotées: lignes,
    ocr_longueur: ocrBrut.length,

    // Résultat du parser séquentiel
    table_parsee: tableParsee,
    nb_cases_trouvées: Object.keys(tableParsee).length,
    parsing_steps: parsingSteps,

    // Cases clés RL-1
    cases_attendues: casesAttendues,

    // extractAllBoxes complet
    boxes_extraites: boxesExtraites,

    // Autres docs disponibles
    autres_docs: allDocs
      .filter(d => d.id !== targetDoc!.id)
      .map(d => ({ id: d.id, nom: d.nom, url: `/api/debug/rl1?docId=${d.id}` })),
  }, { status: 200 });
}
