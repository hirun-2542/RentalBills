import generatePayload from "promptpay-qr";
import { createRequire } from "module";
import { PassThrough } from "stream";
import puppeteer from "puppeteer";

type LegacyQRCode = {
  drawPNGStream(
    stream: PassThrough,
    payload: string,
    options: { type: "png"; scale: number }
  ): void;
};

const loadModule = createRequire(import.meta.url);
const QRCode = loadModule("qrcode") as LegacyQRCode;

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

  QRCode.drawPNGStream(stream, payload, {
    type: "png",
    scale: 6,
  });

  return result;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function generatePromptPayCard(
  promptpayId: string,
  amount: number,
  recipient: string
): Promise<Buffer> {
  const qr = await generatePromptPayQR(promptpayId, amount);
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 1 });
    await page.setContent(`
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #eef4f8; font-family: "Noto Sans Thai", "Sarabun", sans-serif; color: #12395b; }
        main { width: 900px; height: 1200px; padding: 54px; background: linear-gradient(180deg, #0b4674 0 205px, #eef4f8 205px); }
        header { height: 130px; color: white; text-align: center; }
        header p { margin: 0 0 8px; font-size: 28px; letter-spacing: 3px; font-weight: 700; }
        header h1 { margin: 0; font-size: 62px; line-height: 1; }
        article { margin-top: 18px; border-radius: 32px; background: white; padding: 42px 54px 36px; text-align: center; box-shadow: 0 18px 50px rgba(15, 54, 85, .16); }
        .promptpay { display: inline-flex; align-items: baseline; gap: 10px; color: #0b4674; font-size: 48px; font-weight: 800; }
        .promptpay span { color: #19a998; }
        .amount-label { margin: 22px 0 4px; color: #718398; font-size: 24px; }
        .amount { margin: 0; color: #102f4c; font-size: 64px; font-weight: 800; }
        .qr { width: 520px; height: 520px; margin: 22px auto 14px; object-fit: contain; }
        .recipient { margin: 0; font-size: 26px; color: #415d76; }
        footer { margin-top: 28px; border-radius: 18px; background: #e9f8f5; padding: 20px 24px; color: #087b70; font-size: 25px; font-weight: 700; }
      </style>
      <main>
        <header>
          <p>THAI QR PAYMENT</p>
          <h1>สแกนเพื่อชำระเงิน</h1>
        </header>
        <article>
          <div class="promptpay">Prompt<span>Pay</span></div>
          <p class="amount-label">ยอดที่ต้องชำระ</p>
          <p class="amount">฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <img class="qr" src="data:image/png;base64,${qr.toString("base64")}" />
          <p class="recipient">${escapeHtml(recipient || "PromptPay")}</p>
          <footer>กรุณาส่งสลิปโอนเงินกลับมาที่ช่องทางนี้</footer>
        </article>
      </main>
    `);
    return Buffer.from(await page.screenshot({ type: "png", fullPage: true }));
  } finally {
    await browser.close();
  }
}
