import { BillStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildBillsUrl,
  canSendLine,
  buildBillCreatePayload,
  getDashboardStats,
  getMeterUsage,
  hasMeterError,
  isPdfGenerating,
  shouldRedirectAfterCreate,
} from "@/lib/dashboard-bills-ui";

describe("Ticket 011 dashboard and bills UI", () => {
  it("Dashboard แสดง stats ถูกต้อง", () => {
    expect(
      getDashboardStats([
        { status: BillStatus.DRAFT },
        { status: BillStatus.SENT },
        { status: BillStatus.SENT },
        { status: BillStatus.PAID },
      ])
    ).toEqual({
      sent: 2,
      pending: 3,
      paid: 1,
    });
  });

  it("New bill form: negative reading -> inline error", () => {
    const readings = {
      waterPrevReading: "20",
      waterCurrReading: "19",
      elecPrevReading: "100",
      elecCurrReading: "110",
    };

    expect(getMeterUsage(readings)).toMatchObject({
      waterUsage: -1,
      elecUsage: 10,
    });
    expect(hasMeterError(readings)).toBe(true);
  });

  it("New bill form submit -> POST payload -> redirect decision", () => {
    const formData = new FormData();
    formData.set("bills.0.roomId", "room-101");
    formData.set("bills.0.waterPrevReading", "10");
    formData.set("bills.0.waterCurrReading", "15");
    formData.set("bills.0.elecPrevReading", "100");
    formData.set("bills.0.elecCurrReading", "125");

    const payload = buildBillCreatePayload({
      formData,
      month: "6",
      year: "2026",
      rooms: [{ id: "room-101" }],
    });

    expect(payload).toEqual({
      month: 6,
      year: 2026,
      bills: [
        {
          roomId: "room-101",
          waterPrevReading: 10,
          waterCurrReading: 15,
          elecPrevReading: 100,
          elecCurrReading: 125,
        },
      ],
    });
    expect(shouldRedirectAfterCreate({ skipped: [] })).toBe(false);
    expect(
      shouldRedirectAfterCreate({
        skipped: [{ roomId: "room-102", reason: "No active tenant" }],
      })
    ).toBe(true);
    expect(
      shouldRedirectAfterCreate({
        duplicates: [{ roomId: "room-101", roomNumber: "101" }],
      })
    ).toBe(true);
  });

  it("Bills list filter month/year", () => {
    expect(buildBillsUrl("6", "2026")).toBe("/api/bills?month=6&year=2026");
  });

  it("shows LINE action only for DRAFT/SENT bills with generated PDF", () => {
    expect(canSendLine({ status: "DRAFT", pdfStatus: "DONE" })).toBe(true);
    expect(canSendLine({ status: "SENT", pdfStatus: "DONE" })).toBe(true);
    expect(canSendLine({ status: "PAID", pdfStatus: "DONE" })).toBe(false);
    expect(canSendLine({ status: "SENT", pdfStatus: "PENDING" })).toBe(false);
  });

  it("disables PDF generation while a PDF job is already running", () => {
    expect(isPdfGenerating({ pdfStatus: "PENDING" })).toBe(true);
    expect(isPdfGenerating({ pdfStatus: "PROCESSING" })).toBe(true);
    expect(isPdfGenerating({ pdfStatus: "NONE" })).toBe(false);
    expect(isPdfGenerating({ pdfStatus: "FAILED" })).toBe(false);
    expect(isPdfGenerating({ pdfStatus: "DONE" })).toBe(false);
  });
});
