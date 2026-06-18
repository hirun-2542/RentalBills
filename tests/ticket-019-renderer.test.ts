import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderBillFilesFromLayout } from "@/lib/pdf-renderer";
import type { TemplateLayout } from "@/lib/template-editor";

const tempDir = path.join(process.cwd(), "tmp-ticket-019");
const backgroundPath = path.join(tempDir, "background.png");

describe("Ticket 019 PDF renderer", () => {
  beforeAll(async () => {
    await mkdir(tempDir, { recursive: true });
    await writeFile(
      backgroundPath,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lwZ9WQAAAABJRU5ErkJggg==",
        "base64"
      )
    );
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns PDF and PNG preview buffers from layout data", async () => {
    const layout: TemplateLayout = {
      pageWidth: 595,
      pageHeight: 842,
      items: [
        {
          id: "tenant",
          type: "variable",
          variable: "tenantName",
          x: 40,
          y: 40,
          width: 200,
          height: 28,
          fontSize: 16,
          fontWeight: "bold",
          fontFamily: "Sarabun",
          color: "#111111",
        },
        {
          id: "fruit",
          type: "static",
          text: "กล้วยหอม",
          x: 40,
          y: 80,
          width: 200,
          height: 28,
          fontSize: 16,
          fontWeight: "normal",
          fontFamily: "Sarabun",
          color: "#111111",
        },
      ],
    };

    const files = await renderBillFilesFromLayout(
      layout,
      { tenantName: "ภิญโญ สมชาย" },
      backgroundPath
    );

    expect(files.pdf.length).toBeGreaterThan(1000);
    expect(files.pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(files.preview.length).toBeGreaterThan(1000);
    expect(files.preview.subarray(1, 4).toString()).toBe("PNG");
  });
});
