import { RoomManager, type RoomRow } from "@/components/room-manager";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const rooms = await db.room.findMany({
    include: {
      tenants: {
        orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: { number: "asc" },
  });

  const rows: RoomRow[] = rooms.map((room) => ({
    id: room.id,
    number: room.number,
    description: room.description,
    rent: room.rent.toString(),
    tenants: room.tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      phone: tenant.phone,
      lineUserId: tenant.lineUserId,
      active: tenant.active,
    })),
  }));

  return <RoomManager initialRooms={rows} />;
}
