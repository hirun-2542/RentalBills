import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  deleteBillPdf,
  getBillPdfUrl,
  saveBillPdf,
} from "@/lib/pdf-storage";

const testBillId = "ticket-015-test";
const testPdfPath = path.join(
  process.cwd(),
  "public",
  "uploads",
  "bills",
  `${testBillId}.pdf`
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
  });
});
