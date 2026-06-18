# Ticket 021 — LINE Webhook Enhancement: Slip Auto-Pay + Bill Request + Linking Guard

## Goal

ขยาย webhook ที่มีอยู่ (`app/api/line/webhook/route.ts`) ให้รองรับ 4 สิ่ง:

1. **Image message** — ตรวจจับ slip การโอนเงิน → บันทึก PaymentSlip + mark bill PAID อัตโนมัติ
2. **"บิล" keyword** — tenant พิมพ์ "บิล" → bot ส่งสรุปบิล + QR PromptPay กลับ
3. **Follow event** — แนะนำวิธีลงทะเบียนห้อง
4. **Room linking guard** — ป้องกัน overwrite LINE ID ที่ผูกไว้แล้วกับ LINE อื่น

## Scope

In scope:
- อัปเดต `app/api/line/webhook/route.ts` ให้ handle เหตุการณ์ใหม่ทั้ง 4 ข้อ
- สร้าง `tests/line-webhook.test.ts`

Out of scope:
- UI สำหรับดู PaymentSlip (ใช้ dashboard ที่มีอยู่)
- Bulk bill send
- Admin notification เมื่อรับ slip (Nice-to-have ภายหลัง)
- ตรวจสอบ slip จริงด้วย OCR หรือ external API

## Files to edit / create

- `app/api/line/webhook/route.ts` (แก้ไข)
- `tests/line-webhook.test.ts` (ใหม่)

## Business Rules

### Follow Event
- ตอบกลับ: `"ยินดีต้อนรับ! 🏠 กรุณาส่งหมายเลขห้องของคุณ (เช่น 101) เพื่อลงทะเบียน LINE ของคุณกับระบบ"`

### Room Linking (text message = เลขห้อง)
ปัจจุบัน: ถ้าไม่ใช่ "บิล" → ถือว่าเป็นเลขห้อง

Logic เดิม + เพิ่มการตรวจ:
1. หาห้องจากเลขห้อง → ถ้าไม่เจอ: `"ไม่พบห้อง {number} กรุณาส่งหมายเลขห้องของคุณ เช่น 101"`
2. หา tenant ที่ `active = true` ในห้องนั้น → ถ้าไม่มี: `"ห้อง {number} ไม่มีผู้เช่าอยู่ กรุณาติดต่อเจ้าของห้อง"`
3. **[ใหม่]** ถ้า `tenant.lineUserId` มีค่าและ **ไม่ตรงกับ** `userId` ของคนส่ง: `"ห้อง {number} มี LINE อื่นลิงก์อยู่แล้ว กรุณาติดต่อเจ้าของห้อง"`
4. ถ้า `tenant.lineUserId === userId` (ลิงก์ซ้ำ): `"✅ ห้อง {number} ({tenant.name}) ลิงก์ LINE ของคุณไว้แล้ว"`
5. ถ้ายังไม่มี lineUserId: update + ตอบกลับ `"✅ ลิงก์ห้อง {number} ({tenant.name}) เรียบร้อยแล้ว"`

### "บิล" Keyword (text message = "บิล")
1. หา tenant จาก `lineUserId = event.source.userId` → ถ้าไม่เจอ: `"ไม่พบข้อมูลผู้เช่า กรุณาลงทะเบียนห้องก่อน"`
2. หา Bill ล่าสุดที่ `status = SENT` ของ tenant นั้น → ถ้าไม่มี: `"ไม่พบบิลที่รอชำระ"`
3. ดึง Settings (promptpayNumber, bankAccountName, bankAccountNumber)
4. ส่ง messages 2 รายการ:
   - **Text**: สรุปบิล (format เดียวกับ `buildTextMessage` ใน send/route.ts)
   - **Image** (ถ้า `NEXTAUTH_URL` เป็น HTTPS): `{ type: "image", originalContentUrl: "${appUrl}/api/bills/${bill.id}/qr", previewImageUrl: "..." }`

### Image Message (Slip Detection)
1. หา tenant จาก `lineUserId = event.source.userId` → ถ้าไม่เจอ: `"ไม่พบข้อมูลผู้เช่า กรุณาลงทะเบียนห้องก่อน"`
2. หา Bill ล่าสุดที่ `status = SENT` (orderBy: createdAt desc) → ถ้าไม่มี: `"ไม่พบบิลที่รอชำระ"`
3. ดาวน์โหลด image จาก LINE Content API:
   ```ts
   const client = LineBotClient.fromChannelAccessToken({ channelAccessToken })
   const stream = await client.getMessageContent(event.message.id)
   // read stream → Buffer → base64 data URL
   const imageUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`
   ```
4. บันทึก PaymentSlip:
   ```ts
   await db.paymentSlip.create({
     data: { billId: bill.id, imageUrl, submittedAt: new Date() }
   })
   ```
5. Mark bill PAID:
   ```ts
   await db.bill.update({
     where: { id: bill.id },
     data: { status: "PAID", paidAt: new Date() }
   })
   ```
6. ตอบกลับ: `"✅ รับ slip แล้ว บิลเดือน {month}/{year} ถูกบันทึกว่าชำระแล้ว ขอบคุณ!"`

### Routing Logic (text messages)
```
text.trim().toLowerCase() === "บิล"  → handleBillRequest
else                                  → handleRoomLink (เลขห้อง)
```

### Error Handling
- ทุก handler ต้อง try/catch ภายใน — ถ้า error ให้ log แต่ไม่ throw (webhook ต้อง return 200 เสมอ)
- ถ้า reply ไม่ได้ (replyToken expired) → log warning, ไม่ crash

## Implementation Steps

1. Refactor `route.ts` แบ่งเป็น handler functions:
   - `handleFollow(event, token)`
   - `handleRoomLink(event, token)` — logic เดิม + guard ใหม่
   - `handleBillRequest(event, token, appUrl)`
   - `handleSlip(event, token)` — ใหม่

2. อัปเดต event dispatcher:
   ```ts
   for (const event of payload.events) {
     if (event.type === "follow") await handleFollow(event, token)
     else if (event.type === "message" && event.message.type === "text") {
       const text = event.message.text.trim().toLowerCase()
       if (text === "บิล") await handleBillRequest(event, token, appUrl)
       else await handleRoomLink(event, token)
     } else if (event.type === "message" && event.message.type === "image") {
       await handleSlip(event, token)
     }
   }
   ```

3. สำหรับ `handleBillRequest` — reuse `buildTextMessage` logic (extract เป็น util หรือ copy ที่จำเป็น)

4. สำหรับ `handleSlip` — read stream จาก `client.getMessageContent()`:
   ```ts
   const chunks: Buffer[] = []
   for await (const chunk of stream) chunks.push(chunk)
   const buffer = Buffer.concat(chunks)
   ```

## Tests Required

| Test | Expected |
|------|----------|
| follow event | return 200, replyMessage called with welcome text |
| text "101" → room exists, no active tenant | return 200, reply "ห้องไม่มีผู้เช่า" |
| text "101" → room exists, tenant has different lineUserId | return 200, reply "มี LINE อื่นลิงก์อยู่แล้ว" |
| text "101" → room exists, tenant.lineUserId === userId (ลิงก์ซ้ำ) | return 200, reply "ลิงก์ไว้แล้ว" |
| text "101" → room exists, tenant ไม่มี lineUserId | return 200, tenant.lineUserId updated, reply success |
| text "บิล" → lineUserId ไม่รู้จัก | return 200, reply "ไม่พบข้อมูลผู้เช่า" |
| text "บิล" → tenant มีแต่ไม่มี SENT bill | return 200, reply "ไม่พบบิลที่รอชำระ" |
| text "บิล" → tenant มี SENT bill | return 200, replyMessage called with 2 messages |
| image → lineUserId ไม่รู้จัก | return 200, reply "ไม่พบข้อมูลผู้เช่า" |
| image → tenant มี SENT bill | return 200, PaymentSlip created, Bill status = PAID |
| image → tenant ไม่มี SENT bill | return 200, reply "ไม่พบบิลที่รอชำระ" |
| invalid signature | return 401 |
| unknown event type | return 200, ไม่ crash |

## Acceptance Criteria

- [ ] Signature validation ยังคงบังคับทุก request
- [ ] Follow event → reply พร้อมคำแนะนำ
- [ ] Room linking: ป้องกัน overwrite LINE ID ที่ต่างกัน
- [ ] "บิล" keyword → ส่งสรุปบิล + QR กลับใน LINE
- [ ] Image message → PaymentSlip ใน DB + bill.status = PAID
- [ ] Webhook return 200 เสมอหลัง signature ผ่าน
- [ ] ไม่ crash ถ้าเกิด error ภายใน handler

## Prompt for Codex

Implement Ticket 021 only.

Update `app/api/line/webhook/route.ts`. The file already exists — read it before editing.

The existing file handles:
- Signature validation (keep this exactly as-is)
- Text message → room linking (update as described below)

**Add these handlers:**

### handleFollow
Reply: `"ยินดีต้อนรับ! 🏠 กรุณาส่งหมายเลขห้องของคุณ (เช่น 101) เพื่อลงทะเบียน LINE ของคุณกับระบบ"`

### handleRoomLink (update existing handleMessage)
After finding the active tenant, add these checks BEFORE updating:
1. If `tenant.lineUserId` exists AND `tenant.lineUserId !== userId`: reply `"ห้อง ${roomNumber} มี LINE อื่นลิงก์อยู่แล้ว กรุณาติดต่อเจ้าของห้อง"` and return
2. If `tenant.lineUserId === userId`: reply `"✅ ห้อง ${roomNumber} (${tenant.name}) ลิงก์ LINE ของคุณไว้แล้ว"` and return
3. If no active tenant: reply `"ห้อง ${roomNumber} ไม่มีผู้เช่าอยู่ กรุณาติดต่อเจ้าของห้อง"` (update existing "ไม่พบห้อง" message to distinguish cases)

### handleBillRequest (new — triggered when text.trim().toLowerCase() === "บิล")
```ts
async function handleBillRequest(event: webhook.MessageEvent, token: string, appUrl: string)
```
1. Get userId from event.source.userId — if missing, return
2. Find tenant where lineUserId = userId and active = true — if not found: reply "ไม่พบข้อมูลผู้เช่า กรุณาลงทะเบียนห้องก่อน"
3. Find most recent Bill where tenantId = tenant.id AND status = "SENT" (orderBy: createdAt desc, take: 1)
   — if not found: reply "ไม่พบบิลที่รอชำระ"
4. Fetch Settings (findUnique where id = "singleton")
5. Build text message:
```
[ห้อง {roomNumber}] บิลค่าน้ำ-ค่าไฟ เดือน {month}/{year}

ค่าน้ำ: {waterUsage} หน่วย × {waterRatePerUnit} + {waterCollectionFee} บาท = {waterTotal} บาท
ค่าไฟ: {elecUsage} หน่วย × {elecRatePerUnit} = {elecTotal} บาท
ค่าเช่า: {rent} บาท
รวมทั้งหมด: {total} บาท

ธนาคาร: {bankAccountName} เลขที่ {bankAccountNumber}
📄 PDF: {appUrl}{bill.pdfUrl}  ← only if bill.pdfUrl exists
```
6. Build messages array:
   - Always: TextMessage with text above
   - If `appUrl.startsWith("https://")`: also add ImageMessage with `originalContentUrl = previewImageUrl = "${appUrl}/api/bills/${bill.id}/qr"`
7. Call `sendBillMessages(userId, messages)` — import from `@/lib/line`

### handleSlip (new — triggered when event.message.type === "image")
```ts
async function handleSlip(event: webhook.MessageEvent, token: string)
```
1. Get userId from event.source.userId — if missing, return
2. Find tenant where lineUserId = userId and active = true — if not found: reply "ไม่พบข้อมูลผู้เช่า กรุณาลงทะเบียนห้องก่อน"
3. Find most recent Bill where tenantId = tenant.id AND status = "SENT" (orderBy: createdAt desc, take: 1)
   — if not found: reply "ไม่พบบิลที่รอชำระ"; return
4. Download image from LINE Content API:
   ```ts
   const client = LineBotClient.fromChannelAccessToken({ channelAccessToken: token })
   const stream = await client.getMessageContent(event.message.id)
   const chunks: Buffer[] = []
   for await (const chunk of stream) chunks.push(Buffer.from(chunk))
   const buffer = Buffer.concat(chunks)
   const imageUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`
   ```
5. Create PaymentSlip: `db.paymentSlip.create({ data: { billId: bill.id, imageUrl, submittedAt: new Date() } })`
6. Update Bill: `db.bill.update({ where: { id: bill.id }, data: { status: "PAID", paidAt: new Date() } })`
7. Reply: `"✅ รับ slip แล้ว บิลเดือน ${bill.month}/${bill.year} ถูกบันทึกว่าชำระแล้ว ขอบคุณ! 🙏"`

**Update the event dispatcher:**
```ts
await Promise.all(
  payload.events.map(async (event) => {
    try {
      if (event.type === "follow") {
        await handleFollow(event as webhook.FollowEvent, channelAccessToken)
      } else if (event.type === "message") {
        const msgEvent = event as webhook.MessageEvent
        if (msgEvent.message.type === "text") {
          const text = (msgEvent.message as webhook.TextMessageContent).text.trim().toLowerCase()
          if (text === "บิล") {
            await handleBillRequest(msgEvent, channelAccessToken, appUrl)
          } else {
            await handleRoomLink(msgEvent, channelAccessToken)
          }
        } else if (msgEvent.message.type === "image") {
          await handleSlip(msgEvent, channelAccessToken)
        }
      }
    } catch (err) {
      console.error("[webhook handler error]", err)
    }
  })
)
```

**Add appUrl to the POST handler:**
```ts
const appUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? ""
```

**Important rules:**
- Wrap each handler in try/catch — never let a handler throw (webhook must always return 200)
- Each handler include to tenant: `{ room: true }` to get room.number
- Bill includes: `{ room: true }` for bill request handler
- Never return non-200 after signature passes
- Do not add features outside this ticket

**Tests:** Create `tests/line-webhook.test.ts` covering all cases in the tests table above. Use `vi.mock` for `@/lib/db`, `@line/bot-sdk`, and `@/lib/line`. Mock `LineBotClient.fromChannelAccessToken` to control `replyMessage`, `getMessageContent` calls.

After implementation:
1. Run `npx tsc --noEmit`, `npx vitest run tests/line-webhook.test.ts`
2. Fix any type errors
3. Commit the changes
4. Push branch `ai/021-line-webhook-enhancement`
5. Create a GitHub PR using `gh pr create`
6. Do not merge the PR
7. Include summary, tests run, risks, and ticket reference (Ticket 021) in the PR description
