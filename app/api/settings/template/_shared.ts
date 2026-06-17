import { auth } from "@/lib/auth";

export const SETTINGS_ID = "singleton";

export async function requireSession() {
  const session = await auth();
  return !!session?.user;
}
