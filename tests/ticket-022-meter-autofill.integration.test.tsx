import { Prisma } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewBillPage from "@/app/(dashboard)/bills/new/page";
import { POST } from "@/app/api/bills/route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  billCreateForm: vi.fn((_props: unknown) => null),
  bills: [] as Array<Record<string, unknown>>,
  db: {
    bill: {
      create: vi.fn(),
      findMany: vi.fn(),
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

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/components/BillCreateForm", () => ({
  BillCreateForm: mocks.billCreateForm,
}));

const room = {
  id: "room-101",
  number: "101",
  rent: new Prisma.Decimal(3000),
  tenants: [{ id: "tenant-101", name: "Tenant", createdAt: new Date() }],
};

function createBillRequest({
  month,
  waterPrevReading,
  waterCurrReading,
  elecPrevReading,
  elecCurrReading,
}: {
  month: number;
  waterPrevReading: number;
  waterCurrReading: number;
  elecPrevReading: number;
  elecCurrReading: number;
}) {
  return new Request("http://localhost/api/bills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      month,
      year: 2026,
      bills: [
        {
          roomId: room.id,
          waterPrevReading,
          waterCurrReading,
          elecPrevReading,
          elecCurrReading,
        },
      ],
    }),
  });
}

describe("Ticket 022 meter autofill integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bills.length = 0;
    mocks.auth.mockResolvedValue({ user: { name: "Admin" } });
    mocks.db.settings.findUnique.mockResolvedValue({
      waterRatePerUnit: new Prisma.Decimal(9),
      waterCollectionFee: new Prisma.Decimal(10),
      elecRatePerUnit: new Prisma.Decimal(4.75),
    });
    mocks.db.room.findMany.mockImplementation(({ include }) =>
      Promise.resolve(
        include
          ? [room]
          : [
              {
                id: room.id,
                number: room.number,
                tenants: room.tenants,
              },
            ]
      )
    );
    mocks.db.bill.create.mockImplementation(({ data }) => {
      const bill = { id: `bill-${mocks.bills.length + 1}`, ...data };
      mocks.bills.push(bill);
      return bill;
    });
    mocks.db.bill.findMany.mockImplementation(({ where, distinct }) => {
      if (!distinct) {
        return Promise.resolve([]);
      }

      return Promise.resolve(
        [...mocks.bills]
          .filter((bill) =>
            (where.roomId.in as string[]).includes(bill.roomId as string)
          )
          .sort(
            (a, b) =>
              (b.year as number) - (a.year as number) ||
              (b.month as number) - (a.month as number)
          )
          .filter(
            (bill, index, bills) =>
              bills.findIndex((item) => item.roomId === bill.roomId) === index
          )
      );
    });
    mocks.db.$transaction.mockImplementation(async (operations) => operations);
  });

  it("uses month 1 current readings as month 2 previous readings", async () => {
    const month1Response = await POST(
      createBillRequest({
        month: 1,
        waterPrevReading: 10,
        waterCurrReading: 15,
        elecPrevReading: 100,
        elecCurrReading: 120,
      })
    );
    expect(month1Response.status).toBe(201);

    renderToStaticMarkup(await NewBillPage());

    expect(mocks.db.bill.findMany).toHaveBeenLastCalledWith({
      where: { roomId: { in: [room.id] } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      distinct: ["roomId"],
      select: {
        roomId: true,
        waterCurrReading: true,
        elecCurrReading: true,
      },
    });
    expect(mocks.billCreateForm).toHaveBeenCalledWith(
      expect.objectContaining({
        prevReadings: {
          [room.id]: { water: 15, elec: 120 },
        },
      }),
      undefined
    );

    const month2FormProps = mocks.billCreateForm.mock.lastCall?.[0] as {
      prevReadings: Record<string, { water: number; elec: number }>;
    };
    const month2PrevReadings = month2FormProps.prevReadings[room.id];
    const month2Response = await POST(
      createBillRequest({
        month: 2,
        waterPrevReading: month2PrevReadings.water,
        waterCurrReading: 18,
        elecPrevReading: month2PrevReadings.elec,
        elecCurrReading: 130,
      })
    );

    expect(month2Response.status).toBe(201);
    expect(mocks.bills[1]).toMatchObject({
      month: 2,
      waterPrevReading: 15,
      elecPrevReading: 120,
    });
  });

  it("does not query bills when there are no active rooms", async () => {
    mocks.db.room.findMany.mockResolvedValue([]);

    renderToStaticMarkup(await NewBillPage());

    expect(mocks.db.bill.findMany).not.toHaveBeenCalled();
  });
});
