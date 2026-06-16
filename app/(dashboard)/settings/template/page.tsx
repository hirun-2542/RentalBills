"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { TemplateVariablePanel } from "@/components/template-variable-panel";
import {
  buildTemplateSavePayload,
  createStaticTextItem,
  getLayoutItems,
  type TemplateLayoutItem,
  type TemplateResponse,
} from "@/lib/template-editor";

const TemplateCanvasEditor = dynamic(
  () =>
    import("@/components/template-canvas-editor").then(
      (mod) => mod.TemplateCanvasEditor
    ),
  { ssr: false }
);

export default function TemplateSettingsPage() {
  const [items, setItems] = useState<TemplateLayoutItem[]>([]);
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string | null>(
    null
  );
  const [status, setStatus] = useState("");

  useEffect(() => {
    let mounted = true;

    fetch("/api/settings/template")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: TemplateResponse | null) => {
        if (!mounted || !data) return;
        setBackgroundPreviewUrl(data.backgroundPreviewUrl);
        setItems(getLayoutItems(data));
      })
      .catch(() => setStatus("โหลด template ไม่สำเร็จ"));

    return () => {
      mounted = false;
    };
  }, []);

  const uploadBackground = async (file: File | null) => {
    if (!file) return;

    const formData = new FormData();
    formData.set("file", file);
    setStatus("กำลังอัปโหลด...");

    const response = await fetch("/api/settings/template/background", {
      method: "POST",
      body: formData,
    });
    const data = (await response.json().catch(() => ({}))) as {
      previewUrl?: string | null;
    };

    if (!response.ok) {
      setStatus("อัปโหลดไม่สำเร็จ");
      return;
    }

    setBackgroundPreviewUrl(data.previewUrl ?? null);
    setStatus("อัปโหลดแล้ว");
  };

  const clearBackground = async () => {
    setStatus("กำลังล้าง background...");

    const response = await fetch("/api/settings/template/background", {
      method: "DELETE",
    });

    if (!response.ok) {
      setStatus("ล้าง background ไม่สำเร็จ");
      return;
    }

    setBackgroundPreviewUrl(null);
    setStatus("ล้าง background แล้ว");
  };

  const preview = async () => {
    setStatus("กำลังสร้าง preview...");

    const response = await fetch("/api/settings/template/preview", {
      method: "POST",
    });
    const data = (await response.json().catch(() => ({}))) as {
      previewUrl?: string;
    };
    const url = data.previewUrl;

    if (!response.ok || !url) {
      setStatus("สร้าง preview ไม่สำเร็จ");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
    setStatus("เปิด preview แล้ว");
  };

  const save = async () => {
    setStatus("กำลังบันทึก...");

    const response = await fetch("/api/settings/template/layout", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildTemplateSavePayload(items)),
    });

    setStatus(response.ok ? "บันทึกแล้ว" : "บันทึกไม่สำเร็จ");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">PDF Template Editor</h1>
        <p className="text-sm text-muted-foreground">
          จัดตำแหน่งข้อความบน template PDF
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <label>
            Upload background
            <input
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={(event) =>
                uploadBackground(event.currentTarget.files?.[0] ?? null)
              }
            />
          </label>
        </Button>
        <Button type="button" variant="outline" onClick={clearBackground}>
          Clear
        </Button>
        <Button type="button" variant="outline" onClick={preview}>
          Preview
        </Button>
        <Button type="button" onClick={save}>
          บันทึก Layout
        </Button>
        {status ? (
          <span className="self-center text-sm text-muted-foreground">
            {status}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <TemplateVariablePanel
          onAddStaticText={() =>
            setItems((current) => [...current, createStaticTextItem()])
          }
        />
        <main className="min-w-0 flex-1">
          <TemplateCanvasEditor
            backgroundPreviewUrl={backgroundPreviewUrl}
            items={items}
            onItemsChange={setItems}
          />
        </main>
      </div>
    </div>
  );
}
