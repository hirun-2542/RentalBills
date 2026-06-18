import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatePromptPayCard } from "@/lib/promptpay";
import { SETTINGS_ID } from "@/lib/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function toNumber(value: Prisma.Decimal | number) {
  return value instanceof Prisma.Decimal ? value.toNumber() : value;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const bill = await db.bill.findUnique({
    where: { id },
    select: { total: true },
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  const settings = (await db.settings.findUnique({
    where: { id: SETTINGS_ID },
    select: { promptpayNumber: true, bankAccountName: true },
  })) ?? { promptpayNumber: "", bankAccountName: "" };

  if (!settings.promptpayNumber.trim()) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่า PromptPay" },
      { status: 422 }
    );
  }

  const qr = await generatePromptPayCard(
    settings.promptpayNumber,
    toNumber(bill.total),
    settings.bankAccountName
  );

  return new Response(new Uint8Array(qr), {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": "image/png",
    },
  });
}
