import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function saveBillPdf(
  billId: string,
  buffer: Buffer
): Promise<string> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "bills");
  const fileName = `${billId}.pdf`;

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), buffer);

  return `/uploads/bills/${fileName}`;
}
