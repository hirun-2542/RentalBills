import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/line/webhook/route";

const mocks = vi.hoisted(() => ({
  validateSignature: vi.fn(),
  replyMessage: vi.fn(),
  getMessageContent: vi.fn(),
  fromChannelAccessToken: vi.fn(),
  db: {
    room: { findFirst: vi.fn() },
    tenant: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    bill: { findFirst: vi.fn(), update: vi.fn() },
    settings: { findUnique: vi.fn() },
    paymentSlip: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@line/bot-sdk", () => ({
  validateSignature: mocks.validateSignature,
  LineBotClient: {
    fromChannelAccessToken: mocks.fromChannelAccessToken,
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));

const source = { type: "user", userId: "U123" };

function textEvent(text: string) {
  return {
    type: "message",
    replyToken: "reply-token",
    source,
    timestamp: 1,
    mode: "active",
    webhookEventId: "event-id",
    deliveryContext: { isRedelivery: false },
    message: { id: "message-id", type: "text", text },
  };
}

function imageEvent() {
  return {
    ...textEvent(""),
    message: { id: "image-id", type: "image" },
  };
}

function request(events: unknown[], signature = "valid") {
  return new Request("http://localhost/api/line/webhook", {
    method: "POST",
    headers: { "x-line-signature": signature },
    body: JSON.stringify({ destination: "destination", events }),
  });
}

function tenant(lineUserId: string | null = "U123") {
  return {
    id: "tenant-1",
    name: "Alice",
    active: true,
    lineUserId,
    room: { id: "room-1", number: "101" },
  };
}

function bill() {
  return {
    id: "bill-1",
    tenantId: "tenant-1",
    month: 6,
    year: 2026,
    waterUsage: 5,
    waterRatePerUnit: 9,
    waterCollectionFee: 10,
    waterTotal: 55,
    elecUsage: 20,
    elecRatePerUnit: 4.75,
    elecTotal: 95,
    rent: 3000,
    total: 3150,
    pdfUrl: "/bills/bill-1.pdf",
    room: { id: "room-1", number: "101" },
  };
}

function expectReply(text: string) {
  expect(mocks.replyMessage).toHaveBeenCalledWith({
    replyToken: "reply-token",
    messages: [{ type: "text", text }],
  });
}

describe("Ticket 021 LINE webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINE_CHANNEL_SECRET = "secret";
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "token";
    process.env.AUTH_URL = "https://rental.test";
    delete process.env.NEXTAUTH_URL;

    mocks.validateSignature.mockReturnValue(true);
    mocks.fromChannelAccessToken.mockReturnValue({
      replyMessage: mocks.replyMessage,
      getMessageContent: mocks.getMessageContent,
    });
    mocks.replyMessage.mockResolvedValue(undefined);
    mocks.db.tenant.update.mockResolvedValue(undefined);
    mocks.db.tenant.create.mockResolvedValue(undefined);
    mocks.db.bill.update.mockResolvedValue(undefined);
    mocks.db.paymentSlip.create.mockResolvedValue(undefined);
    mocks.db.$transaction.mockImplementation((callback) => callback(mocks.db));
    mocks.db.settings.findUnique.mockResolvedValue({
      bankAccountName: "Rental Bills",
      bankAccountNumber: "123-4-56789-0",
    });
  });

  it("replies with registration instructions on follow", async () => {
    const response = await POST(request([{
      type: "follow",
      replyToken: "reply-token",
      source,
      timestamp: 1,
      mode: "active",
      webhookEventId: "event-id",
      deliveryContext: { isRedelivery: false },
    }]));

    expect(response.status).toBe(200);
    expectReply("ยินดีต้อนรับ! 🏠 กรุณาส่งหมายเลขห้องของคุณ (เช่น 101) เพื่อลงทะเบียน LINE ของคุณกับระบบ");
  });

  it("reports when a room has no active tenant", async () => {
    mocks.db.room.findFirst.mockResolvedValue({ id: "room-1", tenants: [] });

    const response = await POST(request([textEvent("101")]));

    expect(response.status).toBe(200);
    expectReply("ห้อง 101 ไม่มีผู้เช่าอยู่ กรุณาติดต่อเจ้าของห้อง");
  });

  it("reports when a room does not exist", async () => {
    mocks.db.room.findFirst.mockResolvedValue(null);

    const response = await POST(request([textEvent("999")]));

    expect(response.status).toBe(200);
    expectReply("ไม่พบห้อง 999 กรุณาส่งหมายเลขห้องของคุณ เช่น 101");
  });

  it("does not overwrite a different linked LINE user", async () => {
    mocks.db.room.findFirst.mockResolvedValue({
      id: "room-1",
      tenants: [tenant("U999")],
    });

    await POST(request([textEvent("101")]));

    expect(mocks.db.tenant.update).not.toHaveBeenCalled();
    expectReply("ห้อง 101 มี LINE อื่นลิงก์อยู่แล้ว กรุณาติดต่อเจ้าของห้อง");
  });

  it("does not let one LINE user link another room", async () => {
    mocks.db.tenant.findFirst.mockResolvedValue({
      ...tenant(),
      room: { id: "room-1", number: "101" },
    });

    await POST(request([textEvent("102")]));

    expect(mocks.db.room.findFirst).not.toHaveBeenCalled();
    expect(mocks.db.tenant.update).not.toHaveBeenCalled();
    expectReply("LINE ของคุณลิงก์กับห้อง 101 อยู่แล้ว กรุณาติดต่อเจ้าของห้อง");
  });

  it("reports when the same LINE user is already linked", async () => {
    mocks.db.room.findFirst.mockResolvedValue({
      id: "room-1",
      tenants: [tenant()],
    });

    await POST(request([textEvent("101")]));

    expect(mocks.db.tenant.update).not.toHaveBeenCalled();
    expectReply("✅ ห้อง 101 (Alice) ลิงก์ LINE ของคุณไว้แล้ว");
  });

  it("links an unclaimed room tenant", async () => {
    mocks.db.room.findFirst.mockResolvedValue({
      id: "room-1",
      tenants: [tenant(null)],
    });

    await POST(request([textEvent("101")]));

    expect(mocks.db.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant-1" },
      data: { lineUserId: "U123" },
    });
    expectReply("✅ ลิงก์ห้อง 101 (Alice) เรียบร้อยแล้ว");
  });

  it("rejects a bill request from an unknown LINE user", async () => {
    mocks.db.tenant.findFirst.mockResolvedValue(null);

    await POST(request([textEvent(" บิล ")]));

    expectReply("ไม่พบข้อมูลผู้เช่า กรุณาลงทะเบียนห้องก่อน");
  });

  it("reports when a tenant has no SENT bill", async () => {
    mocks.db.tenant.findFirst.mockResolvedValue(tenant());
    mocks.db.bill.findFirst.mockResolvedValue(null);

    await POST(request([textEvent("บิล")]));

    expectReply("ไม่พบบิลที่รอชำระ");
  });

  it("sends bill summary, PDF button, and PromptPay QR", async () => {
    mocks.db.tenant.findFirst.mockResolvedValue(tenant());
    mocks.db.bill.findFirst.mockResolvedValue(bill());

    const response = await POST(request([textEvent("บิล")]));

    expect(response.status).toBe(200);
    expect(mocks.db.bill.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", status: "SENT" },
      orderBy: { createdAt: "desc" },
      take: 1,
      include: { room: true },
    });
    expect(mocks.replyMessage).toHaveBeenCalledWith({
      replyToken: "reply-token",
      messages: [
        {
          type: "text",
          text: expect.stringContaining("[ห้อง 101] บิลค่าน้ำ-ค่าไฟ เดือน 6/2026"),
        },
        {
          type: "template",
          altText: "ดูบิล PDF ห้อง 101",
          template: {
            type: "buttons",
            text: "บิลห้อง 101 เดือน 6/2026",
            actions: [
              {
                type: "uri",
                label: "ดูบิล PDF",
                uri: "https://rental.test/bills/bill-1.pdf",
              },
            ],
          },
        },
        {
          type: "image",
          originalContentUrl: "https://rental.test/api/bills/bill-1/qr",
          previewImageUrl: "https://rental.test/api/bills/bill-1/qr",
        },
      ],
    });
    expect(mocks.replyMessage.mock.calls[0][0].messages[0].text).not.toContain("PDF:");
    expect(mocks.replyMessage.mock.calls[0][0].messages[0].text).toContain(
      "ค่าน้ำ: 5 หน่วย × 9 + 10 บาท = 55 บาท"
    );
  });

  it("registers name, phone, and room for an existing active tenant", async () => {
    mocks.db.tenant.findFirst.mockResolvedValue(null);
    mocks.db.room.findFirst.mockResolvedValue({
      id: "room-1",
      number: "101",
      tenants: [tenant(null)],
    });

    await POST(request([textEvent("ลงทะเบียน: สมชาย ใจดี, 081-234-5678, 101")]));

    expect(mocks.db.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant-1" },
      data: {
        name: "สมชาย ใจดี",
        phone: "0812345678",
        lineUserId: "U123",
      },
    });
    expectReply("✅ ลงทะเบียน สมชาย ใจดี ห้อง 101 เรียบร้อยแล้ว");
  });

  it("creates an active tenant when registering an empty room", async () => {
    mocks.db.tenant.findFirst.mockResolvedValue(null);
    mocks.db.room.findFirst.mockResolvedValue({
      id: "room-1",
      number: "101",
      tenants: [],
    });

    await POST(request([textEvent("ลงทะเบียน: สมชาย ใจดี, 0812345678, 101")]));

    expect(mocks.db.tenant.create).toHaveBeenCalledWith({
      data: {
        roomId: "room-1",
        name: "สมชาย ใจดี",
        phone: "0812345678",
        lineUserId: "U123",
      },
    });
    expectReply("✅ ลงทะเบียน สมชาย ใจดี ห้อง 101 เรียบร้อยแล้ว");
  });

  it("rejects invalid registration details", async () => {
    await POST(request([textEvent("ลงทะเบียน: สมชาย, 123, 101")]));

    expect(mocks.db.room.findFirst).not.toHaveBeenCalled();
    expectReply(
      "กรุณากรอกข้อมูลรูปแบบ ลงทะเบียน: ชื่อ, เบอร์โทร, ห้องพัก เช่น ลงทะเบียน: สมชาย ใจดี, 0812345678, 101"
    );
  });

  it("acknowledges a complaint for the linked room", async () => {
    mocks.db.tenant.findFirst.mockResolvedValue(tenant());

    const response = await POST(request([textEvent("ร้องเรียน: น้ำไม่ไหล")]));

    expect(response.status).toBe(200);
    expectReply("✅ รับเรื่องร้องเรียนของห้อง 101 แล้ว เจ้าของห้องจะตรวจสอบและติดต่อกลับ");
    expect(mocks.db.room.findFirst).not.toHaveBeenCalled();
  });

  it("asks for complaint details when none are provided", async () => {
    mocks.db.tenant.findFirst.mockResolvedValue(tenant());

    await POST(request([textEvent("ร้องเรียน:")]));

    expectReply("กรุณาพิมพ์รายละเอียดต่อจากคำว่า ร้องเรียน:");
  });

  it("rejects a slip from an unknown LINE user", async () => {
    mocks.db.tenant.findFirst.mockResolvedValue(null);

    await POST(request([imageEvent()]));

    expectReply("ไม่พบข้อมูลผู้เช่า กรุณาลงทะเบียนห้องก่อน");
    expect(mocks.getMessageContent).not.toHaveBeenCalled();
  });

  it("stores a slip and marks the latest SENT bill paid", async () => {
    mocks.db.tenant.findFirst.mockResolvedValue(tenant());
    mocks.db.bill.findFirst.mockResolvedValue(bill());
    mocks.getMessageContent.mockResolvedValue(Readable.from([Buffer.from("slip")]));

    const response = await POST(request([imageEvent()]));

    expect(response.status).toBe(200);
    expect(mocks.getMessageContent).toHaveBeenCalledWith("image-id");
    expect(mocks.db.$transaction).toHaveBeenCalledOnce();
    expect(mocks.db.paymentSlip.create).toHaveBeenCalledWith({
      data: {
        billId: "bill-1",
        imageUrl: `data:image/jpeg;base64,${Buffer.from("slip").toString("base64")}`,
        submittedAt: expect.any(Date),
      },
    });
    expect(mocks.db.bill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: { status: "PAID", paidAt: expect.any(Date) },
    });
    expectReply("✅ รับ slip แล้ว บิลเดือน 6/2026 ถูกบันทึกว่าชำระแล้ว ขอบคุณ! 🙏");
  });

  it("reports when a slip sender has no SENT bill", async () => {
    mocks.db.tenant.findFirst.mockResolvedValue(tenant());
    mocks.db.bill.findFirst.mockResolvedValue(null);

    await POST(request([imageEvent()]));

    expectReply("ไม่พบบิลที่รอชำระ");
    expect(mocks.db.paymentSlip.create).not.toHaveBeenCalled();
  });

  it("replies with a retry message when storing a slip fails", async () => {
    mocks.db.tenant.findFirst.mockResolvedValue(tenant());
    mocks.db.bill.findFirst.mockResolvedValue(bill());
    mocks.getMessageContent.mockResolvedValue(Readable.from([Buffer.from("slip")]));
    mocks.db.$transaction.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(request([imageEvent()]));

    expect(response.status).toBe(200);
    expectReply("เกิดข้อผิดพลาด กรุณาลองใหม่");
  });

  it("returns 401 for an invalid signature", async () => {
    mocks.validateSignature.mockReturnValue(false);

    const response = await POST(request([], "invalid"));

    expect(response.status).toBe(401);
    expect(mocks.replyMessage).not.toHaveBeenCalled();
  });

  it("ignores unknown event types", async () => {
    const response = await POST(request([{ type: "unfollow", source }]));

    expect(response.status).toBe(200);
    expect(mocks.replyMessage).not.toHaveBeenCalled();
  });
});
