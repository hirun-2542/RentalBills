import { BillStatus, PdfStatus, Prisma } from "@prisma/client";
import { type messagingApi } from "@line/bot-sdk";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendBillMessages } from "@/lib/line";
import { requireSession } from "@/lib/api";
import { serialize } from "@/lib/serialize";

type RouteContext = {
  params: Promise<{ id: string }>;
};



function toNumber(value: Prisma.Decimal | number) {
  return value instanceof Prisma.Decimal ? value.toNumber() : value;
}

function formatNumber(value: Prisma.Decimal | number) {
  return new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function buildTextMessage(
  bill: NonNullable<Awaited<ReturnType<typeof findBillForSend>>>
): messagingApi.TextMessage {
  return {
    type: "text",
    text: `[ห้อง ${bill.room.number}] บิลค่าน้ำ-ค่าไฟ เดือน ${bill.month}/${bill.year}

ค่าน้ำ: ${formatNumber(bill.waterUsage)} หน่วย × ${formatNumber(bill.waterRatePerUnit)} + ${formatNumber(bill.waterCollectionFee)} บาท = ${formatNumber(bill.waterTotal)} บาท
ค่าไฟ: ${formatNumber(bill.elecUsage)} หน่วย × ${formatNumber(bill.elecRatePerUnit)} = ${formatNumber(bill.elecTotal)} บาท
ค่าเช่า: ${formatNumber(bill.rent)} บาท
รวมทั้งหมด: ${formatNumber(bill.total)} บาท

กรุณาโอนเงินภายใน 7 วัน`,
  };
}

function findBillForSend(id: string) {
  return db.bill.findUnique({
    where: { id },
    include: { tenant: true, room: true },
  });
}

export async function POST(_request: Request, { params }: RouteContext) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const bill = await findBillForSend(id);

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  if (bill.pdfStatus !== PdfStatus.DONE) {
    return NextResponse.json(
      { error: "กรุณาสร้าง PDF ก่อนส่ง" },
      { status: 422 }
    );
  }

  if (!bill.tenant.lineUserId) {
    return NextResponse.json(
      { error: "ผู้เช่ายังไม่มี LINE User ID กรุณาเพิ่มใน Rooms" },
      { status: 422 }
    );
  }

  if (bill.status === BillStatus.PAID) {
    return NextResponse.json({ error: "บิลนี้ชำระแล้ว" }, { status: 409 });
  }

  const appUrl = process.env.NEXTAUTH_URL;

  if (!appUrl) {
    return NextResponse.json(
      { error: "NEXTAUTH_URL is not configured" },
      { status: 500 }
    );
  }

  const qrUrl = `${appUrl}/api/bills/${id}/qr`;
  const textMsg = buildTextMessage(bill);
  const imageMsg: messagingApi.ImageMessage = {
    type: "image",
    originalContentUrl: qrUrl,
    previewImageUrl: qrUrl,
  };

  try {
    await sendBillMessages(bill.tenant.lineUserId, [textMsg, imageMsg]);
  } catch {
    return NextResponse.json(
      { error: "ส่ง LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" },
      { status: 502 }
    );
  }

  const updatedBill = await db.bill.update({
    where: { id },
    data: {
      status: BillStatus.SENT,
      sentAt: new Date(),
    },
    include: { tenant: true, room: true },
  });

  return NextResponse.json(serialize(updatedBill));
}
