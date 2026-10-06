import assert from "node:assert/strict";
import { extractAllBoxes, getSlipDict, parseMontantOCR, SLIP_DICT } from "../src/lib/ocr/dictionnaire";
import { SUPPLIED_OCR_DICTIONARY_VERSION } from "../src/lib/ocr/enriched-dictionary";

const t5007Sample = `
T5007
STATEMENT OF BENEFITS / ÉTAT DES PRESTATIONS
Year 2025  10 Workers' compensation benefits  7 201,32  12 Social insurance number 314 003 062  13 Report code 0
Indemnités pour accidents du travail
`;

const t5007 = getSlipDict("T5007");
assert.ok(t5007, "Le dictionnaire actif doit contenir T5007");
const box10 = t5007.boxes.find(box => box.code === "10") as (typeof t5007.boxes)[number] & { fieldId?: string };
assert.equal(box10.fieldId, "CA.FED.T5007.10", "Le champ enrichi T5007 doit être relié au dictionnaire fourni");

const extracted = extractAllBoxes(t5007Sample, "T5007");
const amount = extracted.find(box => box.code === "10");
assert.equal(amount?.rawValue, "7 201,32", "La case 10 T5007 doit extraire le montant imprimé");
assert.equal(amount?.amountCents, 720132, "La case 10 T5007 doit préserver les milliers et les cents");
assert.equal(amount?.t1_line, "14400");
assert.equal(amount?.autoDeductionLine, "25000");
assert.equal(parseMontantOCR("7 201 32"), 720132, "Les cents séparés doivent être normalisés");
assert.equal(SLIP_DICT.length, 28, "Les 28 feuillets du dictionnaire actif doivent rester disponibles");
assert.ok(SUPPLIED_OCR_DICTIONARY_VERSION.length > 0, "La version du dictionnaire fourni doit être active");

console.log("✓ Dictionnaire enrichi chargé : 28 feuillets");
console.log("✓ T5007 case 10 : 7 201,32 $ → 720132 cents, lignes T1 14400 / 25000");
