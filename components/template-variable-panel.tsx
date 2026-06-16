"use client";

import { Button } from "@/components/ui/button";
import { TEMPLATE_VARIABLES } from "@/lib/template-editor";

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
