export const TEMPLATE_PAGE_WIDTH = 595;
export const TEMPLATE_PAGE_HEIGHT = 842;

export const FONT_FAMILIES = [
  { value: "Sarabun", label: "Sarabun" },
  { value: "Noto Sans Thai", label: "Noto Sans Thai" },
  { value: "Noto Serif Thai", label: "Noto Serif Thai" },
  { value: "Noto Looped Thai", label: "Noto Looped Thai" },
] as const;

export const DEFAULT_FONT_FAMILY = "Sarabun";

export const TEMPLATE_VARIABLES = [
  ["tenantName", "ชื่อผู้เช่า"],
  ["roomNumber", "ห้อง"],
  ["month", "เดือน"],
  ["year", "ปี"],
  ["waterPrevReading", "มิเตอร์น้ำ (ก่อน)"],
  ["waterCurrReading", "มิเตอร์น้ำ (หลัง)"],
  ["waterUsage", "น้ำ (หน่วย)"],
  ["waterRatePerUnit", "ค่าน้ำ/หน่วย"],
  ["waterCollectionFee", "ค่าจัดเก็บน้ำ"],
  ["waterTotal", "ค่าน้ำ (ยอด)"],
  ["elecPrevReading", "มิเตอร์ไฟ (ก่อน)"],
  ["elecCurrReading", "มิเตอร์ไฟ (หลัง)"],
  ["elecUsage", "ไฟ (หน่วย)"],
  ["elecRatePerUnit", "ค่าไฟ/หน่วย"],
  ["elecTotal", "ค่าไฟ (ยอด)"],
  ["rent", "ค่าเช่า"],
  ["total", "ยอดรวม"],
  ["bankAccountName", "ชื่อบัญชี"],
  ["bankAccountNumber", "เลขบัญชี"],
  ["promptpayNumber", "PromptPay"],
] as const;

export const ALLOWED_VARIABLES = TEMPLATE_VARIABLES.map(([key]) => key);

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number][0];

export type TemplateLayoutItem = {
  id: string;
  type: "variable" | "static";
  variable?: TemplateVariable;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: "normal" | "bold";
  fontFamily: string;
  color: string;
};

export type TemplateLayout = {
  pageWidth: number;
  pageHeight: number;
  items: TemplateLayoutItem[];
};

export type TemplateResponse = {
  layout: TemplateLayout | null;
  backgroundPreviewUrl: string | null;
};

const VARIABLE_SET = new Set(TEMPLATE_VARIABLES.map(([value]) => value));

export function isTemplateVariable(value: string): value is TemplateVariable {
  return VARIABLE_SET.has(value as TemplateVariable);
}

export function getVariableLabel(variable: string) {
  return (
    TEMPLATE_VARIABLES.find(([value]) => value === variable)?.[1] ?? variable
  );
}

export function makeTemplateItemId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createStaticTextItem(
  patch: Partial<TemplateLayoutItem> = {}
): TemplateLayoutItem {
  return {
    id: makeTemplateItemId(),
    type: "static",
    text: "ข้อความ",
    x: 40,
    y: 40,
    width: 160,
    height: 28,
    fontSize: 14,
    fontWeight: "normal",
    fontFamily: DEFAULT_FONT_FAMILY,
    color: "#111111",
    ...patch,
  };
}

export function createVariableTextItem(
  variable: TemplateVariable,
  patch: Partial<TemplateLayoutItem> = {}
): TemplateLayoutItem {
  return createStaticTextItem({
    type: "variable",
    variable,
    text: `{${variable}}`,
    ...patch,
  });
}

export function updateTemplateItem(
  items: TemplateLayoutItem[],
  id: string,
  patch: Partial<TemplateLayoutItem>
) {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function getLayoutItems(data: TemplateResponse | null) {
  return data?.layout?.items ?? [];
}

export function buildTemplateSavePayload(items: TemplateLayoutItem[]) {
  return {
    pageWidth: TEMPLATE_PAGE_WIDTH,
    pageHeight: TEMPLATE_PAGE_HEIGHT,
    items,
  };
}
