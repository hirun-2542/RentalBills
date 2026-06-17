import { LineBotClient, type messagingApi } from "@line/bot-sdk";

const getClient = () => {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!channelAccessToken) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  }

  return LineBotClient.fromChannelAccessToken({
    channelAccessToken,
  });
};

export async function sendBillMessages(
  lineUserId: string,
  messages: messagingApi.Message[]
): Promise<void> {
  await getClient().pushMessage({ to: lineUserId, messages });
}
