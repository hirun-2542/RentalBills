import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderBillPdfFromLayout } from "@/lib/pdf-renderer";
import { renderBillPdf } from "@/lib/qorstack";
import type { TemplateLayout } from "@/lib/template-editor";

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

async function requireSession() {
  const session = await auth();
  return !!session?.user;
}

export async function POST() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await db.settings.findUnique({ where: { id: "singleton" } });

  if (!settings?.templateLayout) {
    return NextResponse.json({
      previewUrl: await renderBillPdf(PREVIEW_VARIABLES),
    });
  }

  if (!settings.templatePreviewPath) {
    return NextResponse.json(
      { error: "Template background preview is required" },
      { status: 400 }
    );
  }

  const buffer = await renderBillPdfFromLayout(
    settings.templateLayout as TemplateLayout,
    PREVIEW_VARIABLES,
    path.join(process.cwd(), "public", settings.templatePreviewPath)
  );
  const uploadDir = path.join(process.cwd(), "public", "uploads", "template");
  const previewUrl = "/uploads/template/preview-bill.pdf";

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, "preview-bill.pdf"), buffer);

  return NextResponse.json({ previewUrl });
}
