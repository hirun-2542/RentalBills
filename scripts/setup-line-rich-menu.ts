import puppeteer from "puppeteer";
import { LineBotClient, type messagingApi } from "@line/bot-sdk";

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");

const menu: messagingApi.RichMenuRequest = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: "RentalBills main menu",
  chatBarText: "เมนูบริการ",
  areas: [
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: "message", label: "ดูบิล", text: "บิล" },
    },
    {
      bounds: { x: 833, y: 0, width: 834, height: 843 },
      action: {
        type: "postback",
        label: "ลงทะเบียน",
        data: "action=register",
        inputOption: "openKeyboard",
        fillInText: "ลงทะเบียน: ชื่อ, เบอร์โทร, ห้องพัก",
      },
    },
    {
      bounds: { x: 1667, y: 0, width: 833, height: 843 },
      action: {
        type: "postback",
        label: "ร้องเรียน",
        data: "action=complaint",
        inputOption: "openKeyboard",
        fillInText: "ร้องเรียน: ",
      },
    },
  ],
};

async function renderMenu() {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 2500, height: 843, deviceScaleFactor: 1 });
    await page.setContent(`
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; font-family: "Noto Sans Thai", "Sarabun", sans-serif; }
        main { display: flex; width: 2500px; height: 843px; background: #f5f1e8; }
        section { display: grid; place-content: center; width: 33.333%; text-align: center; }
        section:first-child { background: #153d35; color: white; }
        section:nth-child(2) { background: #d7b56d; color: #153d35; }
        section:last-child { color: #153d35; border: 18px solid #153d35; }
        .icon { font-size: 150px; line-height: 1; }
        h1 { margin: 36px 0 10px; font-size: 78px; }
        p { margin: 0; font-size: 34px; opacity: .8; }
      </style>
      <main>
        <section><div class="icon">📄</div><h1>ดูบิล</h1><p>PDF และ QR PromptPay</p></section>
        <section><div class="icon">📝</div><h1>ลงทะเบียน</h1><p>ชื่อ เบอร์โทร ห้องพัก</p></section>
        <section><div class="icon">🛠️</div><h1>ร้องเรียน</h1><p>แจ้งปัญหาห้องพัก</p></section>
      </main>
    `);
    return Buffer.from(await page.screenshot({ type: "png", fullPage: true }));
  } finally {
    await browser.close();
  }
}

async function main() {
  const client = LineBotClient.fromChannelAccessToken({
    channelAccessToken: token!,
  });

  await client.validateRichMenuObject(menu);
  const { richMenuId } = await client.createRichMenu(menu);
  await client.setRichMenuImage(
    richMenuId,
    new Blob([new Uint8Array(await renderMenu())], { type: "image/png" })
  );
  await client.setDefaultRichMenu(richMenuId);

  console.log(`LINE rich menu installed: ${richMenuId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
