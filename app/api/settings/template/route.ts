import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, SETTINGS_ID } from "@/lib/api";

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
