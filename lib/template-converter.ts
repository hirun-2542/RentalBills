import { execFile } from "node:child_process";
import { access, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function getLibreOfficeCandidates() {
  return [
    process.env.LIBREOFFICE_BIN,
    "libreoffice",
    "soffice",
    "/usr/bin/libreoffice",
    "/usr/local/bin/libreoffice",
    "/opt/libreoffice/program/soffice",
  ].filter(Boolean) as string[];
}

function getPdfToPngCandidates() {
  return [
    process.env.PDFTOPPM_BIN,
    "pdftoppm",
    "/usr/bin/pdftoppm",
    "/usr/local/bin/pdftoppm",
  ].filter(Boolean) as string[];
}

async function runFirstAvailable(candidates: string[], args: string[]) {
  const missing: string[] = [];

  for (const command of candidates) {
    try {
      await execFileAsync(command, args, { timeout: 30_000 });
      return;
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        missing.push(command);
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Executable not found: ${missing.join(", ")}`);
}

async function runLibreOffice(args: string[]) {
  await runFirstAvailable(getLibreOfficeCandidates(), args);
}

async function convertPdfToPng(inputPath: string, previewPath: string) {
  const outputPrefix = previewPath.replace(/\.png$/i, "");

  await runFirstAvailable(getPdfToPngCandidates(), [
    "-png",
    "-singlefile",
    "-f",
    "1",
    "-l",
    "1",
    "-r",
    "144",
    inputPath,
    outputPrefix,
  ]);
}

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
  let generatedPreviewPath = fileType === "docx" ? generatedPath : previewPath;

  await unlink(previewPath).catch(() => {});

  try {
    if (fileType === "pdf") {
      await convertPdfToPng(inputPath, previewPath).catch(async (error) => {
        if (!(error instanceof Error) || !error.message.includes("not found")) {
          throw error;
        }

        generatedPreviewPath = generatedPath;
        await runLibreOffice([
          "--headless",
          "--convert-to",
          "png",
          "--outdir",
          outdir,
          inputPath,
        ]);
      });
    } else {
      await runLibreOffice([
        "--headless",
        "--convert-to",
        "png",
        "--outdir",
        outdir,
        inputPath,
      ]);
    }
  } catch (error) {
    throw new Error(
      `Failed to convert template preview. Ensure ${
        fileType === "pdf" ? "pdftoppm or LibreOffice" : "LibreOffice"
      } is installed. ${
        error instanceof Error ? error.message : ""
      }`
    );
  }

  await access(generatedPreviewPath);

  if (generatedPreviewPath !== previewPath) {
    await rename(generatedPreviewPath, previewPath);
  }

  return previewPath;
}
