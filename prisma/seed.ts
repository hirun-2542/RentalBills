import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  const rooms = [
    { number: "101", rent: 3000 },
    { number: "102", rent: 3500 },
    { number: "103", rent: 4000 },
  ];

  for (const roomData of rooms) {
    const room = await prisma.room.upsert({
      where: { number: roomData.number },
      update: { rent: roomData.rent },
      create: roomData,
    });

    await prisma.tenant.upsert({
      where: { roomId: room.id },
      update: {
        name: `ผู้เช่า ${roomData.number}`,
        active: true,
      },
      create: {
        roomId: room.id,
        name: `ผู้เช่า ${roomData.number}`,
        active: true,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
