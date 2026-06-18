# Ticket 019 — PDF Rendering Engine (Canvas Layout → PDF)

## Goal

Generate PDF จาก canvas layout JSON + background template + bill data พร้อมรองรับภาษาไทย

## Scope

In scope:
- `lib/pdf-renderer.ts` สำหรับ render PDF จาก layout JSON
- อัพเดต `inngest/generate-bill-pdf.ts` ให้มี fallback logic
- Preview endpoint `POST /api/settings/template/preview`

Out of scope:
- Canvas editor UI (Ticket 018)
- Migration ของ PDF เดิม

## Files likely to create or edit

- `lib/pdf-renderer.ts` (ใหม่)
- `inngest/generate-bill-pdf.ts` (อัพเดต)
- `app/api/settings/template/preview/route.ts` (ใหม่)
- `package.json` (เพิ่ม `puppeteer` ถ้าเป็น Path B)

## Dependencies

- **Ticket 015** (local PDF storage)
- **Ticket 016** (DB schema)

## Rendering Path

```
layout JSON
  → HTML string (positioned CSS)
  → Puppeteer page.setContent() → page.pdf()
  → PDF buffer
  → saveBillPdf(billId, buffer)
```

## HTML Template Pattern

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; }
    .page {
      position: relative;
      width: 595px;
      height: 842px;
      overflow: hidden;
    }
    .bg {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: fill;
    }
    .item {
      position: absolute;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="page">
    <img class="bg" src="{backgroundPreviewAbsolutePath}" />
    <!-- สำหรับแต่ละ item ใน layout.items: -->
    <span class="item" style="
      left: {x}px;
      top: {y}px;
      width: {width}px;
      font-size: {fontSize}px;
      font-weight: {fontWeight};
      color: {color};
    ">{value}</span>
  </div>
</body>
</html>
```

หมายเหตุ: `{value}` มาจาก `variables[item.variable]` (type=variable) หรือ `item.text` (type=static)

## lib/pdf-renderer.ts

```ts
import type { TemplateLayout } from "@/types/template"

export async function renderBillPdfFromLayout(
  layout: TemplateLayout,
  variables: Record<string, string>,
  backgroundPreviewPath: string // absolute filesystem path ของ preview PNG
): Promise<Buffer>
```

## Logic ใน inngest/generate-bill-pdf.ts

```ts
const settings = await db.settings.findUnique({ where: { id: "singleton" } })
const layout = (settings?.templateLayout as TemplateLayout | null) ?? { pageWidth: 794, pageHeight: 1123, items: [] }
const buffer = await renderBillPdfFromLayout(layout, variables, backgroundPath)
const pdfUrl = await saveBillPdf(billId, buffer)
await db.bill.update({ where: { id: billId }, data: { pdfUrl, pdfStatus: "DONE" } })
```

## Thai font requirement

- CSS: `font-family: 'Sarabun', 'Noto Sans Thai', sans-serif`
- ถ้าใช้ Puppeteer: ตรวจสอบว่า server มี Thai font ติดตั้ง หรือ download Sarabun font และ embed ด้วย CSS `@font-face`
- Acceptance criteria บังคับทดสอบชื่อไทย

## Tests required

- `renderBillPdfFromLayout` คืน `Buffer` ที่ไม่ว่างเปล่า
- ถ้ามี layout → เรียก `renderBillPdfFromLayout` และ save ไฟล์ local
- Preview endpoint คืน `{ previewUrl }` ที่ชี้ไปที่ local PDF

## Acceptance criteria

- [ ] ⚠️ CRITICAL: ชื่อภาษาไทย เช่น "ภิญโญ" และ "กล้วยหอม" แสดงถูกต้องใน PDF (สระบน/วรรณยุกต์ไม่ขยับ)
- [ ] ตำแหน่ง item ตรงกับที่วางใน canvas editor
- [ ] PDF ถูกเก็บ local และเข้าถึงได้ผ่าน HTTP

## Prompt for Codex

Implement Ticket 019 only.

Create `lib/pdf-renderer.ts` exporting `renderBillPdfFromLayout(layout, variables, backgroundPreviewPath): Promise<Buffer>`. This function:
1. Builds an HTML string with `position: absolute` CSS for each item in `layout.items`, placing variable values or static text at their (x, y) coordinates
2. Uses `font-family: 'Sarabun', 'Noto Sans Thai', sans-serif` for Thai text support
3. Uses Puppeteer for HTML → PDF conversion

Update `inngest/generate-bill-pdf.ts`:
- Use `renderBillPdfFromLayout()`, then `saveBillPdf()` from Ticket 015, update `bill.pdfUrl` with the local URL

Create `app/api/settings/template/preview/route.ts` (POST) that renders a preview PDF using sample Thai data (tenantName: "ภิญโญ สมชาย", etc.) and returns `{ previewUrl }`.

**CRITICAL**: Before finishing, manually verify that Thai text (specifically "ภิญโญ" with upper vowel + tone mark, and "กล้วยหอม") renders correctly in the generated PDF. If using Puppeteer and fonts are missing, embed Sarabun via `@font-face` using the font file or a data URI.

Rules:
- The Qorstack Word template fallback must remain 100% unchanged.
- Keep diff small. Explain tests run before finishing.

After implementation:
1. Run relevant checks (type-check, lint, tests).
2. Commit the changes.
3. Push branch `ai/019-pdf-rendering-engine`.
4. Create a GitHub PR using `gh pr create`.
5. Do not merge the PR.
6. Include summary, tests run, Thai font verification, risks, and ticket reference (Ticket 019) in the PR description.
