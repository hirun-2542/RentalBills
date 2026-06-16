import { rm } from "node:fs/promises";
import path from "node:path";
import { PdfStatus, Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    bill: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    settings: {
      findUnique: vi.fn(),
    },
  },
  inngest: {
    createFunction: vi.fn(),
  },
  renderBillPdf: vi.fn(),
  renderBillPdfFromLayout: vi.fn(),
  saveBillPdf: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  db: mocks.db,
}));

vi.mock("@/lib/inngest", () => ({
  inngest: mocks.inngest,
}));

vi.mock("@/lib/qorstack", () => ({
  renderBillPdf: mocks.renderBillPdf,
}));

vi.mock("@/lib/pdf-renderer", () => ({
  renderBillPdfFromLayout: mocks.renderBillPdfFromLayout,
}));

vi.mock("@/lib/pdf-storage", () => ({
  saveBillPdf: mocks.saveBillPdf,
}));

import { POST as preview } from "@/app/api/settings/template/preview/route";
import { generateBillPdfForBill } from "@/inngest/generate-bill-pdf";

function decimal(value: number) {
  return new Prisma.Decimal(value);
}

describe("Ticket 019 PDF flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { name: "Admin" } });
    mocks.inngest.createFunction.mockReturnValue({});
    mocks.db.bill.findUnique.mockResolvedValue({
      id: "bill-1",
      month: 6,
      year: 2026,
      waterPrevReading: decimal(100),
      waterCurrReading: decimal(115),
      waterUsage: decimal(15),
      waterRatePerUnit: decimal(18),
      waterCollectionFee: decimal(50),
      waterTotal: decimal(320),
      elecPrevReading: decimal(200),
      elecCurrReading: decimal(230),
      elecUsage: decimal(30),
      elecRatePerUnit: decimal(8),
      elecTotal: decimal(240),
      rent: decimal(4500),
      total: decimal(5060),
      tenant: { name: "ภิญโญ สมชาย" },
      room: { number: "101" },
    });
    mocks.db.settings.findUnique.mockResolvedValue({
      bankAccountName: "กล้วยหอม มีสุข",
      bankAccountNumber: "123-4-56789-0",
      promptpayNumber: "0812345678",
      templateLayout: null,
      templatePreviewPath: "/uploads/template/preview.png",
    });
    mocks.db.bill.update.mockResolvedValue({});
    mocks.renderBillPdf.mockResolvedValue("https://qorstack.test/bill.pdf");
    mocks.renderBillPdfFromLayout.mockResolvedValue(Buffer.from("%PDF"));
    mocks.saveBillPdf.mockResolvedValue("/uploads/bills/bill-1.pdf");
  });

  afterEach(async () => {
    await rm(
      path.join(process.cwd(), "public", "uploads", "template", "preview-bill.pdf"),
      { force: true }
    );
  });

  it("keeps the Qorstack Word fallback when no template layout is set", async () => {
    await expect(generateBillPdfForBill("bill-1")).resolves.toEqual({
      pdfUrl: "https://qorstack.test/bill.pdf",
    });

    expect(mocks.renderBillPdf).toHaveBeenCalledOnce();
    expect(mocks.renderBillPdfFromLayout).not.toHaveBeenCalled();
    expect(mocks.saveBillPdf).not.toHaveBeenCalled();
  });

  it("renders and saves a local PDF when template layout is set", async () => {
    const layout = { pageWidth: 595, pageHeight: 842, items: [] };
    mocks.db.settings.findUnique.mockResolvedValue({
      bankAccountName: "กล้วยหอม มีสุข",
      bankAccountNumber: "123-4-56789-0",
      promptpayNumber: "0812345678",
      templateLayout: layout,
      templatePreviewPath: "/uploads/template/preview.png",
    });

    await expect(generateBillPdfForBill("bill-1")).resolves.toEqual({
      pdfUrl: "/uploads/bills/bill-1.pdf",
    });

    expect(mocks.renderBillPdf).not.toHaveBeenCalled();
    expect(mocks.renderBillPdfFromLayout).toHaveBeenCalledWith(
      layout,
      expect.objectContaining({ tenantName: "ภิญโญ สมชาย" }),
      expect.stringContaining("/public/uploads/template/preview.png")
    );
    expect(mocks.saveBillPdf).toHaveBeenCalledWith("bill-1", Buffer.from("%PDF"));
    expect(mocks.db.bill.update).toHaveBeenLastCalledWith({
      where: { id: "bill-1" },
      data: {
        pdfStatus: PdfStatus.DONE,
        pdfUrl: "/uploads/bills/bill-1.pdf",
        pdfError: null,
      },
    });
  });

  it("preview endpoint writes and returns the local preview URL", async () => {
    mocks.db.settings.findUnique.mockResolvedValue({
      templateLayout: { pageWidth: 595, pageHeight: 842, items: [] },
      templatePreviewPath: "/uploads/template/preview.png",
    });

    const response = await preview();

    await expect(response.json()).resolves.toEqual({
      previewUrl: "/uploads/template/preview-bill.pdf",
    });
    expect(response.status).toBe(200);
    expect(mocks.renderBillPdfFromLayout).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        tenantName: "ภิญโญ สมชาย",
        bankAccountName: "กล้วยหอม มีสุข",
      }),
      expect.stringContaining("/public/uploads/template/preview.png")
    );
  });
});
