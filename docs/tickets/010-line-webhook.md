# Ticket 010 — LINE Webhook (รับ Slip จากผู้เช่า)

## Goal

รับ event จาก LINE Messaging API — ผู้เช่าส่งรูป slip การโอนเงิน → ระบบบันทึก PaymentSlip ลง DB

## Scope

In scope:
- `POST /api/webhook/line` — LINE webhook endpoint
- ตรวจ signature ทุก request
- รับ image message → บันทึก PaymentSlip
- รับ follow event → log lineUserId ไว้เพื่อ link กับ tenant

Out of scope:
- Auto mark paid (เจ้าของต้อง verify เอง)
- Text message handling นอกจาก follow
- ระบบ complaint (Nice-to-have)

## Files likely to create or edit

- `app/api/webhook/line/route.ts`

## Business rules (Security-critical)

- **ต้องตรวจ** `X-Line-Signature` header ทุก request ก่อน process — ถ้าไม่ตรง → 401 ทันที
- ใช้ `validateSignature(body, channelSecret, signature)` จาก `@line/bot-sdk`
- Body ต้องอ่านเป็น raw string (ไม่ parse JSON ก่อนตรวจ signature)
- Webhook ต้อง return 200 เสมอหลัง process (ไม่งั้น LINE จะ retry)

## Event Handling

| Event Type | Action |
|---|---|
| `follow` | log lineUserId + reply "ขอบคุณที่ติดตาม กรุณาแจ้งเจ้าของห้องเพื่อลงทะเบียน LINE ID" |
| `message.image` | บันทึก PaymentSlip (ดู logic ด้านล่าง) |
| อื่นๆ | ไม่ทำอะไร, return 200 |

## Image Message Logic

เมื่อรับ image message:
1. ดึง `event.source.userId` (lineUserId ของผู้ส่ง)
2. หา Tenant ที่ `lineUserId` ตรงกัน (ถ้าไม่เจอ → skip, reply "ไม่พบข้อมูลผู้เช่า")
3. หา Bill ล่าสุดของ tenant ที่ `status = SENT` (ยังไม่ชำระ)
4. ถ้าเจอ: ดาวน์โหลด image content จาก LINE Content API แล้วบันทึก PaymentSlip:
   - `imageUrl` = เก็บเป็น base64 data URL หรือ upload ไป storage (MVP: เก็บใน local volume path)
   - `billId` = bill ที่เจอ
   - `submittedAt` = now
5. Reply: "ได้รับ slip แล้ว รอเจ้าของห้องตรวจสอบ"

## Implementation steps

1. สร้าง `app/api/webhook/line/route.ts`:
   - Export POST handler
   - อ่าน raw body เป็น string ก่อน (ใช้ `req.text()`)
   - ตรวจ signature ด้วย `validateSignature`
   - Parse JSON จาก raw body
   - Loop events และ handle ตาม type
2. ดาวน์โหลด image: ใช้ LINE Content API `client.getMessageContent(messageId)` → stream → buffer
3. บันทึก PaymentSlip ลง DB

## Tests required

- POST /api/webhook/line ไม่มี signature → 401
- POST /api/webhook/line signature ผิด → 401
- follow event → return 200, reply message ส่ง
- image event จาก tenant ที่มี SENT bill → PaymentSlip ถูกสร้าง
- image event จาก lineUserId ที่ไม่รู้จัก → 200 (ไม่ crash) + reply ไม่พบผู้เช่า

## Acceptance criteria

- [ ] Signature validation บังคับทุก request
- [ ] Invalid signature → 401
- [ ] Image message จากผู้เช่าที่มี SENT bill → PaymentSlip ใน DB
- [ ] Follow event → reply message ส่ง
- [ ] Webhook return 200 เสมอหลัง process สำเร็จ
- [ ] ไม่ crash ถ้า event type ไม่รู้จัก

## Prompt for Codex

Implement Ticket 010 only.

Create `app/api/webhook/line/route.ts` (POST):

IMPORTANT: Read the raw request body as text first (using `await request.text()`), THEN validate signature, THEN parse JSON. Never parse JSON before validating signature.

Signature validation:
```ts
import { validateSignature } from "@line/bot-sdk"
const rawBody = await request.text()
const signature = request.headers.get("x-line-signature") ?? ""
if (!validateSignature(rawBody, process.env.LINE_CHANNEL_SECRET!, signature)) {
  return new Response("Unauthorized", { status: 401 })
}
const body = JSON.parse(rawBody)
```

For each event in `body.events`:
- If `event.type === "follow"`: reply with TextMessage "ขอบคุณที่ติดตาม กรุณาแจ้งเจ้าของห้องเพื่อลงทะเบียน LINE ID ของคุณในระบบ"
- If `event.type === "message" && event.message.type === "image"`:
  1. Get lineUserId from event.source.userId
  2. Find Tenant where lineUserId matches and active = true
  3. If no tenant: reply "ไม่พบข้อมูลผู้เช่า กรุณาติดต่อเจ้าของห้อง" and continue
  4. Find the most recent Bill for that tenant where status = "SENT"
  5. If no such bill: reply "ไม่พบบิลที่รอชำระ" and continue
  6. Download image content using `client.getMessageContent(event.message.id)` — read stream into Buffer
  7. Convert buffer to base64 data URL: `data:image/jpeg;base64,${buffer.toString("base64")}`
  8. Create PaymentSlip: { billId: bill.id, imageUrl: dataUrl, submittedAt: new Date() }
  9. Reply: "ได้รับ slip แล้ว รอเจ้าของห้องตรวจสอบ"
- All other event types: do nothing

Always return `new Response("OK", { status: 200 })` after processing all events.

Rules:
- Never return non-200 after signature validation passes (LINE will retry on non-200).
- Do not implement auto mark-paid logic.
- Do not add features outside this ticket.
- Keep diff small. Explain tests run before finishing.

After implementation:
1. Run relevant checks (type-check, lint, tests).
2. Commit the changes.
3. Push branch `ai/010-line-webhook`.
4. Create a GitHub PR using `gh pr create`.
5. Do not merge the PR.
6. Include summary, tests run, risks, and ticket reference (Ticket 010) in the PR description.
