# Ticket 004 — Room & Tenant CRUD (API + UI)

## Goal

จัดการห้องและผู้เช่า — เพิ่ม/แก้ไข/deactivate ผ่าน REST API และหน้า `/rooms`

## Scope

In scope:
- API routes: Room (list, create, update, delete) + Tenant (create, update, deactivate)
- หน้า `/rooms` แสดงตาราง + modal เพิ่ม/แก้ไข
- Validate input server-side
- ห้ามลบห้องที่มีบิล

Out of scope:
- ยังไม่มี bill creation
- ไม่มี LINE User ID linking อัตโนมัติ (กรอก manual)

## Files likely to create or edit

- `app/api/rooms/route.ts`
- `app/api/rooms/[id]/route.ts`
- `app/api/tenants/route.ts`
- `app/api/tenants/[id]/route.ts`
- `app/(dashboard)/rooms/page.tsx`
- `components/RoomTable.tsx`
- `components/RoomDialog.tsx`

## API Design

```
GET    /api/rooms              → Room[] (with tenant)
POST   /api/rooms              → Room (body: { number, description?, rent })
PUT    /api/rooms/:id          → Room (body: { number?, description?, rent? })
DELETE /api/rooms/:id          → 204 | 409 ถ้ามีบิล

POST   /api/tenants            → Tenant (body: { roomId, name, phone?, lineUserId? })
PUT    /api/tenants/:id        → Tenant (body: { name?, phone?, lineUserId?, active? })
```

## Business rules

- Room.number ต้อง unique — duplicate → 409
- DELETE /api/rooms/:id ถ้ามี Bill ที่เชื่อมอยู่ → 409 + message "ไม่สามารถลบห้องที่มีประวัติบิล"
- Tenant: 1 ห้อง = 1 tenant (active) — ถ้าห้องมี active tenant อยู่แล้ว ห้าม create อีก
- Deactivate tenant (`active: false`) ไม่ลบข้อมูล
- API routes ทุกเส้นต้องตรวจ session (auth guard)

## Notes from schema review (follow-up จาก PR #2)

- **Partial index ไม่ได้อยู่ใน schema.prisma** — rule "1 active tenant ต่อห้อง" บังคับโดย PostgreSQL partial index `tenant_room_active` ที่อยู่ใน migration SQL เท่านั้น Prisma client ไม่รู้จัก constraint นี้ ดังนั้น POST /api/tenants ต้องตรวจ active tenant เองก่อน insert เสมอ อย่าพึ่ง DB error แทน application logic
- **Error code เมื่อ index ชน** — ถ้า race condition ทำให้ insert ชน partial index จะได้ Prisma error code `P2002` (unique constraint) ต้องดักจับและ return 409

## Implementation steps

1. สร้าง `app/api/rooms/route.ts` — GET (include tenant) + POST
2. สร้าง `app/api/rooms/[id]/route.ts` — PUT + DELETE (ตรวจ bills ก่อน)
3. สร้าง `app/api/tenants/route.ts` — POST (ตรวจ active tenant ซ้ำ)
4. สร้าง `app/api/tenants/[id]/route.ts` — PUT
5. สร้าง `components/RoomTable.tsx` — ตารางแสดง room + tenant info + action buttons
6. สร้าง `components/RoomDialog.tsx` — modal form สำหรับ create/edit room + tenant
7. สร้าง `app/(dashboard)/rooms/page.tsx` — รวม table + dialog + fetch data

## Tests required

- POST /api/rooms สร้างห้องได้
- POST /api/rooms number ซ้ำ → 409
- DELETE /api/rooms/:id ที่มีบิล → 409
- PUT /api/tenants/:id deactivate ได้
- เข้า `/rooms` โดยไม่ login → redirect `/login`

## Acceptance criteria

- [ ] ตารางแสดงห้องทั้งหมดพร้อม tenant name, LINE ID, phone, status
- [ ] เพิ่มห้องใหม่ได้ผ่าน dialog
- [ ] แก้ไข tenant (ชื่อ, phone, LINE User ID) ได้
- [ ] Deactivate tenant ได้ (ห้องยังอยู่ tenant แสดงเป็น inactive)
- [ ] ลบห้องที่ไม่มีบิล → สำเร็จ; ลบห้องที่มีบิล → แสดง error
- [ ] ทุก API validate session

## Prompt for Codex

Implement Ticket 004 only.

Create REST API routes:

`app/api/rooms/route.ts`:
- GET: return all rooms with their tenant (include: { tenant: true }), ordered by number
- POST: create room (body: { number: string, description?: string, rent: number }). Validate unique number — return 409 if duplicate.

`app/api/rooms/[id]/route.ts`:
- PUT: update room fields
- DELETE: check if any Bills exist for this room. If yes, return 409 { error: "ไม่สามารถลบห้องที่มีประวัติบิล" }. If no, delete room.

`app/api/tenants/route.ts`:
- POST: create tenant (body: { roomId, name, phone?, lineUserId? }). Check room has no active tenant already — return 409 if conflict.

`app/api/tenants/[id]/route.ts`:
- PUT: update tenant fields (name, phone, lineUserId, active)

All API routes must check for a valid session and return 401 if not authenticated.

Create `app/(dashboard)/rooms/page.tsx` that:
- Fetches and displays all rooms in a table
- Columns: ห้อง (number), ผู้เช่า (tenant name), LINE User ID, เบอร์โทร, ค่าเช่า, สถานะ, Actions
- Has an "เพิ่มห้อง" button that opens a dialog/modal
- Each row has Edit (tenant info) and Delete (room) buttons

Use shadcn/ui Table, Dialog, Form, Input, Button components.

Rules:
- Keep diff small. Do not implement bill logic.
- Validate all inputs server-side.
- Do not add features outside this ticket.
- Explain tests run before finishing.

Note: Ticket already completed and merged in PR #5. Do not reopen or recreate
branch `ai/004-room-tenant-crud`.
