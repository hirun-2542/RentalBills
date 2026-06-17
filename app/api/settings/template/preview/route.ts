import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renderBillPdfFromLayout } from "@/lib/pdf-renderer";
import { renderBillPdf } from "@/lib/qorstack";
import type { TemplateLayout } from "@/lib/template-editor";
import { requireSession, SETTINGS_ID } from "../_shared";

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

export async function POST() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await db.settings.findUnique({ where: { id: SETTINGS_ID } });
  let buffer: Buffer;

  if (settings?.templateLayout) {
    if (!settings.templatePreviewPath) {
      return NextResponse.json(
        { error: "Template background preview is required" },
        { status: 400 }
      );
    }

    buffer = await renderBillPdfFromLayout(
      settings.templateLayout as TemplateLayout,
      PREVIEW_VARIABLES,
      path.join(process.cwd(), "public", settings.templatePreviewPath)
    );
  } else {
    const pdfUrl = await renderBillPdf(PREVIEW_VARIABLES);
    const response = await fetch(pdfUrl, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Preview PDF download failed" },
        { status: 502 }
      );
    }

    buffer = Buffer.from(await response.arrayBuffer());
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, "preview-bill.pdf"), buffer);

  return NextResponse.json({ previewUrl: PREVIEW_URL });
}
