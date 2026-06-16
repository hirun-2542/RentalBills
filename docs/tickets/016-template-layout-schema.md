# Ticket 016 — DB Schema: Template Layout

## Goal

เพิ่ม fields ใน `Settings` model สำหรับเก็บ canvas layout JSON และ paths ของ background template

## Scope

In scope:
- เพิ่ม 3 fields ใน `Settings` model: `templateLayout`, `templateBackgroundPath`, `templatePreviewPath`
- Prisma migration

Out of scope:
- API endpoints (Ticket 020)
- Canvas editor UI (Ticket 018)

## Files likely to create or edit

- `prisma/schema.prisma`
- migration file (auto-generated)

## Data model

```prisma
model Settings {
  // existing fields...
  templateLayout         Json?    // canvas layout JSON (structure below)
  templateBackgroundPath String?  // path ของไฟล์ต้นฉบับ เช่น /uploads/template/background.docx
  templatePreviewPath    String?  // path ของ preview PNG เช่น /uploads/template/preview.png
}
```

### templateLayout JSON structure

```json
{
  "pageWidth": 595,
  "pageHeight": 842,
  "items": [
    {
      "id": "field_1",
      "type": "variable",
      "variable": "tenantName",
      "x": 120,
      "y": 200,
      "width": 250,
      "height": 28,
      "fontSize": 13,
      "fontWeight": "normal",
      "color": "#000000"
    },
    {
      "id": "label_1",
      "type": "static",
      "text": "ผู้เช่า:",
      "x": 50,
      "y": 200,
      "width": 60,
      "height": 28,
      "fontSize": 13,
      "fontWeight": "bold",
      "color": "#000000"
    }
  ]
}
```

- `type: "variable"` — แสดงค่า variable จาก bill (ต้องมี field `variable`)
- `type: "static"` — ข้อความคงที่ (ต้องมี field `text`)
- พิกัด x, y, width, height เป็นหน่วย pt (1 pt = 1/72 inch) สอดคล้องกับ A4 (595×842 pt)

## Implementation steps

1. เพิ่ม 3 fields ใน `Settings` model ใน `prisma/schema.prisma`
2. รัน `npx prisma migrate dev --name add-template-layout`
3. ตรวจสอบว่า existing seed (`prisma/seed.ts`) ยังทำงานได้

## Tests required

- Migration รันสำเร็จ (ไม่มี error)
- Existing settings data ไม่เสียหาย
- `db.settings.update({ data: { templateLayout: { ... } } })` บันทึกและอ่านได้ถูกต้อง

## Acceptance criteria

- [ ] `Settings.templateLayout` เป็น nullable JSON field
- [ ] `Settings.templateBackgroundPath` เป็น nullable String
- [ ] `Settings.templatePreviewPath` เป็น nullable String
- [ ] Existing settings record ยังอ่านได้ปกติ (ไม่มี breaking migration)
- [ ] Prisma client types อัพเดตถูกต้อง (`npx prisma generate` สำเร็จ)

## Prompt for Codex

Implement Ticket 016 only.

In `prisma/schema.prisma`, add three nullable fields to the `Settings` model:
- `templateLayout Json?`
- `templateBackgroundPath String?`
- `templatePreviewPath String?`

Then run `npx prisma migrate dev --name add-template-layout` to create the migration. Verify that `prisma/seed.ts` still works and that existing settings data is not affected.

Add a test that creates a Settings record with `templateLayout` set to a valid JSON object and reads it back correctly.

Rules:
- Do not add API endpoints or UI in this ticket.
- Do not change any existing fields.
- Keep diff small. Explain tests run before finishing.

After implementation:
1. Run relevant checks (type-check, lint, tests).
2. Commit the changes (including generated migration file).
3. Push branch `ai/016-template-layout-schema`.
4. Create a GitHub PR using `gh pr create`.
5. Do not merge the PR.
6. Include summary, tests run, risks, and ticket reference (Ticket 016) in the PR description.
