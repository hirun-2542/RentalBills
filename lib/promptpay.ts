import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

export async function generatePromptPayQR(
  promptpayId: string,
  amount: number
): Promise<Buffer> {
  const payload = generatePayload(promptpayId, { amount });
  return QRCode.toBuffer(payload, { type: "png", width: 300 });
}
