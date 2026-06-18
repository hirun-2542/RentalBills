import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyLineRegistrationToken } from "@/lib/line-registration";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone =
    typeof body?.phone === "string"
      ? body.phone.replace(/[\s-]/g, "")
      : "";
  const roomNumber =
    typeof body?.roomNumber === "string" ? body.roomNumber.trim() : "";
  const lineUserId = verifyLineRegistrationToken(token);

  if (!lineUserId) {
    return NextResponse.json(
      { error: "ลิงก์ลงทะเบียนหมดอายุ กรุณากดปุ่มลงทะเบียนใน LINE ใหม่" },
      { status: 401 }
    );
  }
  if (!name || !/^0\d{8,9}$/.test(phone) || !roomNumber) {
    return NextResponse.json(
      { error: "กรุณากรอกชื่อ เบอร์โทร และเลขห้องให้ถูกต้อง" },
      { status: 400 }
    );
  }

  const linkedTenant = await db.tenant.findFirst({
    where: { lineUserId, active: true },
    include: { room: true },
  });
  if (linkedTenant && linkedTenant.room.number !== roomNumber) {
    return NextResponse.json(
      { error: `LINE นี้ลงทะเบียนกับห้อง ${linkedTenant.room.number} อยู่แล้ว` },
      { status: 409 }
    );
  }

  const room = await db.room.findFirst({
    where: { number: roomNumber },
    include: { tenants: { where: { active: true }, take: 1 } },
  });
  if (!room) {
    return NextResponse.json({ error: "ไม่พบเลขห้องนี้" }, { status: 404 });
  }

  const tenant = room.tenants[0];
  if (tenant?.lineUserId && tenant.lineUserId !== lineUserId) {
    return NextResponse.json(
      { error: "ห้องนี้มี LINE อื่นลงทะเบียนอยู่แล้ว" },
      { status: 409 }
    );
  }

  if (tenant) {
    await db.tenant.update({
      where: { id: tenant.id },
      data: { name, phone, lineUserId },
    });
  } else {
    await db.tenant.create({
      data: { roomId: room.id, name, phone, lineUserId },
    });
  }

  return NextResponse.json({ ok: true, roomNumber });
}
