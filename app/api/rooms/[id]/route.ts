import { Prisma } from "@prisma/client";
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

function isPrismaErrorCode(error: unknown, code: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}

function parseRoomUpdateBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const input = body as Record<string, unknown>;
  const data: {
    number?: string;
    description?: string | null;
    rent?: number;
  } = {};

  if ("number" in input) {
    if (typeof input.number !== "string" || !input.number.trim()) {
      return null;
    }
    data.number = input.number.trim();
  }

  if ("description" in input) {
    data.description =
      typeof input.description === "string" && input.description.trim()
        ? input.description.trim()
        : null;
  }

  if ("rent" in input) {
    const rent = typeof input.rent === "number" ? input.rent : Number(input.rent);
    if (!Number.isFinite(rent) || rent < 0) {
      return null;
    }
    data.rent = rent;
  }

  return Object.keys(data).length > 0 ? data : null;
}

export async function PUT(request: Request, { params }: RouteContext) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const data = parseRoomUpdateBody(body);

  if (!data) {
    return NextResponse.json({ error: "Invalid room data" }, { status: 400 });
  }

  try {
    const room = await db.room.update({ where: { id }, data });
    return NextResponse.json(room);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      return NextResponse.json({ error: "Room number already exists" }, { status: 409 });
    }

    if (isPrismaErrorCode(error, "P2025")) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const billCount = await db.bill.count({ where: { roomId: id } });

  if (billCount > 0) {
    return NextResponse.json(
      { error: "ไม่สามารถลบห้องที่มีประวัติบิล" },
      { status: 409 }
    );
  }

  try {
    await db.$transaction([
      db.tenant.deleteMany({ where: { roomId: id } }),
      db.room.delete({ where: { id } }),
    ]);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (isPrismaErrorCode(error, "P2003")) {
      return NextResponse.json(
        { error: "ไม่สามารถลบห้องที่มีประวัติบิล" },
        { status: 409 }
      );
    }

    throw error;
  }
}
