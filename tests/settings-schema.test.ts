import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();

describe("Ticket 016 settings schema", () => {
  const settingsId = "ticket-016-template-layout";

  afterAll(async () => {
    await prisma.settings.deleteMany({ where: { id: settingsId } });
    await prisma.$disconnect();
  });

  it("stores and reads templateLayout JSON", async () => {
    const templateLayout = {
      title: { x: 24, y: 32 },
      items: ["room", "total"],
    };

    await prisma.settings.create({
      data: {
        id: settingsId,
        templateLayout,
      },
    });

    const settings = await prisma.settings.findUniqueOrThrow({
      where: { id: settingsId },
    });

    expect(settings.templateLayout).toEqual(templateLayout);
  });
});
