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

function parseTenantUpdateBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const input = body as Record<string, unknown>;
  const data: {
    name?: string;
    phone?: string | null;
    lineUserId?: string | null;
    active?: boolean;
  } = {};

  if ("name" in input) {
    if (typeof input.name !== "string" || !input.name.trim()) {
      return null;
    }
    data.name = input.name.trim();
  }

  if ("phone" in input) {
    data.phone =
      typeof input.phone === "string" && input.phone.trim()
        ? input.phone.trim()
        : null;
  }

  if ("lineUserId" in input) {
    data.lineUserId =
      typeof input.lineUserId === "string" && input.lineUserId.trim()
        ? input.lineUserId.trim()
        : null;
  }

  if ("active" in input) {
    if (typeof input.active !== "boolean") {
      return null;
    }
    data.active = input.active;
  }

  return Object.keys(data).length > 0 ? data : null;
}

export async function PUT(request: Request, { params }: RouteContext) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const data = parseTenantUpdateBody(body);

  if (!data) {
    return NextResponse.json({ error: "Invalid tenant data" }, { status: 400 });
  }

  const tenant = await db.tenant.findUnique({
    where: { id },
    select: { roomId: true },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (data.active === true) {
    const activeTenant = await db.tenant.findFirst({
      where: { roomId: tenant.roomId, active: true, NOT: { id } },
      select: { id: true },
    });

    if (activeTenant) {
      return NextResponse.json(
        { error: "Room already has an active tenant" },
        { status: 409 }
      );
    }
  }

  try {
    const updatedTenant = await db.tenant.update({ where: { id }, data });
    return NextResponse.json(updatedTenant);
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
