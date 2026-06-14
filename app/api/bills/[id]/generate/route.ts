import { PdfStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function requireSession() {
  const session = await auth();
  return !!session?.user;
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

  await inngest.send({
    name: "bill/pdf.generate",
    data: { billId: id },
  });

  return NextResponse.json({ status: "queued" }, { status: 202 });
}
