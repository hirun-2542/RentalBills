import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendBillMessages } from "@/lib/line";

const mocks = vi.hoisted(() => ({
  pushMessage: vi.fn(),
  fromChannelAccessToken: vi.fn(),
}));

vi.mock("@line/bot-sdk", () => ({
  LineBotClient: {
    fromChannelAccessToken: mocks.fromChannelAccessToken,
  },
}));

describe("LINE wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
    mocks.fromChannelAccessToken.mockReturnValue({
      pushMessage: mocks.pushMessage,
    });
    mocks.pushMessage.mockResolvedValue(undefined);
  });

  it("creates a client with LINE_CHANNEL_ACCESS_TOKEN", async () => {
    await sendBillMessages("U123", [{ type: "text", text: "hello" }]);

    expect(mocks.fromChannelAccessToken).toHaveBeenCalledWith({
      channelAccessToken: "test-token",
    });
    expect(mocks.pushMessage).toHaveBeenCalledWith({
      to: "U123",
      messages: [{ type: "text", text: "hello" }],
    });
  });

  it("throws a clear error when LINE_CHANNEL_ACCESS_TOKEN is missing", async () => {
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;

    await expect(
      sendBillMessages("U123", [{ type: "text", text: "hello" }])
    ).rejects.toThrow("LINE_CHANNEL_ACCESS_TOKEN is not configured");
    expect(mocks.fromChannelAccessToken).not.toHaveBeenCalled();
  });
});
