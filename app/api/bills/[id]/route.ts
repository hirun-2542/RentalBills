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

function parseNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

function parseReadingUpdates(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const input = body as Record<string, unknown>;
  const data: {
    waterPrevReading?: number;
    waterCurrReading?: number;
    elecPrevReading?: number;
    elecCurrReading?: number;
  } = {};

  for (const key of [
    "waterPrevReading",
    "waterCurrReading",
    "elecPrevReading",
    "elecCurrReading",
  ] as const) {
    if (key in input) {
      const value = parseNumber(input[key]);
      if (!Number.isFinite(value)) {
        return null;
      }
      data[key] = value;
    }
  }

  return Object.keys(data).length > 0 ? data : null;
}

export async function GET(_request: Request, { params }: RouteContext) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const bill = await db.bill.findUnique({
    where: { id },
    include: { tenant: true, room: true, paymentSlips: true },
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  return NextResponse.json(serialize(bill));
}

export async function PUT(request: Request, { params }: RouteContext) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const updates = parseReadingUpdates(body);

  if (!updates) {
    return NextResponse.json({ error: "Invalid bill data" }, { status: 400 });
  }

  const bill = await db.bill.findUnique({
    where: { id },
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  if (bill.status !== BillStatus.DRAFT) {
    return NextResponse.json(
      { error: "Only draft bills can be updated" },
      { status: 409 }
    );
  }

  const waterPrevReading =
    updates.waterPrevReading ?? bill.waterPrevReading;
  const waterCurrReading =
    updates.waterCurrReading ?? bill.waterCurrReading;
  const elecPrevReading = updates.elecPrevReading ?? bill.elecPrevReading;
  const elecCurrReading = updates.elecCurrReading ?? bill.elecCurrReading;
  const waterUsage = waterCurrReading - waterPrevReading;
  const elecUsage = elecCurrReading - elecPrevReading;

  const errors: Array<{ error: string }> = [];

  if (waterUsage < 0) {
    errors.push({
      error: "ค่ามิเตอร์น้ำไม่ถูกต้อง (ค่าปัจจุบันน้อยกว่าค่าก่อนหน้า)",
    });
  }

  if (elecUsage < 0) {
    errors.push({
      error: "ค่ามิเตอร์ไฟไม่ถูกต้อง (ค่าปัจจุบันน้อยกว่าค่าก่อนหน้า)",
    });
  }

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const waterTotal =
    waterUsage * bill.waterRatePerUnit.toNumber() +
    bill.waterCollectionFee.toNumber();
  const elecTotal = elecUsage * bill.elecRatePerUnit.toNumber();
  const total = waterTotal + elecTotal + bill.rent.toNumber();

  const updatedBill = await db.bill.update({
    where: { id },
    data: {
      waterPrevReading,
      waterCurrReading,
      waterUsage,
      waterTotal,
      elecPrevReading,
      elecCurrReading,
      elecUsage,
      elecTotal,
      total,
    },
    include: { tenant: true, room: true, paymentSlips: true },
  });

  return NextResponse.json(serialize(updatedBill));
}

export async function DELETE(_request: Request, { params }: RouteContext) {
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

  if (bill.status !== BillStatus.DRAFT) {
    return NextResponse.json(
      { error: "Only draft bills can be deleted" },
      { status: 409 }
    );
  }

  try {
    await db.bill.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    throw error;
  }
}
