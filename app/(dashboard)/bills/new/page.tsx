import { BillCreateForm } from "@/components/BillCreateForm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewBillPage() {
  const rooms = await db.room.findMany({
    where: { tenants: { some: { active: true } } },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      tenants: {
        where: { active: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, name: true },
      },
    },
  });
  const activeRooms = rooms.map((room) => ({
    id: room.id,
    number: room.number,
    tenant: room.tenants[0],
  }));
  const latestBills = activeRooms.length
    ? await db.bill.findMany({
        where: { roomId: { in: activeRooms.map((room) => room.id) } },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        distinct: ["roomId"],
        select: {
          roomId: true,
          waterCurrReading: true,
          elecCurrReading: true,
        },
      })
    : [];
  const prevReadings: Record<string, { water: number; elec: number }> =
    Object.fromEntries(
      latestBills.map((bill) => [
        bill.roomId,
        { water: bill.waterCurrReading, elec: bill.elecCurrReading },
      ])
    );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">สร้างบิล</h1>
        <p className="text-sm text-muted-foreground">
          กรอกค่ามิเตอร์ของห้องที่มีผู้เช่าปัจจุบัน
        </p>
      </div>

      {activeRooms.length === 0 ? (
        <div
          role="alert"
          className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground"
        >
          ไม่มีห้องที่มีผู้เช่าอยู่ในขณะนี้
        </div>
      ) : null}

      <BillCreateForm prevReadings={prevReadings} rooms={activeRooms} />
    </div>
  );
}
