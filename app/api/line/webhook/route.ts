import { validateSignature, LineBotClient } from "@line/bot-sdk";
import type { webhook } from "@line/bot-sdk";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function getConfig() {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelSecret || !channelAccessToken) {
    throw new Error("LINE env vars not configured");
  }
  return { channelSecret, channelAccessToken };
}

async function replyText(replyToken: string, text: string, token: string) {
  const client = LineBotClient.fromChannelAccessToken({ channelAccessToken: token });
  await client.replyMessage({ replyToken, messages: [{ type: "text", text }] });
}

async function handleMessage(
  event: webhook.MessageEvent,
  token: string
) {
  if (event.message.type !== "text") return;
  if (!event.source?.userId) return;

  const roomNumber = event.message.text.trim();
  const userId = event.source.userId;

  const room = await db.room.findFirst({
    where: { number: roomNumber },
    include: { tenants: { where: { active: true }, take: 1 } },
  });

  const tenant = room?.tenants[0];

  if (!room || !tenant) {
    await replyText(event.replyToken!, `ไม่พบห้อง "${roomNumber}" กรุณาส่งหมายเลขห้องของคุณ เช่น 101`, token);
    return;
  }

  await db.tenant.update({
    where: { id: tenant.id },
    data: { lineUserId: userId },
  });

  await replyText(event.replyToken!, `✅ ลิงก์ห้อง ${roomNumber} (${tenant.name}) เรียบร้อยแล้ว`, token);
}

export async function POST(request: Request) {
  const { channelSecret, channelAccessToken } = getConfig();

  const body = await request.text();
  const signature = request.headers.get("x-line-signature") ?? "";

  if (!validateSignature(body, channelSecret, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body) as webhook.CallbackRequest;

  await Promise.all(
    payload.events.map((event) => {
      if (event.type === "message") {
        return handleMessage(event as webhook.MessageEvent, channelAccessToken);
      }
      return Promise.resolve();
    })
  );

  return NextResponse.json({ ok: true });
}
