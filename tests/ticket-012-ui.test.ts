import { describe, expect, it } from "vitest";
import {
  buildBillsUrl,
  getHistorySummary,
  getPreviousMonthSelection,
} from "@/lib/dashboard-bills-ui";

function shouldShowHistoryEmptyState(
  bills: Parameters<typeof getHistorySummary>[0]
) {
  return getHistorySummary(bills).totalAmount === 0 && bills.length === 0;
}

describe("Ticket 012 bill history UI", () => {
  it("เลือก month/year ที่มีบิล -> summary แสดงถูกต้อง", () => {
    const bills = [
      { status: "PAID" as const, total: 3150 },
      { status: "DRAFT" as const, total: 4200 },
      { status: "SENT" as const, total: 2800 },
    ];

    expect(buildBillsUrl("5", "2026")).toBe("/api/bills?month=5&year=2026");
    expect(getHistorySummary(bills)).toEqual({
      totalAmount: 10150,
      paidCount: 1,
      unpaidCount: 2,
    });
  });

  it("เลือก month/year ที่ไม่มีบิล -> empty state condition", () => {
    expect(getHistorySummary([])).toEqual({
      totalAmount: 0,
      paidCount: 0,
      unpaidCount: 0,
    });
    expect(shouldShowHistoryEmptyState([])).toBe(true);
  });

  it("defaults to previous month", () => {
    expect(getPreviousMonthSelection(new Date(2026, 5, 15))).toEqual({
      month: "5",
      year: "2026",
    });
    expect(getPreviousMonthSelection(new Date(2026, 0, 15))).toEqual({
      month: "12",
      year: "2025",
    });
  });
});
