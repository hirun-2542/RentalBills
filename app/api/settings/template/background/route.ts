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
import { db } from "@/lib/db";
import { requireSession, SETTINGS_ID } from "@/lib/api";
import { convertToPreviewPng } from "@/lib/template-converter";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "template");
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

function getFileType(file: File): "docx" | "pdf" | "image" | null {
  const extension = path.extname(file.name).toLowerCase();

  if (extension === ".docx") return "docx";
  if (extension === ".pdf") return "pdf";
  if (extension === ".png" || extension === ".jpg" || extension === ".jpeg") return "image";

  return null;
}

async function deleteTemplateFiles() {
  const files = await readdir(UPLOAD_DIR).catch(() => []);
  const staleFiles = files.filter(
    (file) =>
      file.startsWith("background.") ||
      file === "preview.png" ||
      file === "preview.jpg"
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
      { error: "Only .png, .jpg, .pdf, and .docx files are supported" },
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

  const ext = path.extname(file.name).toLowerCase().slice(1);
  const backgroundPath = `/uploads/template/background.${ext}`;
  const inputPath = path.join(UPLOAD_DIR, `background.${ext}`);
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  if (fileType === "image") {
    await deleteTemplateFiles();
    await writeFile(inputPath, fileBuffer);

    await db.settings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, templateBackgroundPath: backgroundPath, templatePreviewPath: backgroundPath },
      update: { templateBackgroundPath: backgroundPath, templatePreviewPath: backgroundPath },
    });

    return NextResponse.json({ backgroundPath, previewUrl: backgroundPath });
  }

  const previewPath = path.join(UPLOAD_DIR, "preview.png");
  const previewUrl = "/uploads/template/preview.png";
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "template-background-"));
  const tempInputPath = path.join(tempDir, `background.${ext}`);
  const tempPreviewPath = path.join(tempDir, "preview.png");

  try {
    await writeFile(tempInputPath, fileBuffer);
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
    create: { id: SETTINGS_ID, templateBackgroundPath: backgroundPath, templatePreviewPath: previewUrl },
    update: { templateBackgroundPath: backgroundPath, templatePreviewPath: previewUrl },
  });

  return NextResponse.json({ backgroundPath, previewUrl });
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
