"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Image as KonvaImage, Layer, Stage, Text } from "react-konva/lib/ReactKonvaCore";
import type Konva from "konva";
import "konva/lib/shapes/Image";
import "konva/lib/shapes/Text";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TEMPLATE_VARIABLES, type TemplateVariable } from "./template-variable-panel";

const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const DEFAULT_ITEM = {
  x: 40,
  y: 40,
  width: 160,
  height: 28,
  fontSize: 14,
  fontWeight: "normal" as const,
  color: "#111111",
};

export type TemplateLayoutItem = {
  id: string;
  type: "variable" | "text";
  variable?: TemplateVariable;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: string;
};

type Props = {
  backgroundPreviewUrl: string | null;
  items: TemplateLayoutItem[];
  onItemsChange: (items: TemplateLayoutItem[]) => void;
};

function makeId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getVariableLabel(variable: string) {
  return TEMPLATE_VARIABLES.find(([value]) => value === variable)?.[1] ?? variable;
}

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

export function createTemplateTextItem(
  patch: Partial<TemplateLayoutItem> = {}
): TemplateLayoutItem {
  return {
    id: makeId(),
    type: "text",
    text: "ข้อความ",
    ...DEFAULT_ITEM,
    ...patch,
  };
}

export function TemplateCanvasEditor({
  backgroundPreviewUrl,
  items,
  onItemsChange,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [displayWidth, setDisplayWidth] = useState(A4_WIDTH);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const image = useImage(backgroundPreviewUrl);
  const scale = displayWidth / A4_WIDTH;
  const displayHeight = A4_HEIGHT * scale;
  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  useEffect(() => {
    const resize = () => {
      const width = wrapRef.current?.clientWidth ?? A4_WIDTH;
      setDisplayWidth(Math.min(A4_WIDTH, width));
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const updateItem = (id: string, patch: Partial<TemplateLayoutItem>) => {
    onItemsChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addDroppedItem = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const variable = event.dataTransfer.getData(
      "application/x-template-variable"
    ) as TemplateVariable;

    if (!variable || !wrapRef.current) return;

    const rect = wrapRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;
    const item = createTemplateTextItem({
      type: "variable",
      variable,
      text: `{${variable}}`,
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
              <KonvaImage image={image} width={A4_WIDTH} height={A4_HEIGHT} />
            ) : (
              <Text
                text="Upload background"
                width={A4_WIDTH}
                height={A4_HEIGHT}
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
                {...item}
                text={item.type === "variable" && item.variable ? `{${item.variable}}` : item.text}
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
            {selected.type === "text" ? (
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
