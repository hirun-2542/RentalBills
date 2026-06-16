"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Image as KonvaImage, Layer, Stage, Text } from "react-konva/lib/ReactKonvaCore";
import type Konva from "konva";
import "konva/lib/shapes/Image";
import "konva/lib/shapes/Text";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TEMPLATE_PAGE_HEIGHT,
  TEMPLATE_PAGE_WIDTH,
  createVariableTextItem,
  getVariableLabel,
  isTemplateVariable,
  updateTemplateItem,
  type TemplateLayoutItem,
} from "@/lib/template-editor";

export type { TemplateLayoutItem } from "@/lib/template-editor";

type Props = {
  backgroundPreviewUrl: string | null;
  items: TemplateLayoutItem[];
  onItemsChange: (items: TemplateLayoutItem[]) => void;
};

function useImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }

    const nextImage = new window.Image();
    nextImage.onload = () => setImage(nextImage);
    nextImage.src = `${url}?v=${Date.now()}`;
  }, [url]);

  return image;
}

export function TemplateCanvasEditor({
  backgroundPreviewUrl,
  items,
  onItemsChange,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [displayWidth, setDisplayWidth] = useState(TEMPLATE_PAGE_WIDTH);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const image = useImage(backgroundPreviewUrl);
  const scale = displayWidth / TEMPLATE_PAGE_WIDTH;
  const displayHeight = TEMPLATE_PAGE_HEIGHT * scale;
  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  useEffect(() => {
    const resize = () => {
      const width = wrapRef.current?.clientWidth ?? TEMPLATE_PAGE_WIDTH;
      setDisplayWidth(Math.min(TEMPLATE_PAGE_WIDTH, width));
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const updateItem = (id: string, patch: Partial<TemplateLayoutItem>) => {
    onItemsChange(updateTemplateItem(items, id, patch));
  };

  const addDroppedItem = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const variable = event.dataTransfer.getData("application/x-template-variable");

    if (!isTemplateVariable(variable) || !wrapRef.current) return;

    const rect = wrapRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;
    const item = createVariableTextItem(variable, {
      variable,
      x: Math.round(x),
      y: Math.round(y),
      width: 160,
      height: 28,
    });

    onItemsChange([...items, item]);
    setSelectedId(item.id);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div
        ref={wrapRef}
        onDrop={addDroppedItem}
        onDragOver={(event) => event.preventDefault()}
        className="overflow-auto"
      >
        <Stage
          width={displayWidth}
          height={displayHeight}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={(event) => {
            if (event.target === event.target.getStage()) setSelectedId(null);
          }}
          className="border bg-white shadow-sm"
        >
          <Layer>
            {image ? (
              <KonvaImage
                image={image}
                width={TEMPLATE_PAGE_WIDTH}
                height={TEMPLATE_PAGE_HEIGHT}
              />
            ) : (
              <Text
                text="Upload background"
                width={TEMPLATE_PAGE_WIDTH}
                height={TEMPLATE_PAGE_HEIGHT}
                align="center"
                verticalAlign="middle"
                fill="#9ca3af"
                fontSize={18}
              />
            )}
          </Layer>
          <Layer>
            {items.map((item) => (
              <Text
                key={item.id}
                x={item.x}
                y={item.y}
                width={item.width}
                height={item.height}
                fontSize={item.fontSize}
                text={item.type === "variable" && item.variable ? `{${item.variable}}` : item.text ?? ""}
                fontStyle={item.fontWeight === "bold" ? "bold" : "normal"}
                fill={item.color}
                draggable
                onClick={() => setSelectedId(item.id)}
                onTap={() => setSelectedId(item.id)}
                onDragEnd={(event: Konva.KonvaEventObject<DragEvent>) => {
                  updateItem(item.id, {
                    x: Math.round(event.target.x()),
                    y: Math.round(event.target.y()),
                  });
                }}
              />
            ))}
          </Layer>
        </Stage>
      </div>
      <div className="space-y-3 rounded-md border p-4">
        <h2 className="text-sm font-semibold">Inspector</h2>
        {selected ? (
          <>
            {selected.type === "static" ? (
              <Field label="Text">
                <Input
                  value={selected.text}
                  onChange={(event) =>
                    updateItem(selected.id, { text: event.target.value })
                  }
                />
              </Field>
            ) : (
              <p className="text-sm text-muted-foreground">
                {getVariableLabel(selected.variable ?? "")}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {(["x", "y", "width", "height", "fontSize"] as const).map((key) => (
                <Field key={key} label={key}>
                  <Input
                    type="number"
                    value={selected[key]}
                    onChange={(event) =>
                      updateItem(selected.id, {
                        [key]: Number(event.target.value),
                      })
                    }
                  />
                </Field>
              ))}
            </div>
            <Field label="Color">
              <Input
                type="color"
                value={selected.color}
                onChange={(event) =>
                  updateItem(selected.id, { color: event.target.value })
                }
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.fontWeight === "bold"}
                onChange={(event) =>
                  updateItem(selected.id, {
                    fontWeight: event.target.checked ? "bold" : "normal",
                  })
                }
              />
              Bold
            </label>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">เลือกข้อความบน canvas</p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
