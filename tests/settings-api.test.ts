import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/settings/route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    settings: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  db: mocks.db,
}));

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/settings", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("Ticket 005 settings API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { name: "Admin" } });
  });

  it("GET /api/settings returns settings and creates singleton when missing", async () => {
    mocks.db.settings.upsert.mockResolvedValue({
      id: "singleton",
      waterRatePerUnit: new Prisma.Decimal(9),
      waterCollectionFee: new Prisma.Decimal(10),
      elecRatePerUnit: new Prisma.Decimal(4.75),
      bankAccountName: "",
      bankAccountNumber: "",
      promptpayNumber: "",
      updatedAt: new Date("2026-06-15T00:00:00.000Z"),
    });

    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({
      id: "singleton",
      waterRatePerUnit: 9,
      waterCollectionFee: 10,
      elecRatePerUnit: 4.75,
    });
    expect(response.status).toBe(200);
    expect(mocks.db.settings.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    });
  });

  it("PUT /api/settings returns 400 for negative numbers", async () => {
    const response = await PUT(
      jsonRequest({
        waterRatePerUnit: -1,
        waterCollectionFee: 10,
        elecRatePerUnit: 4.75,
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      errors: { waterRatePerUnit: "Must be a non-negative number" },
    });
    expect(response.status).toBe(400);
    expect(mocks.db.settings.upsert).not.toHaveBeenCalled();
  });

  it("PUT /api/settings returns 400 for invalid numbers", async () => {
    const response = await PUT(
      jsonRequest({
        waterRatePerUnit: null,
        waterCollectionFee: "abc",
        elecRatePerUnit: 4.75,
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      errors: {
        waterRatePerUnit: "Must be a non-negative number",
        waterCollectionFee: "Must be a non-negative number",
      },
    });
    expect(response.status).toBe(400);
    expect(mocks.db.settings.upsert).not.toHaveBeenCalled();
  });

  it("PUT /api/settings updates valid values", async () => {
    mocks.db.settings.upsert.mockResolvedValue({
      id: "singleton",
      waterRatePerUnit: new Prisma.Decimal(11),
      waterCollectionFee: new Prisma.Decimal(12),
      elecRatePerUnit: new Prisma.Decimal(5),
      bankAccountName: "Rental Bills",
      bankAccountNumber: "123",
      promptpayNumber: "0812345678",
      updatedAt: new Date("2026-06-15T00:00:00.000Z"),
    });

    const body = {
      waterRatePerUnit: 11,
      waterCollectionFee: 12,
      elecRatePerUnit: 5,
      bankAccountName: "Rental Bills",
      bankAccountNumber: "123",
      promptpayNumber: "0812345678",
    };
    const response = await PUT(jsonRequest(body));

    await expect(response.json()).resolves.toMatchObject(body);
    expect(response.status).toBe(200);
    expect(mocks.db.settings.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: { id: "singleton", ...body },
      update: body,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET();

    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(response.status).toBe(401);
    expect(mocks.db.settings.upsert).not.toHaveBeenCalled();
  });
});
