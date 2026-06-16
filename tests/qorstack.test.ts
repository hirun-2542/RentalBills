import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderBillPdf } from "@/lib/qorstack";

describe("Qorstack render client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.QORSTACK_API_URL = "https://qorstack.test/";
    process.env.QORSTACK_API_KEY = "rdx_test";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.QORSTACK_API_URL;
    delete process.env.QORSTACK_API_KEY;
    vi.restoreAllMocks();
  });

  it("renders bill PDFs through the Qorstack live render endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          downloadUrl: "https://qorstack.test/downloads/bill.pdf",
        }),
        { status: 200 }
      )
    );
    global.fetch = fetchMock;

    await expect(
      renderBillPdf({
        tenantName: "Tenant A",
        total: "3150",
      })
    ).resolves.toBe("https://qorstack.test/downloads/bill.pdf");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://qorstack.test/render/word/template",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": "rdx_test",
        },
        body: JSON.stringify({
          templateKey: "bill",
          fileName: "bill",
          fileType: "pdf",
          replace: {
            tenantName: "Tenant A",
            total: "3150",
          },
        }),
      }
    );
  });

  it("keeps support for legacy URL response fields", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ fileUrl: "https://legacy.test/bill.pdf" }), {
        status: 200,
      })
    );

    await expect(renderBillPdf({ tenantName: "Tenant A" })).resolves.toBe(
      "https://legacy.test/bill.pdf"
    );
  });
});
