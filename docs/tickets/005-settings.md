# Ticket 005 — Settings API & UI

## Goal

อ่าน/บันทึก Settings (อัตราค่าน้ำ, ค่าจัดเก็บ, ค่าไฟ, บัญชีธนาคาร, PromptPay number)

## Scope

In scope:
- `GET /api/settings` + `PUT /api/settings`
- หน้า `/settings` พร้อม form
- Auto-create singleton row ถ้าไม่มีใน DB (upsert)

Out of scope:
- LINE credentials — อยู่ใน `.env` เท่านั้น ห้ามแสดงหรือแก้ไขผ่าน UI
- ไม่มี audit log

## Files likely to create or edit

- `app/api/settings/route.ts`
- `app/(dashboard)/settings/page.tsx`

## API Design

```
GET /api/settings   → Settings object
PUT /api/settings   → Settings (body: partial Settings fields)
```

## Business rules

- Settings มี 1 row เดียว (id: "singleton") — ใช้ `upsert`
- ตัวเลขทุกตัวต้องไม่ติดลบ — validate server-side
- API ต้องตรวจ session

## Implementation steps

1. สร้าง `app/api/settings/route.ts`:
   - GET: `db.settings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} })`
   - PUT: validate body (numbers ≥ 0, strings ไม่ undefined) แล้ว update
2. สร้าง `app/(dashboard)/settings/page.tsx`:
   - Fetch settings on load
   - Form sections:
     - **อัตราค่าสาธารณูปโภค**: ค่าน้ำ (บาท/หน่วย), ค่าจัดเก็บน้ำ (บาท/บิล), ค่าไฟ (บาท/หน่วย)
     - **บัญชีธนาคาร**: ชื่อบัญชี, เลขบัญชี
     - **PromptPay**: หมายเลข PromptPay (เลขบัตรประชาชน)
   - Save button → PUT /api/settings
   - Success/error toast

## Tests required

- GET /api/settings → return settings (สร้าง singleton ถ้าไม่มี)
- PUT /api/settings ด้วยค่าติดลบ → 400
- PUT /api/settings ด้วยค่าถูกต้อง → update สำเร็จ
- เข้า `/settings` โดยไม่ login → redirect

## Acceptance criteria

- [ ] `/settings` แสดงค่าปัจจุบันจาก DB
- [ ] แก้ไขและ save ได้ → ค่าใหม่แสดงทันที
- [ ] ตัวเลขติดลบ → validation error ในฟอร์ม
- [ ] ไม่มี LINE credentials field ใน UI

## Prompt for Codex

Implement Ticket 005 only.

Create `app/api/settings/route.ts`:
- GET: upsert Settings singleton (id: "singleton") and return it
- PUT: validate body (waterRatePerUnit, waterCollectionFee, elecRatePerUnit must be >= 0; string fields must be strings). Update and return updated settings. Return 400 with field errors if validation fails.
Both routes require authenticated session (return 401 otherwise).

Create `app/(dashboard)/settings/page.tsx`:
- Client component that fetches GET /api/settings on mount
- Form with sections:
  1. "อัตราค่าสาธารณูปโภค": waterRatePerUnit (label: "ค่าน้ำ บาท/หน่วย"), waterCollectionFee (label: "ค่าจัดเก็บน้ำ บาท/บิล"), elecRatePerUnit (label: "ค่าไฟ บาท/หน่วย")
  2. "บัญชีธนาคาร": bankAccountName, bankAccountNumber
  3. "PromptPay": promptpayNumber (label: "เลขบัตรประชาชน / เบอร์โทร")
- Submit calls PUT /api/settings, shows success toast on success, error message on failure
Use shadcn/ui Card, Input, Button, Label. Do NOT add any LINE-related fields.

Rules:
- Do not implement bill or LINE logic.
- Do not add features outside this ticket.
- Keep diff small. Explain tests run before finishing.
