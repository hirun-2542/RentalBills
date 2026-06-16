import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  deleteBillPdf,
  getBillPdfUrl,
  saveBillPdf,
} from "@/lib/pdf-storage";

const billId = "ticket-019-test";
const pdfPath = path.join(
  process.cwd(),
  "public",
  "uploads",
  "bills",
  `${billId}.pdf`
);

describe("PDF storage", () => {
  afterEach(async () => {
    await deleteBillPdf(billId);
  });

  it("saves, urls, and deletes bill PDFs", async () => {
    await expect(saveBillPdf(billId, Buffer.from("pdf"))).resolves.toBe(
      "/uploads/bills/ticket-019-test.pdf"
    );
    await expect(readFile(pdfPath, "utf8")).resolves.toBe("pdf");

    expect(getBillPdfUrl(billId)).toBe("/uploads/bills/ticket-019-test.pdf");
    await expect(deleteBillPdf(billId)).resolves.toBeUndefined();
    await expect(access(pdfPath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(deleteBillPdf(billId)).resolves.toBeUndefined();
  });

  it("rejects unsafe bill IDs", async () => {
    expect(() => getBillPdfUrl("../bill-123")).toThrow("Invalid billId");
    await expect(saveBillPdf("../bill-123", Buffer.from("pdf"))).rejects.toThrow(
      "Invalid billId"
    );
    await expect(deleteBillPdf("../bill-123")).rejects.toThrow("Invalid billId");
  });
});
