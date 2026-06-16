# Ticket 013 — PDF Live Preview

## Goal

แสดง PDF inline ใน bill detail page หลัง generate เสร็จ โดยไม่ต้องกด download

## Scope

In scope:
- เพิ่ม `<iframe>` ใน `BillPdfPanel` เมื่อ `pdfStatus === "DONE"`
- ปุ่ม download ยังคงอยู่

Out of scope:
- PDF viewer แบบ custom (page navigation, zoom slider)
- Thumbnail preview ขณะ PENDING

## Files likely to create or edit

- `components/bill-pdf-panel.tsx`

## Implementation steps

1. เมื่อ `bill.pdfStatus === "DONE" && bill.pdfUrl` → render `<iframe src={bill.pdfUrl} className="w-full h-[600px] rounded border" title="PDF Preview" />` ใต้ปุ่ม download
2. วางปุ่ม download ไว้เหนือ iframe
3. ถ้า browser บล็อก iframe (X-Frame-Options) → fallback แสดง `<a href={pdfUrl} target="_blank">` แทน

## Tests required

- render `<iframe>` เมื่อ `pdfStatus === "DONE"` และ `pdfUrl` มีค่า
- ไม่ render iframe เมื่อ `pdfStatus !== "DONE"`
- ปุ่ม download ยังแสดงอยู่เมื่อ status=DONE

## Acceptance criteria

- [ ] หลัง generate เสร็จ → เห็น PDF ใน browser เลย ไม่ต้อง download
- [ ] ปุ่ม "ดาวน์โหลด PDF" ยังทำงานได้
- [ ] ไม่มี regression ใน PENDING / FAILED / NONE states

## Prompt for Codex

Implement Ticket 013 only.

In `components/bill-pdf-panel.tsx`, when `bill.pdfStatus === "DONE"` and `bill.pdfUrl` is set, render an `<iframe src={bill.pdfUrl} className="w-full h-[600px] rounded border" title="PDF Preview" />` below the existing download button. Keep the download `<a>` button. If the browser blocks the iframe due to X-Frame-Options, show a fallback `<a href={bill.pdfUrl} target="_blank" rel="noopener noreferrer">เปิด PDF ในแท็บใหม่</a>` link instead.

Add unit tests:
1. iframe renders when `pdfStatus === "DONE"` and `pdfUrl` is set
2. iframe is not rendered when `pdfStatus !== "DONE"`
3. download button still present when status=DONE

Rules:
- Do not refactor unrelated code.
- Do not add features outside this ticket.
- Keep diff small. Explain tests run before finishing.

After implementation:
1. Run relevant checks (type-check, lint, tests).
2. Commit the changes.
3. Push branch `ai/013-pdf-live-preview`.
4. Create a GitHub PR using `gh pr create`.
5. Do not merge the PR.
6. Include summary, tests run, risks, and ticket reference (Ticket 013) in the PR description.
