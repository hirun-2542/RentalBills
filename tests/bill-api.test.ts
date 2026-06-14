import { BillStatus, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DELETE,
  GET as getBill,
  PUT,
} from "@/app/api/bills/[id]/route";
import { POST as markPaid } from "@/app/api/bills/[id]/paid/route";
import { GET, POST } from "@/app/api/bills/route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    bill: {
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    room: {
      findMany: vi.fn(),
    },
    settings: {
      findUnique: vi.fn(),
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
  return new Request("http://localhost/api/bills", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function decimal(value: number) {
  return new Prisma.Decimal(value);
}

const billPayload = {
  month: 6,
  year: 2026,
  bills: [
    {
      roomId: "room-101",
      waterPrevReading: 10,
      waterCurrReading: 15,
      elecPrevReading: 100,
      elecCurrReading: 120,
    },
    {
      roomId: "room-102",
      waterPrevReading: 20,
      waterCurrReading: 23,
      elecPrevReading: 200,
      elecCurrReading: 210,
    },
  ],
};

describe("Ticket 006 bill API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { name: "Admin" } });
    mocks.db.settings.findUnique.mockResolvedValue({
      waterRatePerUnit: decimal(9),
      waterCollectionFee: decimal(10),
      elecRatePerUnit: decimal(4.75),
    });
    mocks.db.room.findMany.mockResolvedValue([
      {
        id: "room-101",
        number: "101",
        rent: decimal(3000),
        tenants: [{ id: "tenant-101" }],
      },
      {
        id: "room-102",
        number: "102",
        rent: decimal(3500),
        tenants: [{ id: "tenant-102" }],
      },
    ]);
    mocks.db.bill.findMany.mockResolvedValue([]);
    mocks.db.bill.create.mockImplementation(({ data }) => ({
      id: `${data.roomId}-bill`,
      ...data,
    }));
    mocks.db.$transaction.mockImplementation(async (operations) => operations);
  });

  it("POST /api/bills creates all bills in one transaction", async () => {
    const response = await POST(jsonRequest(billPayload));

    await expect(response.json()).resolves.toMatchObject({
      bills: [
        expect.objectContaining({ roomId: "room-101" }),
        expect.objectContaining({ roomId: "room-102" }),
      ],
      skipped: [],
    });
    expect(response.status).toBe(201);
    expect(mocks.db.bill.create).toHaveBeenCalledTimes(2);
    expect(mocks.db.$transaction).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ roomId: "room-101" }),
        expect.objectContaining({ roomId: "room-102" }),
      ])
    );
  });

  it("returns 400 when current water reading is lower than previous reading", async () => {
    const response = await POST(
      jsonRequest({
        ...billPayload,
        bills: [
          {
            ...billPayload.bills[0],
            waterCurrReading: 5,
          },
        ],
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      errors: [
        {
          roomId: "room-101",
          error: "ค่ามิเตอร์น้ำไม่ถูกต้อง (ค่าปัจจุบันน้อยกว่าค่าก่อนหน้า)",
        },
      ],
    });
    expect(response.status).toBe(400);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("returns 409 with duplicate rooms for existing month and year bills", async () => {
    mocks.db.bill.findMany.mockResolvedValue([
      {
        roomId: "room-101",
        room: { number: "101" },
      },
    ]);

    const response = await POST(jsonRequest(billPayload));

    await expect(response.json()).resolves.toMatchObject({
      error: "Duplicate bills",
      duplicates: [{ roomId: "room-101", roomNumber: "101" }],
    });
    expect(response.status).toBe(409);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("uses Settings and room rent snapshots for bill totals", async () => {
    await POST(jsonRequest(billPayload));

    expect(mocks.db.bill.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roomId: "room-101",
          waterRatePerUnit: 9,
          waterCollectionFee: 10,
          elecRatePerUnit: 4.75,
          rent: 3000,
          waterUsage: 5,
          waterTotal: 55,
          elecUsage: 20,
          elecTotal: 95,
          total: 3150,
        }),
      })
    );
  });

  it("POST /api/bills returns skipped rooms without active tenants or missing rooms", async () => {
    mocks.db.room.findMany.mockResolvedValue([
      {
        id: "room-101",
        number: "101",
        rent: decimal(3000),
        tenants: [{ id: "tenant-101" }],
      },
      {
        id: "room-102",
        number: "102",
        rent: decimal(3500),
        tenants: [],
      },
    ]);

    const response = await POST(
      jsonRequest({
        ...billPayload,
        bills: [
          ...billPayload.bills,
          {
            roomId: "room-999",
            waterPrevReading: 1,
            waterCurrReading: 2,
            elecPrevReading: 1,
            elecCurrReading: 2,
          },
        ],
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      bills: [expect.objectContaining({ roomId: "room-101" })],
      skipped: [
        { roomId: "room-102", reason: "No active tenant" },
        { roomId: "room-999", reason: "Room not found" },
      ],
    });
    expect(response.status).toBe(201);
    expect(mocks.db.bill.create).toHaveBeenCalledTimes(1);
  });

  it("GET /api/bills filters by month, year, and status", async () => {
    mocks.db.bill.findMany.mockResolvedValue([]);

    const response = await GET(
      new Request("http://localhost/api/bills?month=6&year=2026&status=DRAFT")
    );

    await expect(response.json()).resolves.toEqual([]);
    expect(response.status).toBe(200);
    expect(mocks.db.bill.findMany).toHaveBeenCalledWith({
      where: { month: 6, year: 2026, status: BillStatus.DRAFT },
      include: { tenant: true, room: true },
      orderBy: { room: { number: "asc" } },
    });
  });

  it("GET /api/bills/:id returns bill details", async () => {
    mocks.db.bill.findUnique.mockResolvedValue({
      id: "bill-1",
      total: decimal(3150),
      tenant: { id: "tenant-101" },
      room: { id: "room-101", number: "101" },
      paymentSlips: [],
    });

    const response = await getBill(new Request("http://localhost"), {
      params: Promise.resolve({ id: "bill-1" }),
    });

    await expect(response.json()).resolves.toMatchObject({
      id: "bill-1",
      total: 3150,
      tenant: { id: "tenant-101" },
      room: { number: "101" },
      paymentSlips: [],
    });
    expect(response.status).toBe(200);
    expect(mocks.db.bill.findUnique).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      include: { tenant: true, room: true, paymentSlips: true },
    });
  });

  it("PUT /api/bills/:id recalculates totals with snapshotted rates", async () => {
    mocks.db.bill.findUnique.mockResolvedValue({
      status: BillStatus.DRAFT,
      waterPrevReading: 10,
      waterCurrReading: 15,
      waterRatePerUnit: decimal(9),
      waterCollectionFee: decimal(10),
      elecPrevReading: 100,
      elecCurrReading: 120,
      elecRatePerUnit: decimal(4.75),
      rent: decimal(3000),
    });
    mocks.db.bill.update.mockResolvedValue({
      id: "bill-1",
      waterUsage: 10,
      waterTotal: decimal(100),
      elecUsage: 30,
      elecTotal: decimal(142.5),
      total: decimal(3242.5),
    });

    const response = await PUT(
      jsonRequest({ waterCurrReading: 20, elecCurrReading: 130 }),
      { params: Promise.resolve({ id: "bill-1" }) }
    );

    await expect(response.json()).resolves.toMatchObject({
      id: "bill-1",
      waterTotal: 100,
      elecTotal: 142.5,
      total: 3242.5,
    });
    expect(response.status).toBe(200);
    expect(mocks.db.bill.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bill-1" },
        data: expect.objectContaining({
          waterUsage: 10,
          waterTotal: 100,
          elecUsage: 30,
          elecTotal: 142.5,
          total: 3242.5,
        }),
      })
    );
  });

  it("PUT /api/bills/:id returns 409 for SENT bills", async () => {
    mocks.db.bill.findUnique.mockResolvedValue({ status: BillStatus.SENT });

    const response = await PUT(jsonRequest({ waterCurrReading: 30 }), {
      params: Promise.resolve({ id: "bill-1" }),
    });

    await expect(response.json()).resolves.toMatchObject({
      error: "Only draft bills can be updated",
    });
    expect(response.status).toBe(409);
    expect(mocks.db.bill.update).not.toHaveBeenCalled();
  });

  it("DELETE /api/bills/:id returns 409 for SENT bills", async () => {
    mocks.db.bill.findUnique.mockResolvedValue({ status: BillStatus.SENT });

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "bill-1" }),
    });

    await expect(response.json()).resolves.toMatchObject({
      error: "Only draft bills can be deleted",
    });
    expect(response.status).toBe(409);
    expect(mocks.db.bill.delete).not.toHaveBeenCalled();
  });

  it("POST /api/bills/:id/paid marks DRAFT bills as PAID", async () => {
    mocks.db.bill.findUnique.mockResolvedValue({ status: BillStatus.DRAFT });
    mocks.db.bill.update.mockResolvedValue({
      id: "bill-1",
      status: BillStatus.PAID,
      paidAt: new Date("2026-06-14T00:00:00.000Z"),
    });

    const response = await markPaid(new Request("http://localhost"), {
      params: Promise.resolve({ id: "bill-1" }),
    });

    await expect(response.json()).resolves.toMatchObject({
      id: "bill-1",
      status: BillStatus.PAID,
      paidAt: "2026-06-14T00:00:00.000Z",
    });
    expect(response.status).toBe(200);
    expect(mocks.db.bill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: {
        status: BillStatus.PAID,
        paidAt: expect.any(Date),
      },
      include: { tenant: true, room: true },
    });
  });

  it.each([
    ["GET /api/bills", () => GET(new Request("http://localhost/api/bills"))],
    [
      "POST /api/bills",
      () => POST(jsonRequest({ month: 6, year: 2026, bills: [] })),
    ],
    [
      "GET /api/bills/:id",
      () =>
        getBill(new Request("http://localhost"), {
          params: Promise.resolve({ id: "bill-1" }),
        }),
    ],
    [
      "PUT /api/bills/:id",
      () =>
        PUT(jsonRequest({ waterCurrReading: 20 }), {
          params: Promise.resolve({ id: "bill-1" }),
        }),
    ],
    [
      "DELETE /api/bills/:id",
      () =>
        DELETE(new Request("http://localhost"), {
          params: Promise.resolve({ id: "bill-1" }),
        }),
    ],
    [
      "POST /api/bills/:id/paid",
      () =>
        markPaid(new Request("http://localhost"), {
          params: Promise.resolve({ id: "bill-1" }),
        }),
    ],
  ])("returns 401 for unauthenticated %s", async (_name, requestHandler) => {
    mocks.auth.mockResolvedValue(null);

    const response = await requestHandler();

    await expect(response.json()).resolves.toMatchObject({
      error: "Unauthorized",
    });
    expect(response.status).toBe(401);
  });
});
