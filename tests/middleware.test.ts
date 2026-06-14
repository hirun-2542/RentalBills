import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn((handler) => handler),
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("redirects unauthenticated /rooms requests to /login", async () => {
    const { default: middleware } = await import("@/middleware");
    const response = (await middleware(
      {
        auth: null,
        nextUrl: new URL("http://localhost/rooms"),
      } as never,
      {} as never
    )) as Response;

    expect(response.headers.get("location")).toBe("http://localhost/login");
    expect(response.status).toBe(307);
  });
});
