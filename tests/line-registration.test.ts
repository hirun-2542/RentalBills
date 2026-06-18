import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/line/register/route";
import {
  createLineRegistrationToken,
  verifyLineRegistrationToken,
} from "@/lib/line-registration";

const mocks = vi.hoisted(() => ({
  db: {
    room: { findFirst: vi.fn() },
    tenant: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));

function request(body: unknown) {
  return new Request("http://localhost/api/line/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("LINE registration form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "registration-test-secret";
    mocks.db.tenant.findFirst.mockResolvedValue(null);
    mocks.db.tenant.create.mockResolvedValue(undefined);
    mocks.db.tenant.update.mockResolvedValue(undefined);
  });

  it("creates and verifies a signed registration token", () => {
    const token = createLineRegistrationToken("U123");

    expect(verifyLineRegistrationToken(token)).toBe("U123");
    expect(verifyLineRegistrationToken(`${token}changed`)).toBeNull();
  });

  it("registers a LINE user in an empty room", async () => {
    mocks.db.room.findFirst.mockResolvedValue({
      id: "room-101",
      tenants: [],
    });

    const response = await POST(
      request({
        token: createLineRegistrationToken("U123"),
        name: "สมชาย ใจดี",
        phone: "081-234-5678",
        roomNumber: "101",
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.db.tenant.create).toHaveBeenCalledWith({
      data: {
        roomId: "room-101",
        name: "สมชาย ใจดี",
        phone: "0812345678",
        lineUserId: "U123",
      },
    });
  });

  it("rejects an invalid registration token", async () => {
    const response = await POST(
      request({
        token: "invalid",
        name: "สมชาย ใจดี",
        phone: "0812345678",
        roomNumber: "101",
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.db.room.findFirst).not.toHaveBeenCalled();
  });
});
