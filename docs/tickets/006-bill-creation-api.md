# Ticket 006 — Bill Creation API

## Goal

สร้าง API สำหรับสร้างบิลทุกห้องพร้อมกัน (bulk) สำหรับ month/year ที่กำหนด พร้อม business logic คำนวณยอดและ snapshot rate

## Scope

In scope:
- `POST /api/bills` — bulk create bills
- `GET /api/bills` — list bills (filter by month, year, status)
- `GET /api/bills/:id` — get single bill
- `PUT /api/bills/:id` — update meter readings (DRAFT only)
- `DELETE /api/bills/:id` — delete bill (DRAFT only)
- `POST /api/bills/:id/paid` — mark as paid (manual)

Out of scope:
- PDF generation (Ticket 007)
- LINE sending (Ticket 009)
- UI (Ticket 011)

## Files likely to create or edit

- `app/api/bills/route.ts`
- `app/api/bills/[id]/route.ts`
- `app/api/bills/[id]/paid/route.ts`

## API Design

```
POST /api/bills
Body: {
  month: number,       // 1–12
  year: number,
  bills: [{
    roomId: string,
    waterPrevReading: number,
    waterCurrReading: number,
    elecPrevReading: number,
    elecCurrReading: number,
  }]
}
Response: Bill[]

GET /api/bills?month=&year=&status=   → Bill[] with tenant + room

GET /api/bills/:id                    → Bill with tenant, room, paymentSlips

PUT /api/bills/:id
Body: { waterPrevReading?, waterCurrReading?, elecPrevReading?, elecCurrReading? }
Only allowed when status === DRAFT

DELETE /api/bills/:id                 → 204 | 409 ถ้า status !== DRAFT

POST /api/bills/:id/paid              → Bill (status: PAID, paidAt: now)
```

## Business rules (สำคัญ)

- `waterUsage = waterCurrReading - waterPrevReading` — ถ้า < 0 → reject 400 พร้อม `{ roomId, error: "ค่ามิเตอร์น้ำไม่ถูกต้อง (ค่าปัจจุบันน้อยกว่าค่าก่อนหน้า)" }`
- `elecUsage = elecCurrReading - elecPrevReading` — ถ้า < 0 → reject 400 เช่นกัน
- Rate snapshot จาก Settings ณ เวลาสร้างบิล (ไม่ใช่ค่าปัจจุบัน):
  - `waterTotal = (waterUsage × waterRatePerUnit) + waterCollectionFee`
  - `elecTotal = elecUsage × elecRatePerUnit`
  - `rent` snapshot จาก `room.rent`
  - `total = waterTotal + elecTotal + rent`
- Duplicate (tenantId + month + year) → 409 per room พร้อมระบุห้องที่ duplicate
- ห้องที่ไม่มี active tenant → skip หรือ return error แยก
- Bulk create: transaction — ถ้า error บางห้อง rollback ทั้งหมด

## Notes from schema review (follow-up จาก PR #2)

- **Decimal serialization** — fields เงินทุก field ใน Bill และ Settings (เช่น `waterRatePerUnit`, `total`, `rent`) คืนค่าเป็น `Prisma.Decimal` object ไม่ใช่ `number` ธรรมดา ถ้า `res.json(bill)` โดยตรงจะได้ค่าผิดหรือ serialize ไม่ออก ต้องแปลงก่อน เช่น:
  ```ts
  // ❌ บั๊ก: Decimal object ไม่ serialize เป็น JSON ตรงๆ
  return NextResponse.json(bill)

  // ✅ ถูก: แปลง Decimal เป็น number ก่อน return
  return NextResponse.json(JSON.parse(JSON.stringify(bill)))
  // หรือใช้ helper แปลงทีละ field: bill.total.toNumber()
  ```
- **tenantId / roomId consistency** — `Bill` เก็บทั้ง `tenantId` และ `roomId` แยกกัน DB ไม่บังคับว่าทั้งสองต้องชี้ไปห้องเดียวกัน POST handler ต้องดึง active tenant จาก `roomId` แล้วใช้ `tenant.id` เป็น `tenantId` เสมอ ห้ามรับ `tenantId` จาก client โดยตรง

## Implementation steps

1. สร้าง `app/api/bills/route.ts`:
   - GET: query bills พร้อม filter + include tenant, room
   - POST: validate input, fetch Settings snapshot, คำนวณยอดทุกห้อง, สร้างใน DB transaction
2. สร้าง `app/api/bills/[id]/route.ts`:
   - GET: fetch bill + relations
   - PUT: ตรวจ DRAFT status, recalculate ยอด
   - DELETE: ตรวจ DRAFT status
3. สร้าง `app/api/bills/[id]/paid/route.ts`:
   - POST: set status = PAID, paidAt = now (ถ้า status = SENT หรือ DRAFT)

## Tests required

- POST /api/bills สร้างบิลครบทุกห้องในครั้งเดียว
- waterCurrReading < waterPrevReading → 400 พร้อม error message ระบุห้อง
- สร้างบิลซ้ำ (month/year เดิม) → 409
- Rate snapshot ถูกต้อง — เปลี่ยน Settings หลัง create บิล → bill ยังเก็บ rate เดิม
- PUT /api/bills/:id ที่ status SENT → 409
- DELETE /api/bills/:id ที่ status SENT → 409

## Acceptance criteria

- [ ] POST /api/bills สร้าง bill ทุกห้องใน transaction เดียว
- [ ] Negative meter reading → 400 พร้อม message ชัดเจนระบุห้อง
- [ ] Duplicate month/year → 409
- [ ] Rate, rent snapshot ถูกต้อง (ไม่เปลี่ยนตาม Settings ทีหลัง)
- [ ] `waterTotal = (usage × rate) + collectionFee` คำนวณถูก
- [ ] GET /api/bills filter ตาม month, year, status ได้
- [ ] Mark paid ได้จาก DRAFT หรือ SENT

## Prompt for Codex

Implement Ticket 006 only.

Create `app/api/bills/route.ts`:

GET handler: fetch all bills filtered by optional query params (month, year, status). Include tenant and room relations. Return array ordered by room number.

POST handler (bulk create):
- Body: `{ month: number, year: number, bills: Array<{ roomId, waterPrevReading, waterCurrReading, elecPrevReading, elecCurrReading }> }`
- Validate month (1-12), year, and for each bill entry:
  - `waterUsage = waterCurrReading - waterPrevReading` — if < 0, collect error for that room
  - `elecUsage = elecCurrReading - elecPrevReading` — if < 0, collect error for that room
  - If any validation errors exist, return 400 with array of errors
- Fetch Settings singleton for rate snapshot
- For each roomId: fetch room (for rent snapshot) and room's active tenant (skip room if no active tenant)
- Calculate:
  - `waterTotal = (waterUsage * settings.waterRatePerUnit) + settings.waterCollectionFee`
  - `elecTotal = elecUsage * settings.elecRatePerUnit`
  - `total = waterTotal + elecTotal + room.rent`
- Create all bills in a single `db.$transaction([...])` call
- Handle unique constraint violation (P2002) → return 409 identifying which rooms are duplicates

Create `app/api/bills/[id]/route.ts`:
- GET: fetch bill with tenant, room, paymentSlips
- PUT: only if bill.status === DRAFT. Recalculate waterUsage, elecUsage, totals from new readings using the bill's snapshotted rates (NOT current Settings). Return 409 if not DRAFT.
- DELETE: only if bill.status === DRAFT. Return 409 otherwise.

Create `app/api/bills/[id]/paid/route.ts`:
- POST: set status = PAID, paidAt = new Date(). Allow from DRAFT or SENT. Return updated bill.

All routes require authenticated session.

Rules:
- Do not implement PDF generation or LINE sending.
- Do not add UI.
- Do not add features outside this ticket.
- Keep diff small. Explain tests run before finishing.

After implementation:
1. Run relevant checks (type-check, lint, tests).
2. Commit the changes.
3. Push branch `ai/006-bill-creation-api`.
4. Create a GitHub PR using `gh pr create`.
5. Do not merge the PR.
6. Include summary, tests run, risks, and ticket reference (Ticket 006) in the PR description.
