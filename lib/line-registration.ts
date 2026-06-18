import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_SECONDS = 15 * 60;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createLineRegistrationToken(lineUserId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      lineUserId,
      expiresAt: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    })
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function verifyLineRegistrationToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { lineUserId?: unknown; expiresAt?: unknown };

    if (
      typeof data.lineUserId !== "string" ||
      typeof data.expiresAt !== "number" ||
      data.expiresAt < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return data.lineUserId;
  } catch {
    return null;
  }
}
