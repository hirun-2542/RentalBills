import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ALLOWED_VARIABLES, type TemplateLayout } from "@/types/template";

const SETTINGS_ID = "singleton";
const VARIABLE_SET = new Set<string>(ALLOWED_VARIABLES);

async function requireSession() {
  const session = await auth();
  return !!session?.user;
}

function isPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
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

  for (const [index, rawItem] of layout.items.entries()) {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
      return `items[${index}] must be an object`;
    }

    const item = rawItem as Record<string, unknown>;

    if (typeof item.id !== "string" || item.id.trim() === "") {
      return `items[${index}].id must be a non-empty string`;
    }
    if (item.type !== "variable" && item.type !== "static") {
      return `items[${index}].type must be "variable" or "static"`;
    }

    for (const key of ["x", "y", "width", "height", "fontSize"] as const) {
      if (!isPositiveNumber(item[key])) {
        return `items[${index}].${key} must be a positive number`;
      }
    }

    if (item.fontWeight !== "normal" && item.fontWeight !== "bold") {
      return `items[${index}].fontWeight must be "normal" or "bold"`;
    }
    if (typeof item.color !== "string" || item.color.trim() === "") {
      return `items[${index}].color must be a non-empty string`;
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
