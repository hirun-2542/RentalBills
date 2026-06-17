import { Prisma } from "@prisma/client";

export function serialize(data: unknown): unknown {
  if (data instanceof Prisma.Decimal) return data.toNumber();
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(serialize);
  if (data && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, serialize(value)])
    );
  }
  return data;
}
