import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { convertToPreviewPng } from "@/lib/template-converter";

const SETTINGS_ID = "singleton";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "template");
const PREVIEW_URL = "/uploads/template/preview.png";
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

async function requireSession() {
  const session = await auth();
  return !!session?.user;
}

function getFileType(file: File): "docx" | "pdf" | null {
  const extension = path.extname(file.name).toLowerCase();

  if (extension === ".docx") return "docx";
  if (extension === ".pdf") return "pdf";

  return null;
}

async function deleteTemplateFiles() {
  const files = await readdir(UPLOAD_DIR).catch(() => []);
  const staleFiles = files.filter(
    (file) =>
      file === "background.docx" ||
      file === "background.pdf" ||
      file.endsWith(".png")
  );

  await Promise.all(
    staleFiles.map((file) => unlink(path.join(UPLOAD_DIR, file)).catch(() => {}))
  );
}

export async function POST(request: Request) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const fileType = getFileType(file);

  if (!fileType) {
    return NextResponse.json(
      { error: "Only .docx and .pdf files are supported" },
      { status: 400 }
    );
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: "File must be 10MB or smaller" },
      { status: 400 }
    );
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const backgroundPath = `/uploads/template/background.${fileType}`;
  const inputPath = path.join(UPLOAD_DIR, `background.${fileType}`);
  const previewPath = path.join(UPLOAD_DIR, "preview.png");
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "template-background-"));
  const tempInputPath = path.join(tempDir, `background.${fileType}`);
  const tempPreviewPath = path.join(tempDir, "preview.png");

  try {
    await writeFile(tempInputPath, Buffer.from(await file.arrayBuffer()));
    await convertToPreviewPng(tempInputPath, fileType);
    await deleteTemplateFiles();
    await copyFile(tempInputPath, inputPath);
    await copyFile(tempPreviewPath, previewPath);
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Template preview conversion failed",
      },
      { status: 500 }
    );
  }

  await rm(tempDir, { recursive: true, force: true });

  await db.settings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      templateBackgroundPath: backgroundPath,
      templatePreviewPath: PREVIEW_URL,
    },
    update: {
      templateBackgroundPath: backgroundPath,
      templatePreviewPath: PREVIEW_URL,
    },
  });

  return NextResponse.json({ backgroundPath, previewUrl: PREVIEW_URL });
}

export async function DELETE() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteTemplateFiles();

  await db.settings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      templateBackgroundPath: null,
      templatePreviewPath: null,
      templateLayout: Prisma.DbNull,
    },
    update: {
      templateBackgroundPath: null,
      templatePreviewPath: null,
      templateLayout: Prisma.DbNull,
    },
  });

  return NextResponse.json({ ok: true });
}
