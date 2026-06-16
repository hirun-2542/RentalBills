import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const uploadDir = path.join(process.cwd(), "public", "uploads", "bills");
const billIdPattern = /^[a-zA-Z0-9_-]+$/;

function assertValidBillId(billId: string) {
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

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, `${billId}.pdf`), buffer);

  return getBillPdfUrl(billId);
}

export async function deleteBillPdf(billId: string): Promise<void> {
  assertValidBillId(billId);

  await unlink(path.join(uploadDir, `${billId}.pdf`)).catch((error) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  });
}
