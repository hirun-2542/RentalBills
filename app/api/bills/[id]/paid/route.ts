import { BillStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function requireSession() {
  const session = await auth();
  return !!session?.user;
}

function serialize(data: unknown): unknown {
  if (data instanceof Prisma.Decimal) {
    return data.toNumber();
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  if (Array.isArray(data)) {
    return data.map(serialize);
  }

  if (data && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, serialize(value)])
    );
  }

  return data;
}

export async function POST(_request: Request, { params }: RouteContext) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const bill = await db.bill.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  if (bill.status !== BillStatus.DRAFT && bill.status !== BillStatus.SENT) {
    return NextResponse.json(
      { error: "Only draft or sent bills can be marked paid" },
      { status: 409 }
    );
  }

  const updatedBill = await db.bill.update({
    where: { id },
    data: {
      status: BillStatus.PAID,
      paidAt: new Date(),
    },
    include: { tenant: true, room: true },
  });

  return NextResponse.json(serialize(updatedBill));
}
