import assert from "node:assert/strict";
import { extractAllBoxes } from "../src/lib/ocr/dictionnaire";

const text = `T4A
Year Année
2022
Income tax deducted – line 43700
022
275,00
Fees for services
Honoraires ou autres sommes pour services rendus
048
Other information (see page 2)
Box - Case
Amount - Montant
202
3 000,00
Box - Case
203
Amount - Montant
2 500,00`;

const boxes = extractAllBoxes(text, "T4A");
const get = (code: string) => boxes.find((box) => box.code === code)!;

assert.equal(get("022").amountCents, 27_500);
assert.equal(get("202").amountCents, 300_000);
assert.equal(get("202").t1_line, "13000");
assert.equal(get("203").amountCents, 250_000);
assert.equal(get("203").t1_line, "13000");
assert.equal(get("048").amountCents, null);

console.log("T4A COVID regression passed: 022=275.00, 202=3000.00, 203=2500.00, 048=empty");
