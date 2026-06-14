import { LineBotClient, type messagingApi } from "@line/bot-sdk";

const getClient = () =>
  LineBotClient.fromChannelAccessToken({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
  });

export async function sendBillMessages(
  lineUserId: string,
  messages: messagingApi.Message[]
): Promise<void> {
  await getClient().pushMessage({ to: lineUserId, messages });
}
