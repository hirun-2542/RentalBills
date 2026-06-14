# Ticket 001 — Project Scaffold

## Goal

ตั้งโครงสร้างโปรเจกต์ Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui + Prisma พร้อม local dev Docker Compose สำหรับ PostgreSQL และ qorstack-report

## Scope

In scope:
- สร้างโปรเจกต์ด้วย `create-next-app` + TypeScript strict mode
- ติดตั้ง Tailwind CSS + shadcn/ui
- ติดตั้ง Prisma + config เชื่อม PostgreSQL ผ่าน `DATABASE_URL`
- สร้าง `docker-compose.dev.yml` สำหรับ local dev (postgres + qorstack-report)
- สร้าง `.env.example` ครบทุก env var
- สร้าง `lib/db.ts` — Prisma client singleton
- สร้าง `app/(dashboard)/layout.tsx` — sidebar + header shell (placeholder)
- สร้าง `app/(auth)/login/` — หน้าว่าง placeholder

Out of scope:
- ยังไม่มี Auth logic จริง
- ยังไม่มี Prisma schema จริง (ใส่ placeholder ได้)
- ยังไม่มี API routes
- ไม่มี production docker-compose (deploy บน Vercel + Neon + Railway)

## Files likely to create or edit

- `package.json`
- `tsconfig.json`
- `tailwind.config.ts`
- `next.config.ts`
- `docker-compose.dev.yml`
- `.env.example`
- `prisma/schema.prisma` (placeholder)
- `lib/db.ts`
- `app/layout.tsx`
- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/page.tsx` (placeholder)
- `app/(auth)/login/page.tsx` (placeholder)
- `components/ui/` (shadcn init)

## Implementation steps

1. `npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir=no --import-alias="@/*"`
2. `npx shadcn@latest init` — เลือก style: Default, base color: Slate
3. `npm install prisma @prisma/client` + `npx prisma init`
4. แก้ `prisma/schema.prisma` — datasource ชี้ `DATABASE_URL`, เพิ่ม placeholder model `_Placeholder` ชั่วคราว
5. สร้าง `lib/db.ts`:
   ```ts
   import { PrismaClient } from "@prisma/client"
   const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
   export const db = globalForPrisma.prisma ?? new PrismaClient()
   if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
   ```
6. สร้าง `docker-compose.dev.yml`:
   - service `postgres`: image `postgres:16-alpine`, port `5432`, volume
   - service `qorstack`: image `qorstack/report:latest` (หรือ placeholder image), port `3001`
7. สร้าง `.env.example`:
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rentalbills
   NEXTAUTH_SECRET=
   NEXTAUTH_URL=http://localhost:3000
   ADMIN_USERNAME=
   ADMIN_PASSWORD_HASH=
   LINE_CHANNEL_ACCESS_TOKEN=
   LINE_CHANNEL_SECRET=
   QORSTACK_API_URL=http://localhost:3001
   QORSTACK_API_KEY=
   INNGEST_SIGNING_KEY=
   INNGEST_EVENT_KEY=
   ```
8. สร้าง `app/(dashboard)/layout.tsx` — sidebar placeholder (ลิงก์: Dashboard, Rooms, Bills, History, Settings) + header
9. สร้าง `app/(dashboard)/page.tsx` — `<h1>Dashboard</h1>` placeholder
10. สร้าง `app/(auth)/login/page.tsx` — `<h1>Login</h1>` placeholder

## Tests required

- `npm run build` ผ่านโดยไม่มี TypeScript error
- `npm run dev` เปิด `localhost:3000` ได้
- `docker compose -f docker-compose.dev.yml up -d` รัน postgres ขึ้นได้
- `npx prisma db push` เชื่อม DB ได้ (ใช้ `.env` ที่ copy จาก `.env.example`)

## Acceptance criteria

- [ ] `npm run build` ผ่าน
- [ ] `npm run dev` → `localhost:3000` แสดง dashboard layout
- [ ] `docker compose -f docker-compose.dev.yml up -d` รัน postgres สำเร็จ
- [ ] `npx prisma db push` ไม่ error
- [ ] `.env.example` มีครบทุก key ที่โปรเจกต์ต้องการ
- [ ] ไม่มีไฟล์ `.env` จริงใน git (ตรวจใน `.gitignore`)

## Prompt for Codex

Implement Ticket 001 only.

Set up a Next.js 15 (App Router) + TypeScript project in the current directory with:

1. Tailwind CSS + shadcn/ui (style: Default, base color: Slate)
2. Prisma ORM — datasource pointing to `DATABASE_URL` env var (PostgreSQL)
3. `lib/db.ts` as a Prisma client singleton (global pattern for Next.js dev mode)
4. `docker-compose.dev.yml` with two services:
   - `postgres`: image postgres:16-alpine, port 5432:5432, volume for data persistence, env POSTGRES_DB=rentalbills POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres
   - `qorstack`: image qorstack/report:latest, port 3001:3000 (use placeholder if image unknown)
5. `.env.example` with these keys (empty values): DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, ADMIN_USERNAME, ADMIN_PASSWORD_HASH, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET, QORSTACK_API_URL, QORSTACK_API_KEY, INNGEST_SIGNING_KEY, INNGEST_EVENT_KEY
6. `app/(dashboard)/layout.tsx` — sidebar with nav links (Dashboard /, Rooms /rooms, Bills /bills, History /history, Settings /settings) and a top header bar. Use shadcn/ui components.
7. `app/(dashboard)/page.tsx` — placeholder `<h1>Dashboard</h1>`
8. `app/(auth)/login/page.tsx` — placeholder `<h1>Login</h1>`
9. Ensure `.gitignore` includes `.env`

Rules:
- Keep the diff small.
- Do not implement auth logic, real schema, or API routes.
- Do not add features outside this ticket.
- Run `npm run build` before finishing and confirm it passes.
- Explain which commands were run and what the result was.
