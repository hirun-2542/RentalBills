import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: mocks.execFile,
}));

let tempDir: string | null = null;

describe("template converter", () => {
  afterEach(async () => {
    vi.clearAllMocks();
    delete process.env.LIBREOFFICE_BIN;
    delete process.env.PDFTOPPM_BIN;
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("converts PDF output to preview.png with pdftoppm", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "converter-test-"));
    const inputPath = path.join(tempDir, "background.pdf");
    await writeFile(inputPath, "pdf");
    mocks.execFile.mockImplementation(
      (_command, args: string[], _options, callback) => {
        writeFile(`${args[9]}.png`, "preview").then(() =>
          callback(null, "", "")
        );
      }
    );

    const { convertToPreviewPng } = await import("@/lib/template-converter");
    const previewPath = await convertToPreviewPng(inputPath, "pdf");

    expect(previewPath).toBe(path.join(tempDir, "preview.png"));
    await expect(readFile(previewPath, "utf8")).resolves.toBe("preview");
    expect(mocks.execFile).toHaveBeenCalledWith(
      "pdftoppm",
      [
        "-png",
        "-singlefile",
        "-f",
        "1",
        "-l",
        "1",
        "-r",
        "144",
        inputPath,
        path.join(tempDir, "preview"),
      ],
      { timeout: 30_000 },
      expect.any(Function)
    );
  });

  it("converts DOCX output to preview.png with LibreOffice", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "converter-test-"));
    const inputPath = path.join(tempDir, "background.docx");
    await writeFile(inputPath, "docx");
    mocks.execFile.mockImplementation(
      (_command, args: string[], _options, callback) => {
        writeFile(path.join(args[4], "background.png"), "preview").then(() =>
          callback(null, "", "")
        );
      }
    );

    const { convertToPreviewPng } = await import("@/lib/template-converter");
    const previewPath = await convertToPreviewPng(inputPath, "docx");

    expect(previewPath).toBe(path.join(tempDir, "preview.png"));
    await expect(readFile(previewPath, "utf8")).resolves.toBe("preview");
    expect(mocks.execFile).toHaveBeenCalledWith(
      "libreoffice",
      [
        "--headless",
        "--convert-to",
        "png",
        "--outdir",
        tempDir,
        inputPath,
      ],
      { timeout: 30_000 },
      expect.any(Function)
    );
  });

  it("falls back to the common absolute LibreOffice path", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "converter-test-"));
    const inputPath = path.join(tempDir, "background.pdf");
    await writeFile(inputPath, "pdf");
    mocks.execFile.mockImplementation(
      (command: string, args: string[], _options, callback) => {
        if (command !== "/usr/bin/libreoffice") {
          const error = new Error("not found") as NodeJS.ErrnoException;
          error.code = "ENOENT";
          callback(error);
          return;
        }

        writeFile(path.join(args[4], "background.png"), "preview").then(() =>
          callback(null, "", "")
        );
      }
    );

    const { convertToPreviewPng } = await import("@/lib/template-converter");
    const previewPath = await convertToPreviewPng(inputPath, "pdf");

    expect(previewPath).toBe(path.join(tempDir, "preview.png"));
    expect(mocks.execFile).toHaveBeenLastCalledWith(
      "/usr/bin/libreoffice",
      [
        "--headless",
        "--convert-to",
        "png",
        "--outdir",
        tempDir,
        inputPath,
      ],
      { timeout: 30_000 },
      expect.any(Function)
    );
  });
});
