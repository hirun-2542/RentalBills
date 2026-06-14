# Ticket 003 — Authentication

## Goal

เพิ่ม Login/Logout สำหรับเจ้าของห้อง (single user) ด้วย NextAuth.js v5 Credentials provider + protect dashboard routes

## Scope

In scope:
- ติดตั้ง NextAuth.js v5
- Credentials provider เทียบกับ `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` (bcrypt) ใน env
- `middleware.ts` ป้องกัน `/(dashboard)` routes
- Login page พร้อม form จริง
- Logout button ใน sidebar

Out of scope:
- Registration, forgot password, roles
- ไม่มี user table ใน DB (single hardcoded admin)

## Files likely to create or edit

- `lib/auth.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `app/(auth)/login/page.tsx`
- `middleware.ts`
- `app/(dashboard)/layout.tsx` (เพิ่ม logout button)
- `package.json` (เพิ่ม bcryptjs)
- `.env.example` (ยืนยัน AUTH_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD_HASH)

## Implementation steps

1. `npm install next-auth@beta bcryptjs`
   - `next-auth@beta` is intentional because this ticket targets NextAuth v5.
   - Do not install `@types/bcryptjs`; `bcryptjs@3` ships its own TypeScript types.
2. สร้าง `lib/auth.ts`:
   - Credentials provider: รับ username + password
   - ตรวจ username ตรงกับ `ADMIN_USERNAME`
   - ตรวจ password ด้วย `bcryptjs.compare(password, ADMIN_PASSWORD_HASH)`
   - Return `{ id: "admin", name: "Admin" }` ถ้าถูก, `null` ถ้าผิด
3. สร้าง `app/api/auth/[...nextauth]/route.ts` — export handlers
4. สร้าง `middleware.ts`:
   - protect path `/(dashboard)(.*)` → redirect ไป `/login` ถ้าไม่มี session
   - path `/login` → redirect ไป `/` ถ้ามี session อยู่แล้ว
5. สร้าง login page (`app/(auth)/login/page.tsx`):
   - Form: username + password input
   - `signIn("credentials", { username, password, redirect: false })` แล้ว redirect สำเร็จด้วย `router.push("/")`
   - แสดง error message ถ้า login ผิด
6. เพิ่ม logout button ใน `app/(dashboard)/layout.tsx`:
   - `signOut({ redirectTo: "/login" })`

## Tests required

- Login ด้วย credentials ถูกต้อง → redirect ไป `/`
- Login ด้วย credentials ผิด → แสดง error "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
- เข้า `/` โดยไม่ได้ login → redirect ไป `/login`
- กด logout → redirect ไป `/login` + session หมด

## Acceptance criteria

- [ ] Login page แสดงผลที่ `/login`
- [ ] Credentials ถูก → เข้า dashboard ได้
- [ ] Credentials ผิด → แสดง error message ในหน้า
- [ ] เข้า `/rooms`, `/bills`, `/settings` โดยไม่ login → redirect `/login`
- [ ] Logout ทำงานได้จาก sidebar
- [ ] ไม่มี plaintext password ใน code หรือ DB

## Prompt for Codex

Implement Ticket 003 only.

Install `next-auth@beta` and `bcryptjs`. Do not install `@types/bcryptjs`; `bcryptjs@3` includes its own types.

Create `lib/auth.ts` with NextAuth v5 config using Credentials provider:
- Use `session: { strategy: "jwt" }`.
- Accept `{ username: string, password: string }`
- Compare username against `process.env.ADMIN_USERNAME`
- Compare password against `process.env.ADMIN_PASSWORD_HASH` using `bcryptjs.compare`
- Return `{ id: "admin", name: "Admin" }` on success, `null` on failure

Create `app/api/auth/[...nextauth]/route.ts` that exports GET and POST handlers from the auth config.

Create `middleware.ts` that:
- Redirects unauthenticated users from any `/(dashboard)` path to `/login`
- Redirects authenticated users away from `/login` to `/`
- Middleware intentionally protects page routes only. API routes must validate session inside each route handler.

Create `app/(auth)/login/page.tsx` with a form (username + password fields, submit button). On submit call `signIn("credentials", ...)`. Show an error message if login fails. Style with shadcn/ui Card, Input, Button components.

Add a logout button to `app/(dashboard)/layout.tsx` that calls `signOut({ redirectTo: "/login" })`.

Rules:
- Single admin user via env vars only — no user table in DB.
- Do not implement registration or roles.
- Do not add features outside this ticket.
- Keep diff small. Explain tests run before finishing.
