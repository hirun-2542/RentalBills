# Ticket 015 — Local PDF Storage Utility

## Goal

เก็บ generated PDF ไว้ local filesystem แทนที่จะพึ่ง URL จาก Qorstack host เพื่อรองรับ canvas-based rendering ที่จะสร้าง PDF buffer เอง

## Scope

In scope:
- Utility `lib/pdf-storage.ts` สำหรับ save/delete/get URL ของ PDF
- Directory `public/uploads/bills/`
- เพิ่ม `public/uploads/` ใน `.gitignore`

Out of scope:
- S3 หรือ object storage (future work)
- Migration ของ PDF เดิมที่ Qorstack เก็บ

## Files likely to create or edit

- `lib/pdf-storage.ts` (ใหม่)
- `public/uploads/bills/.gitkeep` (ใหม่)
- `.gitignore`

## Implementation steps

1. สร้าง `lib/pdf-storage.ts`:

```ts
export async function saveBillPdf(billId: string, buffer: Buffer): Promise<string>
// บันทึก buffer ไปที่ public/uploads/bills/{billId}.pdf
// สร้าง directory ด้วย fs.promises.mkdir({ recursive: true }) ถ้ายังไม่มี
// คืน public URL: /uploads/bills/{billId}.pdf

export async function deleteBillPdf(billId: string): Promise<void>
// ลบไฟล์ public/uploads/bills/{billId}.pdf (ignore ถ้าไม่มีไฟล์)

export function getBillPdfUrl(billId: string): string
// คืน /uploads/bills/{billId}.pdf
```

2. สร้าง `public/uploads/bills/.gitkeep` เพื่อ track directory
3. เพิ่ม `/public/uploads/` ใน `.gitignore`

## Tests required

- `saveBillPdf` → ไฟล์ถูกสร้างที่ path ที่ถูกต้อง (`public/uploads/bills/{id}.pdf`)
- `getBillPdfUrl` → คืน `/uploads/bills/{id}.pdf`
- `deleteBillPdf` → ไฟล์ถูกลบ
- `deleteBillPdf` บนไฟล์ที่ไม่มีอยู่ → ไม่ throw error

## Acceptance criteria

- [ ] PDF ถูกเก็บใน `public/uploads/bills/` และเข้าถึงได้ผ่าน HTTP path `/uploads/bills/{billId}.pdf`
- [ ] `public/uploads/` อยู่ใน `.gitignore`
- [ ] `public/uploads/bills/` directory ถูก track ด้วย `.gitkeep`
- [ ] ไม่มี breaking change กับ Qorstack flow เดิม (utility ใหม่เป็น additive เท่านั้น)

## Prompt for Codex

Implement Ticket 015 only.

Create `lib/pdf-storage.ts` with three exports:
- `saveBillPdf(billId: string, buffer: Buffer): Promise<string>` — writes buffer to `public/uploads/bills/{billId}.pdf` (creates directory if needed with `fs.promises.mkdir` recursive), returns `/uploads/bills/{billId}.pdf`
- `deleteBillPdf(billId: string): Promise<void>` — deletes the file, silently ignores if not found (catch ENOENT)
- `getBillPdfUrl(billId: string): string` — returns `/uploads/bills/{billId}.pdf`

Also:
- Create `public/uploads/bills/.gitkeep`
- Add `/public/uploads/` to `.gitignore`

Add unit tests for all three functions.

Rules:
- Do not change any existing code — this is additive only.
- Do not wire this into the bill generation flow yet (that is Ticket 019).
- Keep diff small. Explain tests run before finishing.

After implementation:
1. Run relevant checks (type-check, lint, tests).
2. Commit the changes.
3. Push branch `ai/015-local-pdf-storage`.
4. Create a GitHub PR using `gh pr create`.
5. Do not merge the PR.
6. Include summary, tests run, risks, and ticket reference (Ticket 015) in the PR description.
