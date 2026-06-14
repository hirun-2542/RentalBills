# Ticket 002 — Database Schema & Migrations

## Goal

สร้าง Prisma schema ครบทุก model + migration + seed data พร้อมใช้งาน

## Scope

In scope:
- เขียน `prisma/schema.prisma` ครบทุก model ตาม spec
- รัน `prisma migrate dev --name init`
- เขียน `prisma/seed.ts` พร้อม script ใน `package.json`

Out of scope:
- ยังไม่มี API routes
- ยังไม่มี UI

## Files likely to create or edit

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `package.json` (เพิ่ม `prisma.seed` script)

## Data Model

```prisma
model Room {
  id          String   @id @default(cuid())
  number      String   @unique
  description String?
  rent        Float    @default(0)
  createdAt   DateTime @default(now())
  tenant      Tenant?
  bills       Bill[]
}

model Tenant {
  id         String   @id @default(cuid())
  roomId     String   @unique
  room       Room     @relation(fields: [roomId], references: [id])
  name       String
  lineUserId String?
  phone      String?
  active     Boolean  @default(true)
  createdAt  DateTime @default(now())
  bills      Bill[]
}

model Bill {
  id                 String      @id @default(cuid())
  tenantId           String
  tenant             Tenant      @relation(fields: [tenantId], references: [id])
  roomId             String
  room               Room        @relation(fields: [roomId], references: [id])
  month              Int
  year               Int

  waterPrevReading   Float
  waterCurrReading   Float
  waterUsage         Float
  waterRatePerUnit   Float
  waterCollectionFee Float
  waterTotal         Float

  elecPrevReading    Float
  elecCurrReading    Float
  elecUsage          Float
  elecRatePerUnit    Float
  elecTotal          Float

  rent               Float
  total              Float

  status             BillStatus  @default(DRAFT)
  pdfStatus          PdfStatus   @default(NONE)
  pdfError           String?
  pdfUrl             String?
  sentAt             DateTime?
  paidAt             DateTime?
  createdAt          DateTime    @default(now())

  paymentSlips       PaymentSlip[]

  @@unique([tenantId, month, year])
}

enum BillStatus {
  DRAFT
  SENT
  PAID
}

enum PdfStatus {
  NONE
  PENDING
  PROCESSING
  DONE
  FAILED
}

model PaymentSlip {
  id          String    @id @default(cuid())
  billId      String
  bill        Bill      @relation(fields: [billId], references: [id])
  imageUrl    String
  note        String?
  submittedAt DateTime  @default(now())
  verifiedAt  DateTime?
}

model Settings {
  id                 String   @id @default("singleton")
  waterRatePerUnit   Float    @default(9)
  waterCollectionFee Float    @default(10)
  elecRatePerUnit    Float    @default(4.75)
  bankAccountNumber  String   @default("")
  bankAccountName    String   @default("")
  promptpayNumber    String   @default("")
  updatedAt          DateTime @updatedAt
}
```

## Implementation steps

1. แทนที่ `prisma/schema.prisma` ด้วย schema ข้างต้นทั้งหมด
2. รัน `npx prisma migrate dev --name init`
3. ติดตั้ง `ts-node` หรือใช้ `tsx` สำหรับ seed: `npm install -D tsx`
4. เขียน `prisma/seed.ts`:
   - สร้าง `Settings` 1 row (id: "singleton", ใช้ default values)
   - สร้าง Room 3 ห้อง: `{ number: "101", rent: 3000 }`, `{ number: "102", rent: 3500 }`, `{ number: "103", rent: 4000 }`
   - สร้าง Tenant 3 คน linked กับแต่ละห้อง (name: "ผู้เช่า 101" ฯลฯ, active: true)
5. เพิ่มใน `package.json`:
   ```json
   "prisma": {
     "seed": "tsx prisma/seed.ts"
   }
   ```
6. รัน `npx prisma db seed` ยืนยัน

## Tests required

- `npx prisma migrate dev` สำเร็จโดยไม่มี error
- `npx prisma db seed` สร้าง data ครบ
- `npx prisma studio` เปิดดู data ได้ถูกต้อง
- TypeScript ไม่มี error ใน seed file

## Acceptance criteria

- [ ] Migration file สร้างใน `prisma/migrations/`
- [ ] Schema มีครบทุก model: Room, Tenant, Bill, PaymentSlip, Settings
- [ ] Bill มี `@@unique([tenantId, month, year])`
- [ ] Bill มี `pdfStatus` (PdfStatus enum) และ `waterCollectionFee`
- [ ] Room มี `rent` field
- [ ] Settings มี `waterCollectionFee` และ default values ถูกต้อง (water: 9, elec: 4.75, fee: 10)
- [ ] `npx prisma db seed` สร้าง 1 Settings, 3 Rooms, 3 Tenants

## Prompt for Codex

Implement Ticket 002 only.

Replace `prisma/schema.prisma` with the following models exactly:

Room: id (cuid), number (String unique), description (String?), rent (Float default 0), createdAt, relation to Tenant (one-to-one) and Bill (one-to-many)

Tenant: id (cuid), roomId (String unique, FK to Room), name, lineUserId (String?), phone (String?), active (Boolean default true), createdAt, relation to Bill (one-to-many)

Bill: id (cuid), tenantId (FK to Tenant), roomId (FK to Room), month (Int), year (Int), waterPrevReading (Float), waterCurrReading (Float), waterUsage (Float), waterRatePerUnit (Float), waterCollectionFee (Float), waterTotal (Float), elecPrevReading (Float), elecCurrReading (Float), elecUsage (Float), elecRatePerUnit (Float), elecTotal (Float), rent (Float), total (Float), status (BillStatus default DRAFT), pdfStatus (PdfStatus default NONE), pdfError (String?), pdfUrl (String?), sentAt (DateTime?), paidAt (DateTime?), createdAt, relation to PaymentSlip. @@unique([tenantId, month, year])

Enums: BillStatus { DRAFT, SENT, PAID } and PdfStatus { NONE, PENDING, PROCESSING, DONE, FAILED }

PaymentSlip: id (cuid), billId (FK to Bill), imageUrl, note (String?), submittedAt (default now), verifiedAt (DateTime?)

Settings: id (String default "singleton"), waterRatePerUnit (Float default 9), waterCollectionFee (Float default 10), elecRatePerUnit (Float default 4.75), bankAccountNumber (String default ""), bankAccountName (String default ""), promptpayNumber (String default ""), updatedAt (DateTime @updatedAt)

Then:
1. Run `npx prisma migrate dev --name init`
2. Install `tsx` as dev dependency
3. Write `prisma/seed.ts` that creates: 1 Settings row (id: "singleton"), 3 Rooms (101 rent:3000, 102 rent:3500, 103 rent:4000), 3 Tenants linked to each room (name: "ผู้เช่า 101" etc, active: true)
4. Add `"prisma": { "seed": "tsx prisma/seed.ts" }` to package.json
5. Run `npx prisma db seed` and confirm success

Rules:
- Do not add API routes or UI.
- Do not add features outside this ticket.
- Explain migration and seed results before finishing.
