import { PdfStatus } from "@prisma/client";
import { inngest } from "@/lib/inngest";
import { db } from "@/lib/db";
import { renderBillPdf } from "@/lib/qorstack";

function toTemplateValue(value: { toString(): string } | number | string) {
  return value.toString();
}

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
    month: toTemplateValue(bill.month),
    year: toTemplateValue(bill.year),
    waterPrevReading: toTemplateValue(bill.waterPrevReading),
    waterCurrReading: toTemplateValue(bill.waterCurrReading),
    waterUsage: toTemplateValue(bill.waterUsage),
    waterRatePerUnit: toTemplateValue(bill.waterRatePerUnit),
    waterCollectionFee: toTemplateValue(bill.waterCollectionFee),
    waterTotal: toTemplateValue(bill.waterTotal),
    elecPrevReading: toTemplateValue(bill.elecPrevReading),
    elecCurrReading: toTemplateValue(bill.elecCurrReading),
    elecUsage: toTemplateValue(bill.elecUsage),
    elecRatePerUnit: toTemplateValue(bill.elecRatePerUnit),
    elecTotal: toTemplateValue(bill.elecTotal),
    rent: toTemplateValue(bill.rent),
    total: toTemplateValue(bill.total),
    bankAccountName: settings.bankAccountName,
    bankAccountNumber: settings.bankAccountNumber,
    promptpayNumber: settings.promptpayNumber,
  };

  try {
    const pdfUrl = await renderBillPdf(variables);

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
  { id: "generate-bill-pdf", triggers: [{ event: "bill/pdf.generate" }] },
  async ({ event, step }) => {
    const { billId } = event.data as { billId: string };

    return step.run("generate PDF", () => generateBillPdfForBill(billId));
  }
);
