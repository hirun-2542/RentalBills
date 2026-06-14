import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireSession() {
  const session = await auth();
  return !!session?.user;
}

function parseTenantBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const input = body as Record<string, unknown>;
  const roomId = typeof input.roomId === "string" ? input.roomId.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const phone =
    typeof input.phone === "string" && input.phone.trim()
      ? input.phone.trim()
      : null;
  const lineUserId =
    typeof input.lineUserId === "string" && input.lineUserId.trim()
      ? input.lineUserId.trim()
      : null;

  if (!roomId || !name) {
    return null;
  }

  return { roomId, name, phone, lineUserId };
}

export async function POST(request: Request) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const tenantData = parseTenantBody(body);

  if (!tenantData) {
    return NextResponse.json({ error: "Invalid tenant data" }, { status: 400 });
  }

  const room = await db.room.findUnique({
    where: { id: tenantData.roomId },
    select: { id: true },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const activeTenant = await db.tenant.findFirst({
    where: { roomId: tenantData.roomId, active: true },
    select: { id: true },
  });

  if (activeTenant) {
    return NextResponse.json(
      { error: "Room already has an active tenant" },
      { status: 409 }
    );
  }

  try {
    const tenant = await db.tenant.create({ data: tenantData });
    return NextResponse.json(tenant, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Room already has an active tenant" },
        { status: 409 }
      );
    }

    throw error;
  }
}
