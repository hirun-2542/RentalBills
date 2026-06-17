import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ALLOWED_VARIABLES, type TemplateLayout } from "@/types/template";
import { requireSession, SETTINGS_ID } from "../_shared";

const MAX_ITEMS = 500;
const VARIABLE_SET = new Set<string>(ALLOWED_VARIABLES);

function isNonNegativeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function validateLayout(body: unknown): TemplateLayout | string {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Layout must be an object";
  }

  const layout = body as Record<string, unknown>;

  if (!isPositiveNumber(layout.pageWidth)) {
    return "pageWidth must be a positive number";
  }
  if (!isPositiveNumber(layout.pageHeight)) {
    return "pageHeight must be a positive number";
  }
  if (!Array.isArray(layout.items)) return "items must be an array";
  if (layout.items.length > MAX_ITEMS) return "items must contain 500 items or fewer";

  const ids = new Set<string>();

  for (const [index, rawItem] of layout.items.entries()) {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
      return `items[${index}] must be an object`;
    }

    const item = rawItem as Record<string, unknown>;

    if (typeof item.id !== "string" || item.id.trim() === "") {
      return `items[${index}].id must be a non-empty string`;
    }
    if (ids.has(item.id)) {
      return `items[${index}].id must be unique`;
    }
    ids.add(item.id);
    if (item.type !== "variable" && item.type !== "static") {
      return `items[${index}].type must be "variable" or "static"`;
    }

    for (const key of ["x", "y"] as const) {
      if (!isNonNegativeNumber(item[key])) {
        return `items[${index}].${key} must be a non-negative number`;
      }
    }

    for (const key of ["width", "height", "fontSize"] as const) {
      if (!isPositiveNumber(item[key])) {
        return `items[${index}].${key} must be a positive number`;
      }
    }

    if (item.fontWeight !== "normal" && item.fontWeight !== "bold") {
      return `items[${index}].fontWeight must be "normal" or "bold"`;
    }
    if (!isColor(item.color)) {
      return `items[${index}].color must be a hex color`;
    }
    if (item.type === "variable") {
      if (typeof item.variable !== "string") {
        return `items[${index}].variable is required`;
      }
      if (!VARIABLE_SET.has(item.variable)) {
        return `items[${index}].variable is not supported`;
      }
    }
    if (
      item.type === "static" &&
      (typeof item.text !== "string" || item.text.trim() === "")
    ) {
      return `items[${index}].text must be a non-empty string`;
    }
  }

  return body as TemplateLayout;
}

export async function PUT(request: Request) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const layout = validateLayout(body);

  if (typeof layout === "string") {
    return NextResponse.json({ error: layout }, { status: 422 });
  }

  await db.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, templateLayout: layout },
    update: { templateLayout: layout },
  });

  return NextResponse.json({ layout });
}
