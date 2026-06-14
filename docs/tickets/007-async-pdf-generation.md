# Ticket 007 — Async PDF Generation (Inngest + qorstack-report)

## Goal

สร้าง PDF บิลแบบ async ผ่าน Inngest job queue — API return 202 ทันที, Inngest รัน background เรียก qorstack-report แล้วเก็บ PDF URL

## Scope

In scope:
- ติดตั้ง Inngest
- `lib/inngest.ts` — Inngest client
- `lib/qorstack.ts` — HTTP client สำหรับ qorstack REST API
- `inngest/generate-bill-pdf.ts` — Inngest function
- `app/api/inngest/route.ts` — Inngest webhook handler
- `app/api/bills/[id]/generate/route.ts` — enqueue job
- `templates/bill.docx` — DOCX template เริ่มต้น
- Bill detail UI: แสดง pdfStatus + polling

Out of scope:
- LINE sending (Ticket 009)
- QR code (Ticket 008)
- ยังไม่ต้อง upload PDF ไปยัง storage ถาวร (ใช้ URL จาก qorstack ชั่วคราวในตอนนี้)

## Files likely to create or edit

- `lib/inngest.ts`
- `lib/qorstack.ts`
- `inngest/generate-bill-pdf.ts`
- `app/api/inngest/route.ts`
- `app/api/bills/[id]/generate/route.ts`
- `templates/bill.docx`
- `app/(dashboard)/bills/[id]/page.tsx` (เพิ่ม pdfStatus UI + polling)

## Async Flow

```
POST /api/bills/:id/generate
  → ตรวจ session
  → ตรวจ pdfStatus ไม่ใช่ PENDING/PROCESSING (409 ถ้าใช่)
  → set pdfStatus = PENDING
  → inngest.send("bill/pdf.generate", { billId })
  → return 202 { status: "queued" }

[Inngest Background]
  → set pdfStatus = PROCESSING
  → build template variables จาก bill data
  → POST qorstack-report API → render bill.docx → PDF
  → set pdfStatus = DONE, pdfUrl = result
  → ถ้า error: set pdfStatus = FAILED, pdfError = message

[Frontend Polling]
  → GET /api/bills/:id ทุก 2s ขณะ pdfStatus = PENDING|PROCESSING
  → หยุด poll เมื่อ DONE หรือ FAILED
```

## qorstack-report Template Variables

Template `templates/bill.docx` ต้องมีตัวแปรเหล่านี้ (ใช้ syntax `{{variableName}}`):

```
{{tenantName}}
{{roomNumber}}
{{month}}
{{year}}
{{waterPrevReading}}
{{waterCurrReading}}
{{waterUsage}}
{{waterRatePerUnit}}
{{waterCollectionFee}}
{{waterTotal}}
{{elecPrevReading}}
{{elecCurrReading}}
{{elecUsage}}
{{elecRatePerUnit}}
{{elecTotal}}
{{rent}}
{{total}}
{{bankAccountName}}
{{bankAccountNumber}}
{{promptpayNumber}}
```

## lib/qorstack.ts Interface

```ts
// เรียก qorstack-report REST API
// POST ${QORSTACK_API_URL}/api/v1/render
// Authorization: Bearer ${QORSTACK_API_KEY}
// Body: { templateName: "bill", variables: Record<string, string> }
// Response: { url: string } หรือ { fileUrl: string }
// (ตรวจ actual API spec ของ qorstack-report ก่อน implement)

export async function renderBillPdf(variables: Record<string, string>): Promise<string>
```

**สำคัญ:** ก่อน implement `lib/qorstack.ts` ให้ตรวจ qorstack-report API documentation ที่ `${QORSTACK_API_URL}/docs` หรือ README ของ repo เพื่อให้ endpoint, auth header, body format ถูกต้อง

## Implementation steps

1. `npm install inngest`
2. สร้าง `lib/inngest.ts`:
   ```ts
   import { Inngest } from "inngest"
   export const inngest = new Inngest({ id: "rental-bills" })
   ```
3. สร้าง `lib/qorstack.ts` — renderBillPdf function (ตรวจ API spec ก่อน)
4. สร้าง `inngest/generate-bill-pdf.ts` — Inngest function ตาม flow ข้างต้น
5. สร้าง `app/api/inngest/route.ts`:
   ```ts
   import { serve } from "inngest/next"
   import { inngest } from "@/lib/inngest"
   import { generateBillPdf } from "@/inngest/generate-bill-pdf"
   export const { GET, POST, PUT } = serve({ client: inngest, functions: [generateBillPdf] })
   ```
6. สร้าง `app/api/bills/[id]/generate/route.ts` — enqueue + return 202
7. สร้าง `templates/bill.docx` — DOCX template ที่มี variable ครบ (สร้างด้วย LibreOffice หรือ Microsoft Word)
8. อัปเดต `app/(dashboard)/bills/[id]/page.tsx`:
   - ดึง `pdfStatus` จาก bill
   - ปุ่ม "สร้าง PDF" → POST /api/bills/:id/generate
   - Poll GET /api/bills/:id ทุก 2s ขณะ PENDING/PROCESSING (ใช้ `useEffect` + `setInterval`)
   - แสดง spinner ขณะรอ, PDF link เมื่อ DONE, error + retry เมื่อ FAILED

## Tests required

- POST /api/bills/:id/generate → return 202 ภายใน 1s
- pdfStatus เปลี่ยน NONE → PENDING → PROCESSING → DONE (local dev ด้วย inngest-cli)
- qorstack return error → pdfStatus = FAILED + pdfError มีข้อความ
- กด generate ขณะ PENDING → 409
- PDF URL ใช้งานได้จริง (ดาวน์โหลดได้)

## Acceptance criteria

- [ ] POST /generate return 202 เสมอ (ไม่เกิน 1s)
- [ ] pdfStatus อัปเดตถูกต้องตลอด lifecycle
- [ ] PDF URL แสดงใน bill detail เมื่อ DONE
- [ ] Error แสดง + retry button เมื่อ FAILED
- [ ] `npx inngest-cli@latest dev` รัน job ได้ใน local
- [ ] Template ครบทุก variable ตาม spec

## Prompt for Codex

Implement Ticket 007 only.

Install `inngest`.

Create `lib/inngest.ts`:
```ts
import { Inngest } from "inngest"
export const inngest = new Inngest({ id: "rental-bills" })
```

Create `lib/qorstack.ts` with a `renderBillPdf(variables: Record<string, string>): Promise<string>` function that calls qorstack-report's REST API. Before implementing, read the qorstack-report API docs (available at QORSTACK_API_URL/docs or the GitHub repo README) to confirm the correct endpoint, auth method, and request body format. Return the PDF file URL string.

Create `inngest/generate-bill-pdf.ts` — an Inngest function triggered by event "bill/pdf.generate" with payload `{ billId: string }`:
1. Fetch bill with tenant, room, and Settings from DB
2. Set bill.pdfStatus = PROCESSING
3. Build variables object with all template fields (tenant name, room number, month, year, all meter readings, rates, totals, bank info, promptpay)
4. Call renderBillPdf(variables)
5. On success: set pdfStatus = DONE, pdfUrl = result
6. On any error: set pdfStatus = FAILED, pdfError = error.message
Use try/catch around the qorstack call.

Create `app/api/inngest/route.ts` to serve the Inngest handler (export GET, POST, PUT from `serve`).

Create `app/api/bills/[id]/generate/route.ts` (POST):
- Require authenticated session
- Fetch bill, return 404 if not found
- If pdfStatus is PENDING or PROCESSING, return 409 { error: "กำลังสร้าง PDF อยู่" }
- Set pdfStatus = PENDING
- Send inngest event "bill/pdf.generate" with { billId }
- Return 202 { status: "queued" }

Create `templates/bill.docx` — a basic DOCX template using `{{variableName}}` syntax for all variables listed in the ticket spec.

Update `app/(dashboard)/bills/[id]/page.tsx`:
- Show current pdfStatus
- "สร้าง PDF" button calls POST /api/bills/:id/generate
- When pdfStatus is PENDING or PROCESSING, poll GET /api/bills/:id every 2000ms using setInterval in useEffect (clear interval on unmount or when status changes to DONE/FAILED)
- Show spinner while polling
- Show PDF link (download) when DONE
- Show error message + "ลองใหม่" button when FAILED

Rules:
- Do not implement LINE sending or QR code.
- Do not add features outside this ticket.
- Keep diff small. Explain tests run before finishing.

After implementation:
1. Run relevant checks (type-check, lint, tests).
2. Commit the changes.
3. Push branch `ai/007-async-pdf-generation`.
4. Create a GitHub PR using `gh pr create`.
5. Do not merge the PR.
6. Include summary, tests run, risks, and ticket reference (Ticket 007) in the PR description.
