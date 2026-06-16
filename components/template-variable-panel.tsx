"use client";

import { Button } from "@/components/ui/button";

export const TEMPLATE_VARIABLES = [
  ["tenantName", "ชื่อผู้เช่า"],
  ["roomNumber", "ห้อง"],
  ["month", "เดือน"],
  ["year", "ปี"],
  ["waterPrevReading", "มิเตอร์น้ำ (ก่อน)"],
  ["waterCurrReading", "มิเตอร์น้ำ (หลัง)"],
  ["waterUsage", "น้ำ (หน่วย)"],
  ["waterRatePerUnit", "ค่าน้ำ/หน่วย"],
  ["waterCollectionFee", "ค่าจัดเก็บน้ำ"],
  ["waterTotal", "ค่าน้ำ (ยอด)"],
  ["elecPrevReading", "มิเตอร์ไฟ (ก่อน)"],
  ["elecCurrReading", "มิเตอร์ไฟ (หลัง)"],
  ["elecUsage", "ไฟ (หน่วย)"],
  ["elecRatePerUnit", "ค่าไฟ/หน่วย"],
  ["elecTotal", "ค่าไฟ (ยอด)"],
  ["rent", "ค่าเช่า"],
  ["total", "ยอดรวม"],
  ["bankAccountName", "ชื่อบัญชี"],
  ["bankAccountNumber", "เลขบัญชี"],
  ["promptpayNumber", "PromptPay"],
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number][0];

type Props = {
  onAddStaticText: () => void;
};

export function TemplateVariablePanel({ onAddStaticText }: Props) {
  return (
    <aside className="w-full shrink-0 space-y-3 md:w-60">
      <div>
        <h2 className="text-sm font-semibold">Variables</h2>
        <p className="text-xs text-muted-foreground">ลากไปวางบน template</p>
      </div>
      <div className="grid gap-2">
        {TEMPLATE_VARIABLES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(
                "application/x-template-variable",
                value
              );
              event.dataTransfer.setData("text/plain", label);
            }}
            className="rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-accent"
          >
            {label}
          </button>
        ))}
      </div>
      <Button type="button" className="w-full" onClick={onAddStaticText}>
        + เพิ่มข้อความ
      </Button>
    </aside>
  );
}
