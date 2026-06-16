import { execFile } from "node:child_process";
import { access, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function convertToPreviewPng(
  inputPath: string,
  fileType: "docx" | "pdf"
): Promise<string> {
  const outdir = path.dirname(inputPath);
  const previewPath = path.join(outdir, "preview.png");
  const generatedPath = path.join(
    outdir,
    `${path.basename(inputPath, `.${fileType}`)}.png`
  );

  await unlink(previewPath).catch(() => {});

  try {
    await execFileAsync("libreoffice", [
      "--headless",
      "--convert-to",
      "png",
      "--outdir",
      outdir,
      inputPath,
    ], { timeout: 30_000 });
  } catch (error) {
    throw new Error(
      `LibreOffice failed to convert template preview. Ensure libreoffice is installed. ${
        error instanceof Error ? error.message : ""
      }`
    );
  }

  await access(generatedPath);
  await rename(generatedPath, previewPath);

  return previewPath;
}
