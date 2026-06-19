import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MeterForm } from "@/components/MeterForm";

const room = {
  id: "room-1",
  number: "101",
  tenant: { id: "tenant-1", name: "Tenant" },
};

describe("Ticket 022 meter autofill", () => {
  it("prefills previous meter readings from the latest bill", () => {
    const html = renderToStaticMarkup(
      createElement(MeterForm, {
        room,
        index: 0,
        prevWater: 12.5,
        prevElec: 345,
      })
    );

    expect(html).toContain('name="bills.0.waterPrevReading"');
    expect(html).toContain('value="12.5"');
    expect(html).toContain('name="bills.0.elecPrevReading"');
    expect(html).toContain('value="345"');
  });

  it("keeps previous meter readings blank without a prior bill", () => {
    const html = renderToStaticMarkup(
      createElement(MeterForm, { room, index: 0 })
    );

    expect(html).toContain('name="bills.0.waterPrevReading"');
    expect(html).toContain('name="bills.0.elecPrevReading"');
    expect(html).not.toContain('value="12.5"');
    expect(html).not.toContain('value="345"');
  });
});
