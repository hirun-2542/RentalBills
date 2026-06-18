import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  deleteBillPdf,
  getBillPdfUrl,
  getBillPreviewUrl,
  saveBillPdf,
  saveBillPreview,
} from "@/lib/pdf-storage";

const testBillId = "ticket-015-test";
const testPdfPath = path.join(
  process.cwd(),
  "public",
  "uploads",
  "bills",
  `${testBillId}.pdf`
);
const testPreviewPath = path.join(
  process.cwd(),
  "public",
  "uploads",
  "bills",
  `${testBillId}.png`
);

describe("PDF storage", () => {
  afterEach(async () => {
    await deleteBillPdf(testBillId);
  });

  it("saves a bill PDF and returns its public URL", async () => {
    const url = await saveBillPdf(testBillId, Buffer.from("pdf"));

    await expect(fs.readFile(testPdfPath, "utf8")).resolves.toBe("pdf");
    expect(url).toBe("/uploads/bills/ticket-015-test.pdf");
  });

  it("saves a bill preview and returns its public URL", async () => {
    const url = await saveBillPreview(testBillId, Buffer.from("png"));

    await expect(fs.readFile(testPreviewPath, "utf8")).resolves.toBe("png");
    expect(url).toBe("/uploads/bills/ticket-015-test.png");
  });

  it("deletes a bill PDF and ignores missing files", async () => {
    await saveBillPdf(testBillId, Buffer.from("pdf"));

    await expect(deleteBillPdf(testBillId)).resolves.toBeUndefined();
    await expect(fs.access(testPdfPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(deleteBillPdf(testBillId)).resolves.toBeUndefined();
  });

  it("returns a bill PDF URL", () => {
    expect(getBillPdfUrl("bill-123")).toBe("/uploads/bills/bill-123.pdf");
    expect(getBillPreviewUrl("bill-123")).toBe("/uploads/bills/bill-123.png");
  });

  it("rejects unsafe bill IDs", async () => {
    expect(() => getBillPdfUrl("../bill-123")).toThrow("Invalid billId");
    await expect(saveBillPdf("../bill-123", Buffer.from("pdf"))).rejects.toThrow(
      "Invalid billId"
    );
    await expect(saveBillPreview("../bill-123", Buffer.from("png"))).rejects.toThrow(
      "Invalid billId"
    );
    await expect(deleteBillPdf("../bill-123")).rejects.toThrow(
      "Invalid billId"
    );
  });
});
