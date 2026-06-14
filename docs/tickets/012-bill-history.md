# Ticket 012 — Bill History UI

## Goal

หน้า `/history` สำหรับดูบิลย้อนหลัง filter ตาม month/year

## Scope

In scope:
- หน้า `/history` พร้อม month/year filter
- แสดง bill list + สถานะ + ยอด + link ไป bill detail

Out of scope:
- Export CSV/PDF รายเดือน
- กราฟหรือ analytics

## Files likely to create or edit

- `app/(dashboard)/history/page.tsx`

## UI Design

- Month/Year selector (default: เดือนก่อนหน้า)
- Summary: ยอดรวมเดือนนั้น, จำนวนชำระแล้ว/ยังไม่ชำระ
- ตาราง: ห้อง, ผู้เช่า, ค่าน้ำ, ค่าไฟ, ค่าเช่า, รวม, สถานะ, Link ดูบิล
- ถ้าไม่มีบิลเดือนนั้น → แสดง "ไม่มีข้อมูลบิลสำหรับเดือนนี้"

## Implementation steps

1. สร้าง `app/(dashboard)/history/page.tsx`:
   - Client component พร้อม month/year selectors
   - Fetch GET /api/bills?month=&year= เมื่อ filter เปลี่ยน
   - คำนวณ summary (total amount, paid count, unpaid count)
   - แสดงตาราง + empty state

## Tests required

- เลือก month/year ที่มีบิล → แสดงถูกต้อง
- เลือก month/year ที่ไม่มีบิล → แสดง empty state

## Acceptance criteria

- [ ] Filter month/year ทำงานได้
- [ ] Summary ยอดรวมถูกต้อง
- [ ] ตารางแสดง bill ครบ + link ไป detail
- [ ] Empty state แสดงเมื่อไม่มีข้อมูล

## Prompt for Codex

Implement Ticket 012 only.

Create `app/(dashboard)/history/page.tsx`:
- Client component
- Month (1-12) and year (number input, default current year) selectors. Default to previous month.
- Fetch GET /api/bills?month={month}&year={year} when selectors change
- Compute summary from results: total amount (sum of bill.total), paid count, unpaid count
- Show 3 summary cards above the table
- Table columns: ห้อง | ผู้เช่า | ค่าน้ำ | ค่าไฟ | ค่าเช่า | รวม | สถานะ | ดูรายละเอียด
- Use PaymentBadge for status. Link "ดูรายละเอียด" to /bills/:id
- If no bills returned, show empty state: "ไม่มีข้อมูลบิลสำหรับเดือนที่เลือก"

Rules:
- Reuse PaymentBadge from Ticket 011.
- Do not add export or analytics features.
- Keep diff small. Explain tests run before finishing.
