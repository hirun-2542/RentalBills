# Ticket 014 — Research Spike: Qorstack API Capabilities

## Goal

ตรวจสอบว่า Qorstack รองรับ endpoint อะไรบ้างนอกจาก Word template render เพื่อตัดสินใจ rendering path สำหรับ canvas-based PDF generation (Ticket 019)

## Scope

In scope:
- ตรวจสอบ Qorstack API docs / Swagger UI
- ทดสอบ endpoint ที่เกี่ยวข้อง
- บันทึกผลลัพธ์

Out of scope:
- Implementation จริง (เป็นแค่ research spike)

## Files likely to create or edit

- `docs/qorstack-api.md` (ใหม่ — บันทึกผล)
- `lib/qorstack.ts` (เพิ่ม comment ถ้าจำเป็น)

## Implementation steps

1. เปิด Qorstack ที่ `http://localhost:18080/docs` หรือ `/swagger` หรือ `/api-docs`
2. ตรวจสอบและทดสอบ 3 ความสามารถ:
   - HTML → PDF: มี endpoint เช่น `/render/html` ไหม?
   - Template upload: มี endpoint สำหรับ upload .docx ใหม่ไหม?
   - File conversion: มี DOCX/PDF → Image (PNG) ไหม?
3. บันทึกผลใน `docs/qorstack-api.md`

## Output ที่ต้องการ

| ความสามารถ | มี/ไม่มี | Endpoint / หมายเหตุ |
|---|---|---|
| HTML → PDF | ? | ? |
| Upload Word template | ? | ? |
| DOCX/PDF → Image | ? | ? |

## Decision tree (บันทึกใน doc)

- ถ้า Qorstack มี HTML → PDF: Ticket 019 ใช้ Qorstack HTML endpoint (ไม่ต้องติดตั้ง Puppeteer)
- ถ้าไม่มี: Ticket 019 ใช้ Puppeteer/Playwright
- ถ้า Qorstack มี DOCX → Image: Ticket 017 ใช้ Qorstack สำหรับ preview conversion
- ถ้าไม่มี: Ticket 017 ใช้ LibreOffice CLI

## Tests required

- ไม่มี automated test (เป็น research spike)

## Acceptance criteria

- [ ] ได้คำตอบชัดเจนสำหรับทั้ง 3 ความสามารถ
- [ ] `docs/qorstack-api.md` ถูกสร้างพร้อมผลลัพธ์และ decision
- [ ] ระบุ rendering path ที่จะใช้ใน Ticket 019 ชัดเจน

## Prompt for Codex

Implement Ticket 014 only.

Check the Qorstack service running at `http://localhost:18080` (env var `QORSTACK_API_URL`). Look for API documentation at `/docs`, `/swagger`, or `/api-docs`. Investigate whether Qorstack supports:
1. HTML → PDF rendering (endpoint like `/render/html`)
2. Template upload (uploading a new .docx template)
3. File conversion: DOCX/PDF → PNG image

Test each endpoint with curl or fetch using the API key from `QORSTACK_API_KEY`. Create `docs/qorstack-api.md` documenting:
- Each endpoint found (method, path, request/response shape)
- Which of the 3 capabilities are supported
- The recommended rendering path for Ticket 019 (Qorstack HTML vs Puppeteer)
- The recommended conversion approach for Ticket 017 (Qorstack vs LibreOffice CLI)

Rules:
- Do not implement anything — research only.
- Keep diff small (just the docs file).

After investigation:
1. Commit `docs/qorstack-api.md`.
2. Push branch `ai/014-qorstack-api-spike`.
3. Create a GitHub PR using `gh pr create`.
4. Do not merge the PR.
5. Include findings summary and decisions in the PR description.
