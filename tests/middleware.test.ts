import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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

  it.each(["/rooms", "/settings"])(
    "redirects unauthenticated %s requests to /login",
    async (path) => {
      const { default: middleware } = await import("@/middleware");
      const request = Object.assign(
        new NextRequest(`http://localhost${path}`),
        {
          auth: null,
        }
      );
      const context = { params: Promise.resolve({}) };

      const response = (await middleware(request, context)) as Response;

      expect(response.headers.get("location")).toBe("http://localhost/login");
      expect(response.status).toBe(307);
    }
  );
});
