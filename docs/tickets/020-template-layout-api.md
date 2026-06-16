# Ticket 020 — Template Layout CRUD API

## Goal

API endpoints สำหรับ canvas editor ใช้อ่าน/บันทึก layout JSON และ generate preview PDF

## Scope

In scope:
- `GET /api/settings/template` — อ่าน layout + backgroundPreviewUrl
- `PUT /api/settings/template/layout` — บันทึก layout JSON พร้อม validation
- `POST /api/settings/template/preview` — render preview PDF ด้วย sample data

Out of scope:
- Canvas editor UI (Ticket 018)
- Background file upload (Ticket 017)

## Files likely to create or edit

- `app/api/settings/template/route.ts` (ใหม่ — GET)
- `app/api/settings/template/layout/route.ts` (ใหม่ — PUT)
- `app/api/settings/template/preview/route.ts` (ใหม่ — POST)
- `types/template.ts` (ใหม่ — TypeScript types)

## Dependencies

- **Ticket 016** (DB schema)
- **Ticket 019** (PDF renderer — ใช้ใน preview endpoint)

## Endpoints

### GET /api/settings/template

Response:
```json
{
  "layout": {
    "pageWidth": 595,
    "pageHeight": 842,
    "items": [...]
  },
  "backgroundPreviewUrl": "/uploads/template/preview.png"
}
```

ถ้าไม่มีข้อมูล → `"layout": null, "backgroundPreviewUrl": null`

---

### PUT /api/settings/template/layout

Request body:
```json
{
  "pageWidth": 595,
  "pageHeight": 842,
  "items": [...]
}
```

Validation rules:
- `pageWidth` และ `pageHeight` ต้องเป็นตัวเลขบวก
- `items` ต้องเป็น array
- แต่ละ item ต้องมี `id` (string), `type` ("variable" | "static"), `x`, `y`, `width`, `height` (ตัวเลขบวก), `fontSize` (ตัวเลขบวก)
- ถ้า `type === "variable"`: ต้องมี `variable` ใน whitelist (ดูด้านล่าง)
- ถ้า `type === "static"`: ต้องมี `text` (non-empty string)
- Error ที่ไม่ผ่าน validation → 422 พร้อม error message ชัดเจน

Response: `{ layout }` (layout ที่บันทึก)

### Whitelist ของ variables ที่รองรับ

```ts
export const ALLOWED_VARIABLES = [
  "tenantName", "roomNumber", "month", "year",
  "waterPrevReading", "waterCurrReading", "waterUsage",
  "waterRatePerUnit", "waterCollectionFee", "waterTotal",
  "elecPrevReading", "elecCurrReading", "elecUsage",
  "elecRatePerUnit", "elecTotal",
  "rent", "total",
  "bankAccountName", "bankAccountNumber", "promptpayNumber",
] as const
```

---

### POST /api/settings/template/preview

- Render preview PDF ด้วย sample data ภาษาไทย
- ถ้ามี layout ใน DB → ใช้ `renderBillPdfFromLayout()`
- ถ้าไม่มี layout → ใช้ `renderBillPdf()` (Qorstack fallback)
- บันทึก PDF เป็น `public/uploads/template/preview-bill.pdf`
- Return: `{ previewUrl: "/uploads/template/preview-bill.pdf" }`

### Sample data สำหรับ preview

```ts
export const PREVIEW_VARIABLES = {
  tenantName: "ภิญโญ สมชาย",
  roomNumber: "101",
  month: "6",
  year: "2026",
  waterPrevReading: "100",
  waterCurrReading: "115",
  waterUsage: "15",
  waterRatePerUnit: "18",
  waterCollectionFee: "50",
  waterTotal: "320",
  elecPrevReading: "200",
  elecCurrReading: "230",
  elecUsage: "30",
  elecRatePerUnit: "8",
  elecTotal: "240",
  rent: "4500",
  total: "5060",
  bankAccountName: "กล้วยหอม มีสุข",
  bankAccountNumber: "123-4-56789-0",
  promptpayNumber: "0812345678",
}
```

## types/template.ts

```ts
export type TemplateItemVariable = {
  id: string
  type: "variable"
  variable: string
  x: number; y: number; width: number; height: number
  fontSize: number; fontWeight: "normal" | "bold"; color: string
}

export type TemplateItemStatic = {
  id: string
  type: "static"
  text: string
  x: number; y: number; width: number; height: number
  fontSize: number; fontWeight: "normal" | "bold"; color: string
}

export type TemplateItem = TemplateItemVariable | TemplateItemStatic

export type TemplateLayout = {
  pageWidth: number
  pageHeight: number
  items: TemplateItem[]
}
```

## Tests required

- `GET /api/settings/template` คืน layout + backgroundPreviewUrl
- `GET /api/settings/template` เมื่อไม่มีข้อมูล → คืน null ทั้งสอง field
- `PUT /api/settings/template/layout` บันทึก layout ถูกต้อง
- `PUT` ที่มี `variable` ไม่อยู่ใน whitelist → 422
- `PUT` ที่ x เป็น string แทนตัวเลข → 422
- `PUT` ที่ `type: "variable"` ไม่มี field `variable` → 422
- `POST /api/settings/template/preview` คืน `{ previewUrl }` ที่ถูกต้อง

## Acceptance criteria

- [ ] Canvas editor อ่านและบันทึก layout ผ่าน API ได้
- [ ] Variable ที่ไม่ได้รับการรองรับถูก reject พร้อม error message ชัดเจน
- [ ] Preview PDF ใช้ชื่อไทยใน sample data (ตรวจสอบ "ภิญโญ" แสดงถูกต้อง)
- [ ] Unauthenticated request → 401

## Prompt for Codex

Implement Ticket 020 only.

Create `types/template.ts` with `TemplateLayout`, `TemplateItem`, `TemplateItemVariable`, `TemplateItemStatic` types and `ALLOWED_VARIABLES` const (see above).

Create three API route files:

1. `app/api/settings/template/route.ts` — `GET`: return `{ layout: settings.templateLayout, backgroundPreviewUrl: settings.templatePreviewPath }`. Require auth (401 if not logged in).

2. `app/api/settings/template/layout/route.ts` — `PUT`: validate request body against TemplateLayout schema (return 422 with descriptive error on failure), save to `settings.templateLayout`. Require auth.

3. `app/api/settings/template/preview/route.ts` — `POST`: use `PREVIEW_VARIABLES` sample data (include Thai names), call `renderBillPdfFromLayout()` if layout exists else `renderBillPdf()`, save to `public/uploads/template/preview-bill.pdf`, return `{ previewUrl: "/uploads/template/preview-bill.pdf" }`. Require auth.

Add tests for all endpoints including validation error cases.

Rules:
- Do not implement canvas editor UI.
- Keep diff small. Explain tests run before finishing.

After implementation:
1. Run relevant checks (type-check, lint, tests).
2. Commit the changes.
3. Push branch `ai/020-template-layout-api`.
4. Create a GitHub PR using `gh pr create`.
5. Do not merge the PR.
6. Include summary, tests run, risks, and ticket reference (Ticket 020) in the PR description.
