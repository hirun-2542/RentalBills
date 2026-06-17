import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, SETTINGS_ID } from "@/lib/api";
import { serialize } from "@/lib/serialize";

type SettingsUpdate = {
  waterRatePerUnit?: number;
  waterCollectionFee?: number;
  elecRatePerUnit?: number;
  bankAccountName?: string;
  bankAccountNumber?: string;
  promptpayNumber?: string;
};



function parseSettingsUpdate(body: unknown) {
  const errors: Record<string, string> = {};
  const data: SettingsUpdate = {};

  if (!body || typeof body !== "object") {
    return { data, errors: { form: "Invalid settings data" } };
  }

  const input = body as Record<string, unknown>;

  for (const key of [
    "waterRatePerUnit",
    "waterCollectionFee",
    "elecRatePerUnit",
  ] as const) {
    if (key in input) {
      const rawValue = input[key];
      const value =
        rawValue === null || rawValue === undefined ? NaN : Number(rawValue);

      if (!Number.isFinite(value) || value < 0) {
        errors[key] = "Must be a non-negative number";
      } else {
        data[key] = value;
      }
    }
  }

  for (const key of [
    "bankAccountName",
    "bankAccountNumber",
    "promptpayNumber",
  ] as const) {
    if (key in input) {
      if (typeof input[key] !== "string") {
        errors[key] = "Must be a string";
      } else {
        data[key] = input[key].trim();
      }
    }
  }

  return { data, errors };
}

export async function GET() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await db.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });

  return NextResponse.json(serialize(settings));
}

export async function PUT(request: Request) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { data, errors } = parseSettingsUpdate(body);

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const settings = await db.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data },
    update: data,
  });

  return NextResponse.json(serialize(settings));
}
