import { extractAllBoxes } from "../src/lib/ocr/dictionnaire";

const ocrText = `T4A
Statement of Pension, Retirement, Annuity and Other Income
--- STRUCTURED FIELDS ---
box_015
1
box_024
box_032
box_048
048
410,76`;

const boxes = extractAllBoxes(ocrText, "T4A");
const byCode = new Map(boxes.map((box) => [box.code, box]));

const box015 = byCode.get("015");
const box024 = byCode.get("024");
const box032 = byCode.get("032");
const box048 = byCode.get("048");

if (box015?.rawValue !== "1" || box015.amountCents !== 100) {
  throw new Error(`T4A 015 attendu=1/100, obtenu=${box015?.rawValue}/${box015?.amountCents}`);
}
if (box024?.rawValue !== null || box032?.rawValue !== null) {
  throw new Error(`T4A 024/032 doivent rester vides: 024=${box024?.rawValue}, 032=${box032?.rawValue}`);
}
if (box048?.rawValue !== "410,76" || box048.amountCents !== 41076) {
  throw new Error(`T4A 048 attendu=410,76/41076, obtenu=${box048?.rawValue}/${box048?.amountCents}`);
}

console.log("T4A HCO OCR regression passed: 015=1; 024/032 empty; 048=410,76.");
