import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as deleteRoom } from "@/app/api/rooms/[id]/route";
import { POST as createRoom } from "@/app/api/rooms/route";
import { PUT as updateTenant } from "@/app/api/tenants/[id]/route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    room: {
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    bill: {
      count: vi.fn(),
    },
    tenant: {
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  db: mocks.db,
}));

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("Ticket 004 API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { name: "Admin" } });
  });

  it("POST /api/rooms creates a room", async () => {
    mocks.db.room.findUnique.mockResolvedValue(null);
    mocks.db.room.create.mockResolvedValue({
      id: "room-1",
      number: "101",
      description: null,
      rent: 3500,
    });

    const response = await createRoom(
      jsonRequest({ number: "101", rent: 3500 })
    );

    await expect(response.json()).resolves.toMatchObject({
      id: "room-1",
      number: "101",
    });
    expect(response.status).toBe(201);
    expect(mocks.db.room.create).toHaveBeenCalledWith({
      data: { number: "101", description: null, rent: 3500 },
    });
  });

  it("POST /api/rooms returns 409 for duplicate room number", async () => {
    mocks.db.room.findUnique.mockResolvedValue({ id: "room-1" });

    const response = await createRoom(
      jsonRequest({ number: "101", rent: 3500 })
    );

    await expect(response.json()).resolves.toMatchObject({
      error: "Room number already exists",
    });
    expect(response.status).toBe(409);
    expect(mocks.db.room.create).not.toHaveBeenCalled();
  });

  it("DELETE /api/rooms/:id returns 409 when bills exist", async () => {
    mocks.db.bill.count.mockResolvedValue(1);

    const response = await deleteRoom(new Request("http://localhost"), {
      params: Promise.resolve({ id: "room-1" }),
    });

    await expect(response.json()).resolves.toMatchObject({
      error: "ไม่สามารถลบห้องที่มีประวัติบิล",
    });
    expect(response.status).toBe(409);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("DELETE /api/rooms/:id returns 409 if a bill appears during delete", async () => {
    const error = Object.assign(
      Object.create(Prisma.PrismaClientKnownRequestError.prototype),
      { code: "P2003" }
    );
    mocks.db.bill.count.mockResolvedValue(0);
    mocks.db.tenant.deleteMany.mockReturnValue("delete-tenants");
    mocks.db.room.delete.mockReturnValue("delete-room");
    mocks.db.$transaction.mockRejectedValue(error);

    const response = await deleteRoom(new Request("http://localhost"), {
      params: Promise.resolve({ id: "room-1" }),
    });

    await expect(response.json()).resolves.toMatchObject({
      error: "ไม่สามารถลบห้องที่มีประวัติบิล",
    });
    expect(response.status).toBe(409);
  });

  it("PUT /api/tenants/:id can deactivate a tenant", async () => {
    mocks.db.tenant.findUnique.mockResolvedValue({ roomId: "room-1" });
    mocks.db.tenant.update.mockResolvedValue({
      id: "tenant-1",
      roomId: "room-1",
      name: "Tenant",
      active: false,
    });

    const response = await updateTenant(jsonRequest({ active: false }), {
      params: Promise.resolve({ id: "tenant-1" }),
    });

    await expect(response.json()).resolves.toMatchObject({
      id: "tenant-1",
      active: false,
    });
    expect(response.status).toBe(200);
    expect(mocks.db.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant-1" },
      data: { active: false },
    });
  });
});
