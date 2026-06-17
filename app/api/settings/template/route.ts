import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const SETTINGS_ID = "singleton";

async function requireSession() {
  const session = await auth();
  return !!session?.user;
}

export async function GET() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await db.settings.findUnique({
    where: { id: SETTINGS_ID },
  });

  return NextResponse.json({
    layout: settings?.templateLayout ?? null,
    backgroundPreviewUrl: settings?.templatePreviewPath ?? null,
  });
}
