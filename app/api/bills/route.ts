import { BillStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type BillInput = {
  roomId: string;
  waterPrevReading: number;
  waterCurrReading: number;
  elecPrevReading: number;
  elecCurrReading: number;
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

function isPrismaErrorCode(error: unknown, code: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}

function parseNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

function parseBillInput(input: unknown): BillInput | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const data = input as Record<string, unknown>;
  const bill = {
    roomId: typeof data.roomId === "string" ? data.roomId.trim() : "",
    waterPrevReading: parseNumber(data.waterPrevReading),
    waterCurrReading: parseNumber(data.waterCurrReading),
    elecPrevReading: parseNumber(data.elecPrevReading),
    elecCurrReading: parseNumber(data.elecCurrReading),
  };

  if (
    !bill.roomId ||
    !Number.isFinite(bill.waterPrevReading) ||
    !Number.isFinite(bill.waterCurrReading) ||
    !Number.isFinite(bill.elecPrevReading) ||
    !Number.isFinite(bill.elecCurrReading)
  ) {
    return null;
  }

  return bill;
}

function parseCreateBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const input = body as Record<string, unknown>;
  const month = parseNumber(input.month);
  const year = parseNumber(input.year);
  const bills = Array.isArray(input.bills)
    ? input.bills.map(parseBillInput)
    : null;

  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(year) ||
    year < 2000 ||
    !bills ||
    bills.some((bill) => bill === null)
  ) {
    return null;
  }

  return { month, year, bills: bills as BillInput[] };
}

function validateReadings(bills: BillInput[]) {
  const errors: Array<{ roomId: string; error: string }> = [];

  for (const bill of bills) {
    const waterUsage = bill.waterCurrReading - bill.waterPrevReading;
    const elecUsage = bill.elecCurrReading - bill.elecPrevReading;

    if (waterUsage < 0) {
      errors.push({
        roomId: bill.roomId,
        error: "ค่ามิเตอร์น้ำไม่ถูกต้อง (ค่าปัจจุบันน้อยกว่าค่าก่อนหน้า)",
      });
    }

    if (elecUsage < 0) {
      errors.push({
        roomId: bill.roomId,
        error: "ค่ามิเตอร์ไฟไม่ถูกต้อง (ค่าปัจจุบันน้อยกว่าค่าก่อนหน้า)",
      });
    }
  }

  return errors;
}

export async function GET(request: Request) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const status = searchParams.get("status");

  const where: Prisma.BillWhereInput = {};

  if (month) {
    const parsedMonth = Number(month);
    if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }
    where.month = parsedMonth;
  }

  if (year) {
    const parsedYear = Number(year);
    if (!Number.isInteger(parsedYear) || parsedYear < 2000) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }
    where.year = parsedYear;
  }

  if (status) {
    if (!Object.values(BillStatus).includes(status as BillStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    where.status = status as BillStatus;
  }

  const bills = await db.bill.findMany({
    where,
    include: { tenant: true, room: true },
    orderBy: { room: { number: "asc" } },
  });

  return NextResponse.json(serialize(bills));
}

export async function POST(request: Request) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const data = parseCreateBody(body);

  if (!data) {
    return NextResponse.json({ error: "Invalid bill data" }, { status: 400 });
  }

  const validationErrors = validateReadings(data.bills);

  if (validationErrors.length > 0) {
    return NextResponse.json({ errors: validationErrors }, { status: 400 });
  }

  const settings = await db.settings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    return NextResponse.json(
      { error: "Settings not configured" },
      { status: 400 }
    );
  }

  const rooms = await db.room.findMany({
    where: { id: { in: data.bills.map((bill) => bill.roomId) } },
    include: {
      tenants: {
        where: { active: true },
        take: 1,
      },
    },
  });
  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  const skipped = data.bills.flatMap((bill) => {
    const room = roomsById.get(bill.roomId);

    if (!room) {
      return [{ roomId: bill.roomId, reason: "Room not found" }];
    }

    if (!room.tenants[0]) {
      return [{ roomId: bill.roomId, reason: "No active tenant" }];
    }

    return [];
  });
  const billableRooms = rooms.filter((room) => room.tenants[0]);
  const tenantIds = billableRooms.map((room) => room.tenants[0].id);

  const existingBills = await db.bill.findMany({
    where: {
      tenantId: { in: tenantIds },
      month: data.month,
      year: data.year,
    },
    include: { room: true },
  });
  const duplicateTenantIds = new Set(
    existingBills.map((bill) => bill.tenantId)
  );
  const duplicates = existingBills.map((bill) => ({
    roomId: bill.roomId,
    roomNumber: bill.room.number,
  }));

  const waterRatePerUnit = settings.waterRatePerUnit.toNumber();
  const waterCollectionFee = settings.waterCollectionFee.toNumber();
  const elecRatePerUnit = settings.elecRatePerUnit.toNumber();

  const createOperations = data.bills
    .map((billInput) => {
      const room = roomsById.get(billInput.roomId);
      const tenant = room?.tenants[0];

      if (!room || !tenant || duplicateTenantIds.has(tenant.id)) {
        return null;
      }

      const waterUsage =
        billInput.waterCurrReading - billInput.waterPrevReading;
      const elecUsage = billInput.elecCurrReading - billInput.elecPrevReading;
      const rent = room.rent.toNumber();
      const waterTotal = waterUsage * waterRatePerUnit + waterCollectionFee;
      const elecTotal = elecUsage * elecRatePerUnit;
      const total = waterTotal + elecTotal + rent;

      return db.bill.create({
        data: {
          tenantId: tenant.id,
          roomId: room.id,
          month: data.month,
          year: data.year,
          waterPrevReading: billInput.waterPrevReading,
          waterCurrReading: billInput.waterCurrReading,
          waterUsage,
          waterRatePerUnit,
          waterCollectionFee,
          waterTotal,
          elecPrevReading: billInput.elecPrevReading,
          elecCurrReading: billInput.elecCurrReading,
          elecUsage,
          elecRatePerUnit,
          elecTotal,
          rent,
          total,
        },
        include: { tenant: true, room: true },
      });
    })
    .filter((operation) => operation !== null);

  try {
    const createdBills = await db.$transaction(createOperations);
    return NextResponse.json(
      { bills: serialize(createdBills), skipped, duplicates },
      { status: 201 }
    );
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      const duplicateRooms = await db.bill.findMany({
        where: {
          tenantId: { in: tenantIds },
          month: data.month,
          year: data.year,
        },
        include: { room: true },
      });

      return NextResponse.json(
        {
          error: "Duplicate bills",
          duplicates: duplicateRooms.map((bill) => ({
            roomId: bill.roomId,
            roomNumber: bill.room.number,
          })),
        },
        { status: 409 }
      );
    }

    throw error;
  }
}
