# Ticket 018 — Canvas Template Editor UI

## Goal

หน้า UI สำหรับ drag-and-drop variable บน background template พร้อม inspector panel สำหรับปรับตำแหน่งและ style

## Scope

In scope:
- หน้า `/settings/template` พร้อม canvas editor
- Drag variable จาก left panel ไปวางบน A4 canvas
- Inspector panel สำหรับ selected item (x, y, font size, bold, color)
- เพิ่ม static text label ได้
- ปุ่ม Upload background (เรียก Ticket 017 API)
- ปุ่ม Preview (เรียก Ticket 020 preview API)
- ปุ่ม บันทึก Layout

Out of scope:
- Undo/redo
- Font family selector
- Multi-select items
- Snap-to-grid

## Files likely to create or edit

- `app/(dashboard)/settings/template/page.tsx` (ใหม่)
- `components/template-canvas-editor.tsx` (ใหม่)
- `components/template-variable-panel.tsx` (ใหม่)
- `app/(dashboard)/layout.tsx` (เพิ่ม nav link "Template PDF")
- `package.json` (เพิ่ม `react-konva`, `konva`)

## Dependencies

- **Ticket 016** (DB schema)
- **Ticket 017** (background upload API)
- **Ticket 020** (layout CRUD API)

## Layout หน้า

```
┌─────────────────────────────────────────────────┐
│  PDF Template Editor                             │
├──────────────────┬──────────────────────────────┤
│ Variables        │  [Upload background] [Clear]  │
│                  │                               │
│ [ชื่อผู้เช่า]    │  ┌── A4 Canvas ──────────┐   │
│ [ห้อง]           │  │  (background image)   │   │
│ [เดือน]          │  │                       │   │
│ [ปี]             │  │  [tenantName] ←drag   │   │
│ [ค่าน้ำ (หน่วย)] │  │  [total]              │   │
│ [ค่าน้ำ (ยอด)]   │  └───────────────────────┘   │
│ [ค่าไฟ (หน่วย)]  │                               │
│ [ค่าไฟ (ยอด)]    │  Inspector (เมื่อ select):    │
│ [ค่าเช่า]        │  x: [____] y: [____]         │
│ [ยอดรวม]         │  w: [____] h: [____]         │
│ [ชื่อบัญชี]      │  size: [__] bold: [☐]        │
│ [PromptPay]      │  color: [______]              │
│                  │                               │
│ + เพิ่มข้อความ   │                               │
├──────────────────┴──────────────────────────────┤
│             [Preview]    [บันทึก Layout]          │
└─────────────────────────────────────────────────┘
```

## Variables ที่แสดงใน left panel

| Variable | Label ที่แสดง |
|---|---|
| `tenantName` | ชื่อผู้เช่า |
| `roomNumber` | ห้อง |
| `month` | เดือน |
| `year` | ปี |
| `waterPrevReading` | มิเตอร์น้ำ (ก่อน) |
| `waterCurrReading` | มิเตอร์น้ำ (หลัง) |
| `waterUsage` | น้ำ (หน่วย) |
| `waterRatePerUnit` | ค่าน้ำ/หน่วย |
| `waterCollectionFee` | ค่าจัดเก็บน้ำ |
| `waterTotal` | ค่าน้ำ (ยอด) |
| `elecPrevReading` | มิเตอร์ไฟ (ก่อน) |
| `elecCurrReading` | มิเตอร์ไฟ (หลัง) |
| `elecUsage` | ไฟ (หน่วย) |
| `elecRatePerUnit` | ค่าไฟ/หน่วย |
| `elecTotal` | ค่าไฟ (ยอด) |
| `rent` | ค่าเช่า |
| `total` | ยอดรวม |
| `bankAccountName` | ชื่อบัญชี |
| `bankAccountNumber` | เลขบัญชี |
| `promptpayNumber` | PromptPay |

## Implementation steps

1. ติดตั้ง `react-konva` และ `konva`
2. สร้าง `components/template-variable-panel.tsx`:
   - แสดง list ของ variables ด้านบน
   - ปุ่ม "+ เพิ่มข้อความ" สำหรับ static text
   - Drag handle แต่ละ item
3. สร้าง `components/template-canvas-editor.tsx`:
   - Konva `Stage` + `Layer`
   - Layer ล่าง: `Image` node แสดง background preview
   - Layer บน: draggable `Text` nodes สำหรับแต่ละ item
   - Scale canvas ให้พอดีหน้าจอ (A4 = 595×842 pt, แสดงย่อลง)
   - Drop handler: เมื่อ drop variable จาก panel → สร้าง `Text` node ใหม่
   - Click item → set selected item → แสดง inspector
   - Inspector อัพเดต state ของ item (x, y, fontSize, fontWeight, color)
4. สร้าง `app/(dashboard)/settings/template/page.tsx`:
   - Load layout จาก `GET /api/settings/template`
   - Handle upload background (เรียก `POST /api/settings/template/background`)
   - ปุ่ม Preview → `POST /api/settings/template/preview` → เปิด URL ใน tab ใหม่
   - ปุ่ม บันทึก → `PUT /api/settings/template/layout`
5. เพิ่ม "Template PDF" ใน navigation ของ `app/(dashboard)/layout.tsx`

### Scale factor
Canvas แสดงย่อจาก 595pt แต่ layout JSON เก็บค่าเป็น pt เสมอ ใช้ `scale = displayWidth / 595`

## Tests required

- Drag variable จาก panel → item ปรากฏบน canvas
- Inspector อัพเดต x/y เมื่อ drag item บน canvas
- ปุ่ม บันทึก → `PUT /api/settings/template/layout` ถูกเรียกพร้อม layout JSON ที่ถูกต้อง
- โหลดหน้าใหม่ → layout ที่บันทึกไว้ยังอยู่

## Acceptance criteria

- [ ] วาง variable ได้ครบทุก field จาก panel
- [ ] เพิ่ม static text ได้
- [ ] Inspector แสดงและแก้ไข x, y, fontSize, fontWeight, color ของ selected item
- [ ] ปุ่ม Preview เปิด PDF ใน tab ใหม่
- [ ] บันทึก layout แล้ว reload หน้า → layout ยังอยู่ครบ
- [ ] Upload background → preview ปรากฏใน canvas ทันที

## Prompt for Codex

Implement Ticket 018 only.

Install `react-konva` and `konva`. Create a canvas-based PDF template editor at `/settings/template` with the following components:

1. `components/template-variable-panel.tsx` — list of draggable variable chips (see variable table above) plus a "+ เพิ่มข้อความ" button for static text items.

2. `components/template-canvas-editor.tsx` — Konva Stage showing:
   - Bottom layer: background image from `backgroundPreviewUrl` (A4 595×842pt, scaled to fit screen)
   - Top layer: draggable Text nodes for each layout item
   - Click to select → show inspector panel
   - Drop from variable panel → create new Text node at drop position
   - Inspector: x, y, width, height (number inputs), fontSize, fontWeight (bold checkbox), color (color input)
   - Store coordinates in pt (scale back from display px using `scale = displayWidth / 595`)

3. `app/(dashboard)/settings/template/page.tsx`:
   - Load from `GET /api/settings/template` on mount
   - Upload button → `POST /api/settings/template/background` (multipart)
   - Clear button → `DELETE /api/settings/template/background`
   - Preview button → `POST /api/settings/template/preview` → open returned URL in new tab
   - Save button → `PUT /api/settings/template/layout` with current layout JSON

4. Add "Template PDF" link to `app/(dashboard)/layout.tsx` nav.

Rules:
- Do not implement undo/redo or font family selection.
- Keep diff small. Explain tests run before finishing.

After implementation:
1. Run relevant checks (type-check, lint, tests).
2. Commit the changes.
3. Push branch `ai/018-canvas-template-editor`.
4. Create a GitHub PR using `gh pr create`.
5. Do not merge the PR.
6. Include summary, tests run, risks, and ticket reference (Ticket 018) in the PR description.
