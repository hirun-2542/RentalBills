import { readFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";
import type { TemplateLayout } from "@/lib/template-editor";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toNumberStyle(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function toFontWeight(value: string) {
  return value === "bold" ? "bold" : "normal";
}

function toColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#111111";
}

function getImageMimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  return "image/png";
}

async function buildHtml(
  layout: TemplateLayout,
  variables: Record<string, string>,
  backgroundPreviewPath: string
) {
  const background = await readFile(path.resolve(backgroundPreviewPath));
  const backgroundSrc = `data:${getImageMimeType(
    backgroundPreviewPath
  )};base64,${background.toString("base64")}`;
  const items = layout.items
    .map((item) => {
      const value =
        item.type === "variable" && item.variable
          ? variables[item.variable] ?? ""
          : item.text ?? "";

      return `<span class="item" style="left:${toNumberStyle(
        item.x
      )}px;top:${toNumberStyle(item.y)}px;width:${toNumberStyle(
        item.width
      )}px;height:${toNumberStyle(item.height)}px;font-size:${toNumberStyle(
        item.fontSize
      )}px;font-weight:${toFontWeight(item.fontWeight)};color:${toColor(
        item.color
      )};">${escapeHtml(value)}</span>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; }
    .page { position: relative; width: ${layout.pageWidth}px; height: ${layout.pageHeight}px; overflow: hidden; }
    .bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: fill; }
    .item { position: absolute; white-space: nowrap; line-height: 1.2; }
  </style>
</head>
<body>
  <div class="page">
    <img class="bg" src="${backgroundSrc}" />
    ${items}
  </div>
</body>
</html>`;
}

export async function renderBillPdfFromLayout(
  layout: TemplateLayout,
  variables: Record<string, string>,
  backgroundPreviewPath: string
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(
      await buildHtml(layout, variables, backgroundPreviewPath),
      {
        waitUntil: "load",
      }
    );
    const pdf = await page.pdf({
      width: `${layout.pageWidth}px`,
      height: `${layout.pageHeight}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
