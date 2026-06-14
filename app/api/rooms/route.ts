import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireSession() {
  const session = await auth();
  return !!session?.user;
}

function parseRoomBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const data = body as Record<string, unknown>;
  const number = typeof data.number === "string" ? data.number.trim() : "";
  const rent = typeof data.rent === "number" ? data.rent : Number(data.rent);
  const description =
    typeof data.description === "string" && data.description.trim()
      ? data.description.trim()
      : null;

  if (!number || !Number.isFinite(rent) || rent < 0) {
    return null;
  }

  return { number, description, rent };
}

export async function GET() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rooms = await db.room.findMany({
    include: {
      tenants: {
        orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: { number: "asc" },
  });

  return NextResponse.json(rooms);
}

export async function POST(request: Request) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const roomData = parseRoomBody(body);

  if (!roomData) {
    return NextResponse.json({ error: "Invalid room data" }, { status: 400 });
  }

  const existingRoom = await db.room.findUnique({
    where: { number: roomData.number },
    select: { id: true },
  });

  if (existingRoom) {
    return NextResponse.json({ error: "Room number already exists" }, { status: 409 });
  }

  try {
    const room = await db.room.create({ data: roomData });
    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Room number already exists" }, { status: 409 });
    }

    throw error;
  }
}
