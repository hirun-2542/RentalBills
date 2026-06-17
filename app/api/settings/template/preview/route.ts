import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renderBillPdfFromLayout } from "@/lib/pdf-renderer";
import {
  TEMPLATE_PAGE_HEIGHT,
  TEMPLATE_PAGE_WIDTH,
  type TemplateLayout,
} from "@/lib/template-editor";
import { requireSession, SETTINGS_ID } from "@/lib/api";

const PREVIEW_VARIABLES = {
  tenantName: "ภิญโญ สมชาย",
  roomNumber: "101",
  month: "6",
  year: "2026",
  waterPrevReading: "100",
  waterCurrReading: "115",
  waterUsage: "15",
  waterRatePerUnit: "18",
  waterCollectionFee: "50",
  waterTotal: "320",
  elecPrevReading: "200",
  elecCurrReading: "230",
  elecUsage: "30",
  elecRatePerUnit: "8",
  elecTotal: "240",
  rent: "4500",
  total: "5060",
  bankAccountName: "กล้วยหอม มีสุข",
  bankAccountNumber: "123-4-56789-0",
  promptpayNumber: "0812345678",
};

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "template");
const PREVIEW_URL = "/uploads/template/preview-bill.pdf";
const EMPTY_LAYOUT: TemplateLayout = {
  pageWidth: TEMPLATE_PAGE_WIDTH,
  pageHeight: TEMPLATE_PAGE_HEIGHT,
  items: [],
};

export async function POST() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await db.settings.findUnique({ where: { id: SETTINGS_ID } });
  let buffer: Buffer;

  if (settings?.templateLayout && !settings.templatePreviewPath) {
    return NextResponse.json(
      { error: "Template background preview is required" },
      { status: 400 }
    );
  }

  if (!settings?.templatePreviewPath) {
    return NextResponse.json(
      { error: "Template background is required before preview" },
      { status: 400 }
    );
  }

  const layout =
    (settings.templateLayout as TemplateLayout | null) ?? EMPTY_LAYOUT;

  buffer = await renderBillPdfFromLayout(
    layout,
    PREVIEW_VARIABLES,
    path.join(process.cwd(), "public", settings.templatePreviewPath)
  );

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, "preview-bill.pdf"), buffer);

  return NextResponse.json({ previewUrl: PREVIEW_URL });
}
