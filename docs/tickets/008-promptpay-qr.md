# Ticket 008 — PromptPay QR Code

## Goal

สร้าง QR image สำหรับ PromptPay จาก `settings.promptpayNumber` + `bill.total` แสดงใน bill detail UI

## Scope

In scope:
- `lib/promptpay.ts` — สร้าง PromptPay QR string + render เป็น base64 PNG
- แสดง QR image ใน `/bills/:id`
- API endpoint `GET /api/bills/:id/qr` → return QR image (png)

Out of scope:
- ไม่ต้องเก็บ QR image ลง DB
- LINE sending (Ticket 009)

## Files likely to create or edit

- `lib/promptpay.ts`
- `app/api/bills/[id]/qr/route.ts`
- `app/(dashboard)/bills/[id]/page.tsx` (เพิ่ม QR display)

## Implementation steps

1. `npm install promptpay-qr qrcode` + `npm install -D @types/qrcode`
2. สร้าง `lib/promptpay.ts`:
   ```ts
   import generatePayload from "promptpay-qr"
   import QRCode from "qrcode"

   export async function generatePromptPayQR(
     promptpayId: string,   // เลขบัตรประชาชน 13 หลัก
     amount: number
   ): Promise<string> {    // returns base64 PNG data URL
     const payload = generatePayload(promptpayId, { amount })
     return QRCode.toDataURL(payload)
   }
   ```
3. สร้าง `app/api/bills/:id/qr/route.ts`:
   - GET: fetch bill + settings.promptpayNumber
   - สร้าง QR จาก `generatePromptPayQR(settings.promptpayNumber, bill.total)`
   - Return PNG image (`Content-Type: image/png`)
4. อัปเดต `app/(dashboard)/bills/[id]/page.tsx`:
   - แสดง `<img src="/api/bills/:id/qr" />` ใน section "ชำระเงิน"
   - แสดงยอดที่ต้องโอนชัดเจน

## Tests required

- GET /api/bills/:id/qr → return PNG image (Content-Type: image/png)
- QR scan ได้บน banking app ไทย (ทดสอบด้วย mobile จริง)
- ถ้า settings.promptpayNumber ว่าง → return 422 + message "ยังไม่ได้ตั้งค่า PromptPay"

## Acceptance criteria

- [ ] QR image แสดงใน bill detail
- [ ] QR scan ได้จริงบน mobile banking app
- [ ] ยอดในหน้าตรงกับ bill.total
- [ ] PromptPay ไม่ได้ตั้งค่า → แสดง error message แทน QR

## Prompt for Codex

Implement Ticket 008 only.

Install `promptpay-qr` and `qrcode` (with `@types/qrcode` as dev dep).

Create `lib/promptpay.ts`:
```ts
import generatePayload from "promptpay-qr"
import QRCode from "qrcode"

export async function generatePromptPayQR(promptpayId: string, amount: number): Promise<Buffer> {
  const payload = generatePayload(promptpayId, { amount })
  return QRCode.toBuffer(payload, { type: "png", width: 300 })
}
```

Create `app/api/bills/[id]/qr/route.ts` (GET):
- Require authenticated session
- Fetch bill by id (404 if not found)
- Fetch settings (upsert singleton)
- If settings.promptpayNumber is empty, return 422 { error: "ยังไม่ได้ตั้งค่า PromptPay" }
- Call generatePromptPayQR(settings.promptpayNumber, bill.total)
- Return response with Content-Type: image/png and the PNG buffer as body

Update `app/(dashboard)/bills/[id]/page.tsx`:
- Add a "ชำระเงิน" section showing:
  - ยอดที่ต้องชำระ (bill.total formatted as Thai Baht)
  - `<img src={/api/bills/${bill.id}/qr} alt="QR PromptPay" width={250} />`
  - ชื่อบัญชี + เลขบัญชีธนาคารจาก settings (fetch settings ด้วย)

Rules:
- Do not implement LINE sending.
- Do not store QR in DB.
- Do not add features outside this ticket.
- Keep diff small. Explain tests run (including manual QR scan test) before finishing.
