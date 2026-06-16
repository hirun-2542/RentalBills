import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { BillPdfPanel, type BillPdfState } from "@/components/bill-pdf-panel";

function renderPanel(bill: Partial<BillPdfState> = {}) {
  return renderToStaticMarkup(
    createElement(BillPdfPanel, {
      initialBill: {
        id: "bill-1",
        pdfStatus: "DONE",
        pdfUrl: "/bill.pdf",
        pdfError: null,
        ...bill,
      },
    })
  );
}

describe("Ticket 013 PDF live preview", () => {
  it("renders iframe when pdfStatus is DONE and pdfUrl is set", () => {
    const html = renderPanel();

    expect(html).toContain('<iframe src="/bill.pdf"');
    expect(html).toContain('class="w-full h-[600px] rounded border"');
    expect(html).toContain('title="PDF Preview"');
  });

  it("does not render iframe when pdfStatus is not DONE", () => {
    expect(renderPanel({ pdfStatus: "PENDING" })).not.toContain("<iframe");
  });

  it("keeps download button when status is DONE", () => {
    const html = renderPanel();

    expect(html).toContain('href="/bill.pdf"');
    expect(html).toContain("download");
    expect(html).toContain("ดาวน์โหลด PDF");
  });

  it("renders new-tab fallback link when status is DONE", () => {
    const html = renderPanel();

    expect(html).toContain('href="/bill.pdf"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("เปิด PDF ในแท็บใหม่");
  });
});
