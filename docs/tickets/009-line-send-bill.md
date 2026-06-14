# Ticket 009 — LINE Send Bill

## Goal

ส่ง PDF บิล + QR PromptPay ไปยัง LINE ของผู้เช่า แล้วอัปเดต bill status เป็น SENT

## Scope

In scope:
- `lib/line.ts` — LINE Messaging API wrapper
- `POST /api/bills/:id/send` — ส่ง LINE + update status
- อัปเดต bill detail UI: ปุ่มส่ง LINE + สถานะ

Out of scope:
- LINE Webhook (Ticket 010)
- Bulk send ทุกห้องพร้อมกัน (ทำทีละบิล)

## Files likely to create or edit

- `lib/line.ts`
- `app/api/bills/[id]/send/route.ts`
- `app/(dashboard)/bills/[id]/page.tsx` (เพิ่ม send button)

## Business rules

- ต้อง `pdfStatus === DONE` ก่อนส่ง — ถ้า PDF ยังไม่พร้อม → 422 "กรุณาสร้าง PDF ก่อนส่ง"
- ต้อง `tenant.lineUserId` มีค่า — ถ้าไม่มี → 422 "ผู้เช่ายังไม่มี LINE User ID"
- `status` ต้องเป็น DRAFT หรือ SENT (ยอมให้ส่งซ้ำได้ถ้าเป็น SENT)
- ห้ามส่งถ้า `status === PAID`
- ส่งข้อความ 2 รายการตามลำดับ:
  1. Text message สรุปยอด
  2. Image message (QR PromptPay) — generate QR แล้วส่งเป็น image URL หรือ base64
- อัปเดต `status = SENT`, `sentAt = now()`

## LINE Message Format

**Message 1 — Text:**
```
[ห้อง {roomNumber}] บิลค่าน้ำ-ค่าไฟ เดือน {month}/{year}

ค่าน้ำ: {waterUsage} หน่วย × {waterRatePerUnit} + {waterCollectionFee} บาท = {waterTotal} บาท
ค่าไฟ: {elecUsage} หน่วย × {elecRatePerUnit} = {elecTotal} บาท
ค่าเช่า: {rent} บาท
รวมทั้งหมด: {total} บาท

กรุณาโอนเงินภายใน 7 วัน
```

**Message 2 — Image (QR PromptPay):**
- ใช้ `generatePromptPayQR` จาก `lib/promptpay.ts`
- LINE รับ image แบบ `imageUrl` (URL ที่ accessible จาก internet)
  - ใน production: ใช้ URL `/api/bills/:id/qr` ที่ Vercel host
  - ต้องเป็น HTTPS URL สาธารณะ (LINE ดึงรูปเอง)

## lib/line.ts Interface

```ts
import { Client } from "@line/bot-sdk"

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
})

export async function sendBillMessages(lineUserId: string, messages: object[]): Promise<void>
```

## Implementation steps

1. `npm install @line/bot-sdk`
2. สร้าง `lib/line.ts` — LINE client + sendBillMessages function
3. สร้าง `app/api/bills/[id]/send/route.ts`:
   - ตรวจ session, fetch bill + tenant + settings
   - Validate: pdfStatus DONE, lineUserId มี, status ไม่ใช่ PAID
   - สร้าง text message จาก bill data
   - สร้าง QR image URL: `${process.env.NEXTAUTH_URL}/api/bills/${id}/qr`
   - เรียก `sendBillMessages(tenant.lineUserId, [textMessage, imageMessage])`
   - อัปเดต `status = SENT`, `sentAt = now()`
   - Return updated bill
4. อัปเดต bill detail page:
   - ปุ่ม "ส่ง LINE" → POST /api/bills/:id/send
   - Disable ปุ่มถ้า pdfStatus ไม่ใช่ DONE หรือ status = PAID
   - แสดง sentAt ถ้ามี

## Tests required

- POST /api/bills/:id/send ที่ pdfStatus ≠ DONE → 422
- POST /api/bills/:id/send ที่ tenant ไม่มี lineUserId → 422
- POST /api/bills/:id/send ที่ status = PAID → 409
- ส่งสำเร็จ → status = SENT, sentAt มีค่า
- LINE ได้รับ message จริง (ทดสอบกับ LINE account จริง)

## Acceptance criteria

- [ ] ส่ง LINE สำเร็จ → bill status เป็น SENT + sentAt มีค่า
- [ ] ผู้เช่าไม่มี LINE ID → 422 พร้อม error message
- [ ] PDF ยังไม่พร้อม → 422 พร้อม error message
- [ ] Status PAID → ปุ่มส่ง disable
- [ ] LINE ได้รับข้อความ text + รูป QR จริง

## Prompt for Codex

Implement Ticket 009 only.

Install `@line/bot-sdk`.

Create `lib/line.ts`:
```ts
import { Client, Message } from "@line/bot-sdk"

const getClient = () => new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
})

export async function sendBillMessages(lineUserId: string, messages: Message[]): Promise<void> {
  await getClient().pushMessage(lineUserId, messages)
}
```

Create `app/api/bills/[id]/send/route.ts` (POST):
- Require authenticated session
- Fetch bill with tenant, room, settings
- Validate:
  - bill.pdfStatus !== "DONE" → 422 { error: "กรุณาสร้าง PDF ก่อนส่ง" }
  - !tenant.lineUserId → 422 { error: "ผู้เช่ายังไม่มี LINE User ID กรุณาเพิ่มใน Rooms" }
  - bill.status === "PAID" → 409 { error: "บิลนี้ชำระแล้ว" }
- Build LINE messages:
  1. TextMessage with bill summary (use format from ticket spec)
  2. ImageMessage with originalContentUrl and previewImageUrl both set to `${process.env.NEXTAUTH_URL}/api/bills/${id}/qr`
- Call sendBillMessages(tenant.lineUserId, [textMsg, imageMsg])
- Update bill: status = "SENT", sentAt = new Date()
- Return updated bill

Update `app/(dashboard)/bills/[id]/page.tsx`:
- Add "ส่ง LINE" button that calls POST /api/bills/:id/send
- Show loading state during request
- Disable button if pdfStatus !== "DONE" or status === "PAID"
- Show tooltip explaining why button is disabled
- Show sentAt date if bill.sentAt exists
- Show success toast on success, error toast on failure

Rules:
- Do not implement LINE webhook or bulk send.
- Do not add features outside this ticket.
- Keep diff small. Explain tests run (including actual LINE message received) before finishing.
