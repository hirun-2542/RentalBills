# Ticket 017 — Background Template Upload API

## Goal

Upload Word (.docx) หรือ PDF เป็น background template สำหรับ canvas editor + convert เป็น PNG preview เพื่อแสดงใน canvas

## Scope

In scope:
- `POST /api/settings/template/background` — upload .docx หรือ .pdf
- `DELETE /api/settings/template/background` — ลบ template (กลับไปใช้ Qorstack Word template fallback)
- Convert ไฟล์เป็น PNG preview (หน้าแรก)

Out of scope:
- Image (.png/.jpg) upload โดยตรง
- Multi-page preview
- Canvas editor UI (Ticket 018)

## Files likely to create or edit

- `app/api/settings/template/background/route.ts` (ใหม่)
- `lib/template-converter.ts` (ใหม่)
- `public/uploads/template/.gitkeep` (ใหม่)

## Dependencies

- ผลจาก **Ticket 014** (Qorstack spike) กำหนดว่าจะใช้ Qorstack หรือ LibreOffice CLI สำหรับ conversion

## Implementation steps

### POST /api/settings/template/background

1. รับ `multipart/form-data` field `file`
2. Validate: ต้องเป็น `.docx` หรือ `.pdf` เท่านั้น → 400 ถ้าไม่ใช่
3. บันทึกไฟล์ต้นฉบับ → `public/uploads/template/background.{ext}` (ลบไฟล์เก่าก่อนถ้ามี)
4. Convert เป็น PNG preview → `public/uploads/template/preview.png`:
   - ถ้า Qorstack มี convert endpoint (ผลจาก Ticket 014) → ใช้ Qorstack
   - ถ้าไม่มี → ใช้ LibreOffice CLI: `libreoffice --headless --convert-to png --outdir <dir> <file>`
5. Update `Settings.templateBackgroundPath` และ `Settings.templatePreviewPath`
6. Return `{ backgroundPath: "/uploads/template/background.{ext}", previewUrl: "/uploads/template/preview.png" }`

### DELETE /api/settings/template/background

1. ลบ `public/uploads/template/background.*` และ `public/uploads/template/preview.png`
2. Reset `Settings.templateBackgroundPath = null`, `Settings.templatePreviewPath = null`, `Settings.templateLayout = null`
3. Return `{ ok: true }`

### lib/template-converter.ts

```ts
export async function convertToPreviewPng(
  inputPath: string,
  fileType: "docx" | "pdf"
): Promise<string> // คืน path ของ PNG ที่สร้าง
```

## Tests required

- POST .docx → file saved ที่ `public/uploads/template/background.docx` + `preview.png` ถูกสร้าง
- POST .pdf → file saved + `preview.png` ถูกสร้าง
- POST ไฟล์ประเภทอื่น (เช่น .jpg) → 400
- DELETE → ไฟล์ทั้งหมดถูกลบ + settings reset เป็น null

## Acceptance criteria

- [ ] preview.png แสดงหน้าแรกของ template ที่ upload
- [ ] Error message ชัดเจนถ้า LibreOffice ไม่มีใน server
- [ ] ไฟล์เก่าถูกลบก่อน save ไฟล์ใหม่ (ไม่สะสม)
- [ ] DELETE คืน settings กลับเป็น null ทั้ง 3 fields

## Prompt for Codex

Implement Ticket 017 only.

Check `docs/qorstack-api.md` (from Ticket 014) to determine whether to use Qorstack or LibreOffice CLI for DOCX/PDF → PNG conversion.

Create:

1. `lib/template-converter.ts` — exports `convertToPreviewPng(inputPath: string, fileType: "docx" | "pdf"): Promise<string>`. Use Qorstack conversion endpoint if available, otherwise run LibreOffice headless CLI via `child_process.execFile`. Return the path to the generated PNG.

2. `app/api/settings/template/background/route.ts`:
   - `POST`: accept `multipart/form-data` with field `file`. Validate file type (.docx or .pdf only, return 400 otherwise). Save to `public/uploads/template/background.{ext}`. Call `convertToPreviewPng`. Update `Settings.templateBackgroundPath` and `Settings.templatePreviewPath`. Return `{ backgroundPath, previewUrl }`.
   - `DELETE`: delete both files, reset all three template fields on Settings to null. Return `{ ok: true }`.

Create `public/uploads/template/.gitkeep`.

Add tests for both endpoints including file type validation.

Rules:
- Do not implement canvas editor UI.
- Keep diff small. Explain tests run before finishing.

After implementation:
1. Run relevant checks (type-check, lint, tests).
2. Commit the changes.
3. Push branch `ai/017-background-template-upload`.
4. Create a GitHub PR using `gh pr create`.
5. Do not merge the PR.
6. Include summary, tests run, risks, and ticket reference (Ticket 017) in the PR description.
