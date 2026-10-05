import {
  CATALOG_DOCUMENT_TYPES,
  classifyTaxDocument,
  guardSelectedDocumentType,
} from "../src/lib/document-intelligence/catalog";
import { extractVisibleUnknownFields } from "../src/lib/extractors/generic";

const fixtures = [
  ["T4", "T4 Statement of Remuneration Paid 2025", "T4"],
  ["T4A", "T4A Statement of Pension, Retirement, Annuity, and Other Income 2025", "T4A"],
  ["T5", "T5 Statement of Investment Income 2025", "T5"],
  ["T2202", "T2202 Tuition and Enrolment Certificate 2025", "T2202"],
  ["RL-1", "RL-1 Revenus d'emploi et revenus divers 2025", "RL-1"],
] as const;

if (CATALOG_DOCUMENT_TYPES.length !== 48) {
  throw new Error(`Catalogue incomplet : ${CATALOG_DOCUMENT_TYPES.length}/48 classes`);
}

for (const document of CATALOG_DOCUMENT_TYPES) {
  const classification = classifyTaxDocument(`${document.code} ${document.name} 2025`);
  if (classification.documentTypeCode !== document.code || classification.state !== "confirmed") {
    throw new Error(`Classe catalogue invalide pour ${document.code}: ${JSON.stringify(classification)}`);
  }
}

for (const [expected, text, selected] of fixtures) {
  const classification = classifyTaxDocument(text);
  if (classification.documentTypeCode !== expected || classification.state !== "confirmed") {
    throw new Error(`Classification ${expected} invalide : ${JSON.stringify(classification)}`);
  }
  const guard = guardSelectedDocumentType(selected, classification);
  if (!guard.accepted) throw new Error(`Type ${expected} rejeté à tort : ${guard.reason}`);
}

const t5 = classifyTaxDocument("T5 Statement of Investment Income 2025");
const contradiction = guardSelectedDocumentType("T4", t5);
if (contradiction.accepted || contradiction.action !== "REJECT") {
  throw new Error("Une contradiction T4/T5 doit être rejetée.");
}

const unknown = classifyTaxDocument("Facture de téléphone octobre 2025");
if (guardSelectedDocumentType("T4", unknown).accepted) {
  throw new Error("Un document non fiscal ne doit pas être accepté dans un slot T4.");
}

const generic = extractVisibleUnknownFields("T5 Statement of Investment Income\nBox 13 Interest from Canadian sources 1,234.56");
if (generic.fields.length !== 1 || generic.fields[0]?.fieldCode !== "visible_box_13") {
  throw new Error(`Les cases visibles inconnues doivent être conservées: ${JSON.stringify(generic.fields)}`);
}

console.log("Document intelligence tests passed: 48 classes, 5 types prouvés, contradictions rejetées, cases inconnues préservées.");
