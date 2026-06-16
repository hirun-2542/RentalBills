import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DELETE,
  POST,
} from "@/app/api/settings/template/background/route";

const uploadDir = path.join(
  process.cwd(),
  "public",
  "uploads",
  "template"
);

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  convertToPreviewPng: vi.fn(),
  db: {
    settings: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  db: mocks.db,
}));

vi.mock("@/lib/template-converter", () => ({
  convertToPreviewPng: mocks.convertToPreviewPng,
}));

function uploadRequest(name: string, type: string, content = "template") {
  const formData = new FormData();
  formData.set("file", new File([content], name, { type }));

  return new Request("http://localhost/api/settings/template/background", {
    method: "POST",
    body: formData,
  });
}

describe("Ticket 017 template background API", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { name: "Admin" } });
    mocks.db.settings.upsert.mockResolvedValue({});
    mocks.convertToPreviewPng.mockImplementation(async (inputPath: string) => {
      const previewPath = path.join(path.dirname(inputPath), "preview.png");
      await writeFile(previewPath, "preview");
      return previewPath;
    });
    await mkdir(uploadDir, { recursive: true });
    await Promise.all(
      ["background.docx", "background.pdf", "preview.png"].map((file) =>
        rm(path.join(uploadDir, file), { force: true })
      )
    );
  });

  it("POST returns 401 when unauthenticated", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await POST(uploadRequest("lease.pdf", "application/pdf"));

    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(response.status).toBe(401);
    expect(mocks.convertToPreviewPng).not.toHaveBeenCalled();
  });

  it("POST saves a DOCX background and updates settings", async () => {
    const response = await POST(
      uploadRequest(
        "lease.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    );

    await expect(response.json()).resolves.toEqual({
      backgroundPath: "/uploads/template/background.docx",
      previewUrl: "/uploads/template/preview.png",
    });
    expect(response.status).toBe(200);
    await expect(
      readFile(path.join(uploadDir, "background.docx"), "utf8")
    ).resolves.toBe("template");
    expect(mocks.convertToPreviewPng).toHaveBeenCalledWith(
      expect.stringMatching(/template-background-.+\/background\.docx$/),
      "docx"
    );
    expect(mocks.db.settings.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        templateBackgroundPath: "/uploads/template/background.docx",
        templatePreviewPath: "/uploads/template/preview.png",
      },
      update: {
        templateBackgroundPath: "/uploads/template/background.docx",
        templatePreviewPath: "/uploads/template/preview.png",
      },
    });
  });

  it("POST saves a PDF background and removes an old DOCX", async () => {
    await writeFile(path.join(uploadDir, "background.docx"), "old");

    const response = await POST(uploadRequest("lease.pdf", "application/pdf"));

    expect(response.status).toBe(200);
    expect(existsSync(path.join(uploadDir, "background.docx"))).toBe(false);
    await expect(
      readFile(path.join(uploadDir, "background.pdf"), "utf8")
    ).resolves.toBe("template");
    expect(mocks.convertToPreviewPng).toHaveBeenCalledWith(
      expect.stringMatching(/template-background-.+\/background\.pdf$/),
      "pdf"
    );
  });

  it("POST returns 400 for unsupported file types", async () => {
    const response = await POST(uploadRequest("photo.jpg", "image/jpeg"));

    await expect(response.json()).resolves.toEqual({
      error: "Only .docx and .pdf files are supported",
    });
    expect(response.status).toBe(400);
    expect(mocks.convertToPreviewPng).not.toHaveBeenCalled();
    expect(mocks.db.settings.upsert).not.toHaveBeenCalled();
  });

  it("POST returns 400 for oversized files", async () => {
    const response = await POST(
      uploadRequest("lease.pdf", "application/pdf", "x".repeat(10 * 1024 * 1024 + 1))
    );

    await expect(response.json()).resolves.toEqual({
      error: "File must be 10MB or smaller",
    });
    expect(response.status).toBe(400);
    expect(mocks.convertToPreviewPng).not.toHaveBeenCalled();
  });

  it("POST returns conversion errors without replacing current files", async () => {
    await writeFile(path.join(uploadDir, "background.pdf"), "old");
    await writeFile(path.join(uploadDir, "preview.png"), "old-preview");
    mocks.convertToPreviewPng.mockRejectedValue(
      new Error("LibreOffice failed to convert template preview")
    );

    const response = await POST(uploadRequest("lease.pdf", "application/pdf"));

    await expect(response.json()).resolves.toEqual({
      error: "LibreOffice failed to convert template preview",
    });
    expect(response.status).toBe(500);
    await expect(
      readFile(path.join(uploadDir, "background.pdf"), "utf8")
    ).resolves.toBe("old");
    await expect(
      readFile(path.join(uploadDir, "preview.png"), "utf8")
    ).resolves.toBe("old-preview");
    expect(mocks.db.settings.upsert).not.toHaveBeenCalled();
  });

  it("DELETE removes template files and resets settings", async () => {
    await writeFile(path.join(uploadDir, "background.docx"), "old");
    await writeFile(path.join(uploadDir, "background.pdf"), "old");
    await writeFile(path.join(uploadDir, "preview.png"), "old");
    await writeFile(path.join(uploadDir, "background2.png"), "old");

    const response = await DELETE();

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(200);
    expect(existsSync(path.join(uploadDir, "background.docx"))).toBe(false);
    expect(existsSync(path.join(uploadDir, "background.pdf"))).toBe(false);
    expect(existsSync(path.join(uploadDir, "preview.png"))).toBe(false);
    expect(existsSync(path.join(uploadDir, "background2.png"))).toBe(false);
    expect(mocks.db.settings.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        templateBackgroundPath: null,
        templatePreviewPath: null,
        templateLayout: Prisma.DbNull,
      },
      update: {
        templateBackgroundPath: null,
        templatePreviewPath: null,
        templateLayout: Prisma.DbNull,
      },
    });
  });

  it("DELETE returns 401 when unauthenticated", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await DELETE();

    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(response.status).toBe(401);
    expect(mocks.db.settings.upsert).not.toHaveBeenCalled();
  });
});
