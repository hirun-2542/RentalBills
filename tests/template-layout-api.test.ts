import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUT } from "@/app/api/settings/template/layout/route";
import { POST } from "@/app/api/settings/template/preview/route";
import { GET } from "@/app/api/settings/template/route";

const previewPath = path.join(
  process.cwd(),
  "public",
  "uploads",
  "template",
  "preview-bill.pdf"
);

const layout = {
  pageWidth: 595,
  pageHeight: 842,
  items: [
    {
      id: "tenant",
      type: "variable",
      variable: "tenantName",
      x: 10,
      y: 20,
      width: 120,
      height: 24,
      fontSize: 14,
      fontWeight: "bold",
      color: "#000000",
    },
    {
      id: "label",
      type: "static",
      text: "ผู้เช่า",
      x: 10,
      y: 50,
      width: 120,
      height: 24,
      fontSize: 14,
      fontWeight: "normal",
      color: "#000000",
    },
  ],
};

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    settings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
  renderBillPdf: vi.fn(),
  renderBillPdfFromLayout: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  db: mocks.db,
}));

vi.mock("@/lib/qorstack", () => ({
  renderBillPdf: mocks.renderBillPdf,
}));

vi.mock("@/lib/pdf-renderer", () => ({
  renderBillPdfFromLayout: mocks.renderBillPdfFromLayout,
}));

function putRequest(body: unknown) {
  return new Request("http://localhost/api/settings/template/layout", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("Ticket 020 template layout API", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.auth.mockResolvedValue({ user: { name: "Admin" } });
    mocks.renderBillPdf.mockResolvedValue("https://example.test/preview.pdf");
    mocks.renderBillPdfFromLayout.mockResolvedValue(Buffer.from("%PDF-layout"));
    await rm(previewPath, { force: true });
  });

  it("GET returns layout and backgroundPreviewUrl", async () => {
    mocks.db.settings.findUnique.mockResolvedValue({
      templateLayout: layout,
      templatePreviewPath: "/uploads/template/preview.png",
    });

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      layout,
      backgroundPreviewUrl: "/uploads/template/preview.png",
    });
    expect(response.status).toBe(200);
  });

  it("GET returns null fields when settings do not exist", async () => {
    mocks.db.settings.findUnique.mockResolvedValue(null);

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      layout: null,
      backgroundPreviewUrl: null,
    });
    expect(response.status).toBe(200);
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET();

    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(response.status).toBe(401);
    expect(mocks.db.settings.findUnique).not.toHaveBeenCalled();
  });

  it("PUT returns 401 when unauthenticated", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await PUT(putRequest(layout));

    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(response.status).toBe(401);
    expect(mocks.db.settings.upsert).not.toHaveBeenCalled();
  });

  it("PUT saves a valid layout", async () => {
    const response = await PUT(putRequest(layout));

    await expect(response.json()).resolves.toEqual({ layout });
    expect(response.status).toBe(200);
    expect(mocks.db.settings.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: { id: "singleton", templateLayout: layout },
      update: { templateLayout: layout },
    });
  });

  it("PUT returns 422 for an unsupported variable", async () => {
    const response = await PUT(
      putRequest({
        ...layout,
        items: [{ ...layout.items[0], variable: "notAllowed" }],
      })
    );

    await expect(response.json()).resolves.toEqual({
      error: "items[0].variable is not supported",
    });
    expect(response.status).toBe(422);
    expect(mocks.db.settings.upsert).not.toHaveBeenCalled();
  });

  it("PUT returns 422 when x is not a number", async () => {
    const response = await PUT(
      putRequest({
        ...layout,
        items: [{ ...layout.items[0], x: "10" }],
      })
    );

    await expect(response.json()).resolves.toEqual({
      error: "items[0].x must be a positive number",
    });
    expect(response.status).toBe(422);
  });

  it("PUT returns 422 when variable item has no variable", async () => {
    const { variable: _variable, ...item } = layout.items[0];
    const response = await PUT(putRequest({ ...layout, items: [item] }));

    await expect(response.json()).resolves.toEqual({
      error: "items[0].variable is required",
    });
    expect(response.status).toBe(422);
  });

  it("POST renders a layout preview with Thai sample data", async () => {
    mocks.db.settings.findUnique.mockResolvedValue({
      templateLayout: layout,
      templatePreviewPath: "/uploads/template/preview.png",
    });

    const response = await POST();

    await expect(response.json()).resolves.toEqual({
      previewUrl: "/uploads/template/preview-bill.pdf",
    });
    expect(response.status).toBe(200);
    expect(mocks.renderBillPdfFromLayout).toHaveBeenCalledWith(
      layout,
      expect.objectContaining({ tenantName: "ภิญโญ สมชาย" }),
      path.join(process.cwd(), "public", "/uploads/template/preview.png")
    );
    await expect(readFile(previewPath, "utf8")).resolves.toBe("%PDF-layout");
  });

  it("POST returns 401 when unauthenticated", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await POST();

    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(response.status).toBe(401);
    expect(mocks.renderBillPdfFromLayout).not.toHaveBeenCalled();
    expect(mocks.renderBillPdf).not.toHaveBeenCalled();
  });

  it("POST falls back to renderBillPdf and saves the downloaded PDF", async () => {
    mocks.db.settings.findUnique.mockResolvedValue({ templateLayout: null });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () =>
          new TextEncoder().encode("%PDF-fallback").buffer,
      })
    );

    const response = await POST();

    await expect(response.json()).resolves.toEqual({
      previewUrl: "/uploads/template/preview-bill.pdf",
    });
    expect(response.status).toBe(200);
    expect(mocks.renderBillPdf).toHaveBeenCalledWith(
      expect.objectContaining({ tenantName: "ภิญโญ สมชาย" })
    );
    await expect(readFile(previewPath, "utf8")).resolves.toBe("%PDF-fallback");
  });
});
