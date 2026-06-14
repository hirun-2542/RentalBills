# Ticket 011 — Dashboard, Bills UI, New Bill Form

## Goal

สร้าง UI หลัก 3 หน้า: Dashboard สรุปสถานะ, Bills list เดือนปัจจุบัน, New Bill form กรอก meter readings

## Scope

In scope:
- `/` (Dashboard): stats cards + quick links
- `/bills`: list บิลเดือน/ปีที่เลือก + action buttons
- `/bills/new`: form กรอก meter readings ทุกห้อง + submit สร้างบิล

Out of scope:
- `/bills/:id` (bill detail) — ทำแล้วบางส่วนใน Ticket 007 + 009
- History (Ticket 012)

## Files likely to create or edit

- `app/(dashboard)/page.tsx`
- `app/(dashboard)/bills/page.tsx`
- `app/(dashboard)/bills/new/page.tsx`
- `components/MeterForm.tsx`
- `components/PaymentBadge.tsx`

## Dashboard (`/`)

แสดง:
- Stats cards: "ส่งแล้ว X ห้อง", "รอชำระ X ห้อง", "ชำระแล้ว X ห้อง" (เดือนปัจจุบัน)
- Alert ถ้ายังไม่มีบิลเดือนนี้ + ปุ่ม "สร้างบิลเดือนนี้" → `/bills/new`
- Quick action buttons: "ดูบิลทั้งหมด", "จัดการห้อง", "ตั้งค่า"
- รอบบิลถัดไป: "1 {เดือน+1}/{ปี}"

## Bills List (`/bills`)

- Month/Year selector (default: เดือนปัจจุบัน)
- ตาราง: ห้อง, ผู้เช่า, ยอดรวม, สถานะ (badge), วันส่ง, Action buttons
- Action buttons per row:
  - "ดูรายละเอียด" → `/bills/:id`
  - "ส่ง LINE" (ถ้า status DRAFT/SENT + pdfStatus DONE)
  - "Mark Paid" (ถ้า status ≠ PAID)
- Badge colors: DRAFT=gray, SENT=blue, PAID=green

## New Bill Form (`/bills/new`)

- Header: "สร้างบิลเดือน {month}/{year}"
- Month/Year selector ด้านบน (default: เดือนปัจจุบัน)
- ตาราง 1 row per active room + tenant:
  - ห้อง, ผู้เช่า, มิเตอร์น้ำก่อน, มิเตอร์น้ำหลัง, มิเตอร์ไฟก่อน, มิเตอร์ไฟหลัง
  - คำนวณ usage real-time (ใน UI) และแสดงใต้ input
- ปุ่ม "สร้างบิล" → POST /api/bills → redirect ไป `/bills`
- Validation: currReading < prevReading → inline error

## Implementation steps

1. สร้าง `components/PaymentBadge.tsx` — Badge component สำหรับ BillStatus
2. สร้าง `app/(dashboard)/page.tsx` — fetch stats จาก GET /api/bills (เดือนปัจจุบัน)
3. สร้าง `app/(dashboard)/bills/page.tsx` — fetch + แสดง bills table
4. สร้าง `components/MeterForm.tsx` — row component สำหรับ meter input
5. สร้าง `app/(dashboard)/bills/new/page.tsx` — fetch rooms + tenant, render MeterForm per room

## Tests required

- Dashboard แสดง stats ถูกต้อง (ทดสอบด้วย seed data)
- New bill form: input currReading < prevReading → แสดง inline error
- New bill form submit → POST /api/bills → redirect `/bills`
- Bills list filter month/year → แสดงบิลถูกต้อง

## Acceptance criteria

- [ ] Dashboard แสดง stats 3 cards (ส่งแล้ว/รอชำระ/ชำระแล้ว)
- [ ] Dashboard แสดง alert + ปุ่ม create ถ้าไม่มีบิลเดือนนี้
- [ ] Bills list แสดง bill table พร้อม status badge
- [ ] Bills list filter month/year ได้
- [ ] New bill form แสดง 1 row ต่อห้อง (active tenant เท่านั้น)
- [ ] Meter validation ใน UI (real-time + on submit)
- [ ] Submit สำเร็จ → redirect `/bills`

## Prompt for Codex

Implement Ticket 011 only.

Create `components/PaymentBadge.tsx`:
A Badge component that takes `status: "DRAFT" | "SENT" | "PAID"` and renders a colored badge (DRAFT=gray, SENT=blue, PAID=green) using shadcn/ui Badge.

Create `app/(dashboard)/page.tsx` (Dashboard):
- Server component that fetches bills for current month/year via db query
- Compute counts: sent (status SENT), pending (status DRAFT + SENT), paid (status PAID)
- Show 3 stat cards using shadcn/ui Card
- If no bills exist for current month, show an alert with "ยังไม่มีบิลเดือนนี้" and a button linking to /bills/new
- Show next billing cycle text: "รอบบิลถัดไป: 1 {nextMonth}/{year}"
- Quick links to /bills, /rooms, /settings

Create `app/(dashboard)/bills/page.tsx`:
- Client component with month/year selectors (number inputs or select dropdowns, default to current month/year)
- Fetch GET /api/bills?month=&year= when selectors change
- Display results in a table: ห้อง | ผู้เช่า | ยอดรวม | สถานะ | วันที่ส่ง | Actions
- Actions: "ดูรายละเอียด" link to /bills/:id, "Mark Paid" button (POST /api/bills/:id/paid)
- Use PaymentBadge for status column

Create `components/MeterForm.tsx`:
- Receives: `room: Room & { tenant: Tenant }` and `index: number`
- Shows inputs: waterPrevReading, waterCurrReading, elecPrevReading, elecCurrReading
- Computes and displays waterUsage and elecUsage in real-time
- Shows inline error if currReading < prevReading for either utility

Create `app/(dashboard)/bills/new/page.tsx`:
- Server component that fetches all rooms with active tenants
- Renders a form with one MeterForm row per room
- Month/year selectors at top (default current month/year)
- "สร้างบิล" submit button
- On submit: POST /api/bills with collected readings → on success redirect to /bills
- Shows server-side error messages if any rooms fail

Rules:
- Do not re-implement bill detail page (exists from Ticket 007/009 work).
- Do not add history page (Ticket 012).
- Keep diff small. Explain tests run before finishing.

After implementation:
1. Run relevant checks (type-check, lint, tests).
2. Commit the changes.
3. Push branch `ai/011-dashboard-bills-ui`.
4. Create a GitHub PR using `gh pr create`.
5. Do not merge the PR.
6. Include summary, tests run, risks, and ticket reference (Ticket 011) in the PR description.
