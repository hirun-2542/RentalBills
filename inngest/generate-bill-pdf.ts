import path from "node:path";
import { PdfStatus } from "@prisma/client";
import { inngest } from "@/lib/inngest";
import { db } from "@/lib/db";
import { saveBillPdf } from "@/lib/pdf-storage";
import { renderBillPdfFromLayout } from "@/lib/pdf-renderer";
import type { TemplateLayout } from "@/lib/template-editor";


export async function generateBillPdfForBill(billId: string) {
  const bill = await db.bill.findUnique({
    where: { id: billId },
    include: { tenant: true, room: true },
  });

  if (!bill) {
    throw new Error("Bill not found");
  }

  const settings = await db.settings.findUnique({ where: { id: "singleton" } });

  if (!settings) {
    throw new Error("Settings not configured");
  }

  await db.bill.update({
    where: { id: billId },
    data: {
      pdfStatus: PdfStatus.PROCESSING,
      pdfError: null,
    },
  });

  const variables: Record<string, string> = {
    tenantName: bill.tenant.name,
    roomNumber: bill.room.number,
    month: String(bill.month),
    year: String(bill.year),
    waterPrevReading: String(bill.waterPrevReading),
    waterCurrReading: String(bill.waterCurrReading),
    waterUsage: String(bill.waterUsage),
    waterRatePerUnit: String(bill.waterRatePerUnit),
    waterCollectionFee: String(bill.waterCollectionFee),
    waterTotal: String(bill.waterTotal),
    elecPrevReading: String(bill.elecPrevReading),
    elecCurrReading: String(bill.elecCurrReading),
    elecUsage: String(bill.elecUsage),
    elecRatePerUnit: String(bill.elecRatePerUnit),
    elecTotal: String(bill.elecTotal),
    rent: String(bill.rent),
    total: String(bill.total),
    bankAccountName: settings.bankAccountName,
    bankAccountNumber: settings.bankAccountNumber,
    promptpayNumber: settings.promptpayNumber,
  };

  try {
    const backgroundPreviewPath = settings.templatePreviewPath;
    if (!backgroundPreviewPath) {
      throw new Error("Template background preview is not configured");
    }
    const layout = (settings.templateLayout as TemplateLayout | null) ?? { pageWidth: 794, pageHeight: 1123, items: [] };
    const pdfUrl = await saveBillPdf(
      billId,
      await renderBillPdfFromLayout(
        layout,
        variables,
        path.join(process.cwd(), "public", backgroundPreviewPath)
      )
    );

    await db.bill.update({
      where: { id: billId },
      data: {
        pdfStatus: PdfStatus.DONE,
        pdfUrl,
        pdfError: null,
      },
    });

    return { pdfUrl };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to render PDF";

    await db.bill.update({
      where: { id: billId },
      data: {
        pdfStatus: PdfStatus.FAILED,
        pdfError: message,
      },
    });

    throw error instanceof Error ? error : new Error(message);
  }
}

export const generateBillPdf = inngest.createFunction(
  {
    id: "generate-bill-pdf",
    concurrency: 2,
    triggers: [{ event: "bill/pdf.generate" }],
  },
  async ({ event, step }) => {
    const { billId } = event.data as { billId: string };

    return step.run("generate PDF", () => generateBillPdfForBill(billId));
  }
);
