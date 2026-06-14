import generatePayload from "promptpay-qr";
import QRCode from "qrcode";
import { PassThrough } from "stream";

type LegacyQRCode = {
  drawPNGStream(
    stream: PassThrough,
    payload: string,
    options: { type: "png"; scale: number }
  ): void;
};

export async function generatePromptPayQR(
  promptpayId: string,
  amount: number
): Promise<Buffer> {
  const payload = generatePayload(promptpayId, { amount });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });

  (QRCode as unknown as LegacyQRCode).drawPNGStream(stream, payload, {
    type: "png",
    scale: 6,
  });

  return result;
}
