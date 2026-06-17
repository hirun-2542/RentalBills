import { BillStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api";
import { serialize } from "@/lib/serialize";

type RouteContext = {
  params: Promise<{ id: string }>;
};



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
