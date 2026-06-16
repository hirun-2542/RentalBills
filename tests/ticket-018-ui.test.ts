import { describe, expect, it } from "vitest";
import {
  TEMPLATE_PAGE_HEIGHT,
  TEMPLATE_PAGE_WIDTH,
  buildTemplateSavePayload,
  createStaticTextItem,
  createVariableTextItem,
  getLayoutItems,
  isTemplateVariable,
  updateTemplateItem,
  type TemplateResponse,
} from "@/lib/template-editor";

describe("Ticket 018 canvas template editor UI", () => {
  it("drag variable -> item appears on canvas data", () => {
    expect(isTemplateVariable("tenantName")).toBe(true);

    const item = createVariableTextItem("tenantName", { x: 120, y: 80 });

    expect(item).toMatchObject({
      type: "variable",
      variable: "tenantName",
      text: "{tenantName}",
      x: 120,
      y: 80,
    });
  });

  it("inspector updates x/y on selected item data", () => {
    const item = createStaticTextItem({ id: "static-1", x: 10, y: 20 });

    expect(updateTemplateItem([item], "static-1", { x: 44, y: 55 })).toEqual([
      { ...item, x: 44, y: 55 },
    ]);
  });

  it("save payload matches Ticket 020 layout shape", () => {
    const items = [createStaticTextItem({ id: "static-1" })];

    expect(buildTemplateSavePayload(items)).toEqual({
      pageWidth: TEMPLATE_PAGE_WIDTH,
      pageHeight: TEMPLATE_PAGE_HEIGHT,
      items,
    });
  });

  it("reload reads persisted layout items from GET response", () => {
    const item = createStaticTextItem({ id: "static-1" });
    const response: TemplateResponse = {
      backgroundPreviewUrl: "/uploads/template/preview.png",
      layout: {
        pageWidth: 595,
        pageHeight: 842,
        items: [item],
      },
    };

    expect(getLayoutItems(response)).toEqual([item]);
    expect(getLayoutItems({ layout: null, backgroundPreviewUrl: null })).toEqual(
      []
    );
  });
});
