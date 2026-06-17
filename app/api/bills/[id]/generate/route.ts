import { PdfStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api";
import { inngest } from "@/lib/inngest";
import { generateBillPdfForBill } from "@/inngest/generate-bill-pdf";

type RouteContext = {
  params: Promise<{ id: string }>;
};


function isMissingInngestEventKey(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("couldn't find an event key")
  );
}

function runLocalPdfGeneration(billId: string) {
  void generateBillPdfForBill(billId).catch((error) => {
    console.error("Local PDF generation failed", error);
  });
}

export async function POST(_request: Request, { params }: RouteContext) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const updated = await db.bill.updateMany({
    where: {
      id,
      pdfStatus: { notIn: [PdfStatus.PENDING, PdfStatus.PROCESSING] },
    },
    data: {
      pdfStatus: PdfStatus.PENDING,
      pdfError: null,
      pdfUrl: null,
    },
  });

  if (updated.count === 0) {
    const bill = await db.bill.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "กำลังสร้าง PDF อยู่" },
      { status: 409 }
    );
  }

  try {
    await inngest.send({
      name: "bill/pdf.generate",
      data: { billId: id },
    });
  } catch (error) {
    if (!isMissingInngestEventKey(error)) {
      await db.bill.update({
        where: { id },
        data: {
          pdfStatus: PdfStatus.FAILED,
          pdfError:
            error instanceof Error ? error.message : "Failed to queue PDF job",
        },
      });

      return NextResponse.json(
        { error: "ไม่สามารถเริ่มสร้าง PDF ได้" },
        { status: 502 }
      );
    }

    runLocalPdfGeneration(id);
  }

  return NextResponse.json({ status: "queued" }, { status: 202 });
}
