import { promises as fs } from "node:fs";
import path from "node:path";

const billsUploadDir = path.join(process.cwd(), "public", "uploads", "bills");
const billIdPattern = /^[a-zA-Z0-9_-]+$/;

function assertValidBillId(billId: string): void {
  if (!billIdPattern.test(billId)) {
    throw new Error("Invalid billId");
  }
}

export function getBillPdfUrl(billId: string): string {
  assertValidBillId(billId);

  return `/uploads/bills/${billId}.pdf`;
}

export async function saveBillPdf(
  billId: string,
  buffer: Buffer
): Promise<string> {
  assertValidBillId(billId);

  await fs.mkdir(billsUploadDir, { recursive: true });
  await fs.writeFile(path.join(billsUploadDir, `${billId}.pdf`), buffer);

  return getBillPdfUrl(billId);
}

export async function deleteBillPdf(billId: string): Promise<void> {
  assertValidBillId(billId);

  try {
    await fs.unlink(path.join(billsUploadDir, `${billId}.pdf`));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
