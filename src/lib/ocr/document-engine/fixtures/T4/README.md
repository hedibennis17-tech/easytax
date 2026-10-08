# T4 Test Fixtures

Place test documents here with their corresponding `.expected.json` files.

## Naming convention

```
001_normal.pdf          ← real T4 PDF
001_normal.expected.json
002_photo.jpg           ← photo of T4
002_photo.expected.json
003_scan.jpg
003_scan.expected.json
004_poor_quality.jpg
004_poor_quality.expected.json
005_multiple.pdf        ← PDF with multiple T4s
005_multiple.expected.json
```

## Expected JSON format

```json
{
  "documentType": "T4",
  "taxYear": 2025,
  "fields": {
    "box_14": 58432.00,
    "box_16": 2915.40,
    "box_18": 952.56,
    "box_22": 12846.00
  }
}
```

For multiple slips in one file, use an array:
```json
[
  { "documentType": "T4", "taxYear": 2025, "fields": { "box_14": 50000 } },
  { "documentType": "T4", "taxYear": 2025, "fields": { "box_14": 35000 } }
]
```
