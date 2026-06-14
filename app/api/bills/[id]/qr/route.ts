import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatePromptPayQR } from "@/lib/promptpay";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function toNumber(value: Prisma.Decimal | number) {
  return value instanceof Prisma.Decimal ? value.toNumber() : value;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const bill = await db.bill.findUnique({
    where: { id },
    select: { total: true },
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  const settings = await db.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  if (!settings.promptpayNumber.trim()) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่า PromptPay" },
      { status: 422 }
    );
  }

  const qr = await generatePromptPayQR(
    settings.promptpayNumber,
    toNumber(bill.total)
  );

  return new Response(new Uint8Array(qr), {
    headers: { "Content-Type": "image/png" },
  });
}
