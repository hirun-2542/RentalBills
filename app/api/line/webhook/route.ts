import { validateSignature, LineBotClient } from "@line/bot-sdk";
import type { messagingApi, webhook } from "@line/bot-sdk";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBillPreviewUrl } from "@/lib/pdf-storage";

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

async function handleFollow(event: webhook.FollowEvent, token: string) {
  try {
    await replyText(
      event.replyToken!,
      "ยินดีต้อนรับ! 🏠 กรุณาส่งหมายเลขห้องของคุณ (เช่น 101) เพื่อลงทะเบียน LINE ของคุณกับระบบ",
      token
    );
  } catch (err) {
    console.error("[handleFollow error]", err);
  }
}

async function handleRoomLink(
  event: webhook.MessageEvent,
  token: string
) {
  try {
    if (event.message.type !== "text") return;
    if (!event.source?.userId) return;

    const roomNumber = event.message.text.trim();
    const userId = event.source.userId;

    const linkedTenant = await db.tenant.findFirst({
      where: { lineUserId: userId, active: true },
      include: { room: true },
    });
    if (linkedTenant && linkedTenant.room.number !== roomNumber) {
      await replyText(
        event.replyToken!,
        `LINE ของคุณลิงก์กับห้อง ${linkedTenant.room.number} อยู่แล้ว กรุณาติดต่อเจ้าของห้อง`,
        token
      );
      return;
    }

    const room = await db.room.findFirst({
      where: { number: roomNumber },
      include: {
        tenants: {
          where: { active: true },
          take: 1,
        },
      },
    });

    if (!room) {
      await replyText(event.replyToken!, `ไม่พบห้อง ${roomNumber} กรุณาส่งหมายเลขห้องของคุณ เช่น 101`, token);
      return;
    }

    const tenant = room.tenants[0];
    if (!tenant) {
      await replyText(event.replyToken!, `ห้อง ${roomNumber} ไม่มีผู้เช่าอยู่ กรุณาติดต่อเจ้าของห้อง`, token);
      return;
    }

    if (tenant.lineUserId && tenant.lineUserId !== userId) {
      await replyText(event.replyToken!, `ห้อง ${roomNumber} มี LINE อื่นลิงก์อยู่แล้ว กรุณาติดต่อเจ้าของห้อง`, token);
      return;
    }

    if (tenant.lineUserId === userId) {
      await replyText(event.replyToken!, `✅ ห้อง ${roomNumber} (${tenant.name}) ลิงก์ LINE ของคุณไว้แล้ว`, token);
      return;
    }

    await db.tenant.update({
      where: { id: tenant.id },
      data: { lineUserId: userId },
    });

    await replyText(event.replyToken!, `✅ ลิงก์ห้อง ${roomNumber} (${tenant.name}) เรียบร้อยแล้ว`, token);
  } catch (err) {
    console.error("[handleRoomLink error]", err);
  }
}

async function handleBillRequest(
  event: webhook.MessageEvent,
  token: string,
  appUrl: string
) {
  try {
    const userId = event.source?.userId;
    if (!userId) return;

    const tenant = await db.tenant.findFirst({
      where: { lineUserId: userId, active: true },
      include: { room: true },
    });
    if (!tenant) {
      await replyText(event.replyToken!, "ไม่พบข้อมูลผู้เช่า กรุณาลงทะเบียนห้องก่อน", token);
      return;
    }

    const bill = await db.bill.findFirst({
      where: { tenantId: tenant.id, status: "SENT" },
      orderBy: { createdAt: "desc" },
      take: 1,
      include: { room: true },
    });
    if (!bill) {
      await replyText(event.replyToken!, "ไม่พบบิลที่รอชำระ", token);
      return;
    }

    const settings = await db.settings.findUnique({ where: { id: "singleton" } });
    const text = `[ห้อง ${bill.room.number}] บิลค่าน้ำ-ค่าไฟ เดือน ${bill.month}/${bill.year}

ค่าน้ำ: ${bill.waterUsage} หน่วย × ${Number(bill.waterRatePerUnit)} + ${Number(bill.waterCollectionFee)} บาท = ${Number(bill.waterTotal)} บาท
ค่าไฟ: ${bill.elecUsage} หน่วย × ${Number(bill.elecRatePerUnit)} = ${Number(bill.elecTotal)} บาท
ค่าเช่า: ${Number(bill.rent)} บาท
รวมทั้งหมด: ${Number(bill.total)} บาท

ธนาคาร: ${settings?.bankAccountName ?? ""} เลขที่ ${settings?.bankAccountNumber ?? ""}`;
    const messages: messagingApi.Message[] = [{ type: "text", text }];

    if (appUrl.startsWith("https://")) {
      const previewUrl = `${appUrl}${getBillPreviewUrl(bill.id)}`;
      const qrUrl = `${appUrl}/api/bills/${bill.id}/qr`;
      messages.push({
        type: "image",
        originalContentUrl: previewUrl,
        previewImageUrl: previewUrl,
      }, {
        type: "image",
        originalContentUrl: qrUrl,
        previewImageUrl: qrUrl,
      });
    }

    const client = LineBotClient.fromChannelAccessToken({ channelAccessToken: token });
    await client.replyMessage({ replyToken: event.replyToken!, messages });
  } catch (err) {
    console.error("[handleBillRequest error]", err);
  }
}

async function handleComplaint(
  event: webhook.MessageEvent,
  token: string,
  text: string
) {
  try {
    const userId = event.source?.userId;
    if (!userId) return;

    const tenant = await db.tenant.findFirst({
      where: { lineUserId: userId, active: true },
      include: { room: true },
    });
    if (!tenant) {
      await replyText(event.replyToken!, "ไม่พบข้อมูลผู้เช่า กรุณาลงทะเบียนห้องก่อน", token);
      return;
    }

    const detail = text.slice("ร้องเรียน:".length).trim();
    if (!detail) {
      await replyText(event.replyToken!, "กรุณาพิมพ์รายละเอียดต่อจากคำว่า ร้องเรียน:", token);
      return;
    }

    await replyText(
      event.replyToken!,
      `✅ รับเรื่องร้องเรียนของห้อง ${tenant.room.number} แล้ว เจ้าของห้องจะตรวจสอบและติดต่อกลับ`,
      token
    );
  } catch (err) {
    console.error("[handleComplaint error]", err);
  }
}

async function handleSlip(event: webhook.MessageEvent, token: string) {
  try {
    if (event.message.type !== "image") return;
    const userId = event.source?.userId;
    if (!userId) return;

    const tenant = await db.tenant.findFirst({
      where: { lineUserId: userId, active: true },
      include: { room: true },
    });
    if (!tenant) {
      await replyText(event.replyToken!, "ไม่พบข้อมูลผู้เช่า กรุณาลงทะเบียนห้องก่อน", token);
      return;
    }

    const bill = await db.bill.findFirst({
      where: { tenantId: tenant.id, status: "SENT" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    if (!bill) {
      await replyText(event.replyToken!, "ไม่พบบิลที่รอชำระ", token);
      return;
    }

    const client = LineBotClient.fromChannelAccessToken({ channelAccessToken: token });
    const stream = await client.getMessageContent(event.message.id);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const buffer = Buffer.concat(chunks);
    const imageUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;

    await db.$transaction(async (tx) => {
      await tx.paymentSlip.create({
        data: { billId: bill.id, imageUrl, submittedAt: new Date() },
      });
      await tx.bill.update({
        where: { id: bill.id },
        data: { status: "PAID", paidAt: new Date() },
      });
    });
    await replyText(
      event.replyToken!,
      `✅ รับ slip แล้ว บิลเดือน ${bill.month}/${bill.year} ถูกบันทึกว่าชำระแล้ว ขอบคุณ! 🙏`,
      token
    );
  } catch (err) {
    console.error("[handleSlip error]", err);
    try {
      await replyText(event.replyToken!, "เกิดข้อผิดพลาด กรุณาลองใหม่", token);
    } catch (replyErr) {
      console.error("[handleSlip reply error]", replyErr);
    }
  }
}

export async function POST(request: Request) {
  const { channelSecret, channelAccessToken } = getConfig();
  const appUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";

  const body = await request.text();
  const signature = request.headers.get("x-line-signature") ?? "";

  if (!validateSignature(body, channelSecret, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body) as webhook.CallbackRequest;

  await Promise.all(
    payload.events.map(async (event) => {
      try {
        if (event.type === "follow") {
          await handleFollow(event as webhook.FollowEvent, channelAccessToken);
        } else if (event.type === "message") {
          const msgEvent = event as webhook.MessageEvent;
          if (msgEvent.message.type === "text") {
            const text = (msgEvent.message as webhook.TextMessageContent).text.trim().toLowerCase();
            if (text === "บิล") {
              await handleBillRequest(msgEvent, channelAccessToken, appUrl);
            } else if (text.startsWith("ร้องเรียน:")) {
              await handleComplaint(msgEvent, channelAccessToken, text);
            } else {
              await handleRoomLink(msgEvent, channelAccessToken);
            }
          } else if (msgEvent.message.type === "image") {
            await handleSlip(msgEvent, channelAccessToken);
          }
        }
      } catch (err) {
        console.error("[webhook handler error]", err);
      }
    })
  );

  return NextResponse.json({ ok: true });
}
