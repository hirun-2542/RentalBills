import { createServer } from "node:http";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

async function launchBrowser() {
  return puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
}

async function convertPdfToPng(inputPath: string, previewPath: string) {
  const pdfBuffer = await readFile(inputPath);

  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "application/pdf");
    res.end(pdfBuffer);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.goto(`http://127.0.0.1:${port}/doc.pdf`, {
      waitUntil: "load",
      timeout: 30_000,
    });
    // give the PDF viewer a moment to finish rendering
    await new Promise((r) => setTimeout(r, 1500));
    const screenshot = await page.screenshot({ type: "png" });
    await writeFile(previewPath, screenshot);
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
}

async function convertDocxToPng(inputPath: string, previewPath: string) {
  const cwd = process.cwd();
  const jszipBundle = path.join(cwd, "node_modules/jszip/dist/jszip.min.js");
  const docxPreviewBundle = path.join(cwd, "node_modules/docx-preview/dist/docx-preview.min.js");

  const docxBuffer = await readFile(inputPath);
  const base64 = docxBuffer.toString("base64");

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });

    await page.setContent(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: white; width: 794px; }
    .docx-wrapper { background: white !important; padding: 0 !important; margin: 0 !important; }
    .docx-wrapper > section.docx { padding: 0 !important; }
  </style>
</head>
<body><div id="c"></div></body>
</html>`,
      { waitUntil: "load" }
    );

    await page.addScriptTag({ path: jszipBundle });
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).jszip =
        (window as unknown as Record<string, unknown>).JSZip;
    });
    await page.addScriptTag({ path: docxPreviewBundle });

    await page.evaluate((b64: string) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes]);
      return (
        window as unknown as {
          docx: { renderAsync: (b: Blob, el: Element | null, s: null, o: object) => Promise<void> };
        }
      ).docx.renderAsync(blob, document.getElementById("c"), null, {
        inWrapper: false,
        ignoreWidth: false,
      });
    }, base64);

    const screenshot = await page.screenshot({ type: "png", fullPage: false });
    await writeFile(previewPath, screenshot);
    await page.close();
  } finally {
    await browser.close();
  }
}

export async function convertToPreviewPng(
  inputPath: string,
  fileType: "docx" | "pdf"
): Promise<string> {
  const outdir = path.dirname(inputPath);
  const previewPath = path.join(outdir, "preview.png");

  await unlink(previewPath).catch(() => {});

  try {
    if (fileType === "pdf") {
      await convertPdfToPng(inputPath, previewPath);
    } else {
      await convertDocxToPng(inputPath, previewPath);
    }
  } catch (error) {
    throw new Error(
      `Failed to convert ${fileType} to preview: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return previewPath;
}
