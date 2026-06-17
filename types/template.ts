export const ALLOWED_VARIABLES = [
  "tenantName",
  "roomNumber",
  "month",
  "year",
  "waterPrevReading",
  "waterCurrReading",
  "waterUsage",
  "waterRatePerUnit",
  "waterCollectionFee",
  "waterTotal",
  "elecPrevReading",
  "elecCurrReading",
  "elecUsage",
  "elecRatePerUnit",
  "elecTotal",
  "rent",
  "total",
  "bankAccountName",
  "bankAccountNumber",
  "promptpayNumber",
] as const;

export type TemplateVariable = (typeof ALLOWED_VARIABLES)[number];

export type TemplateItemVariable = {
  id: string;
  type: "variable";
  variable: TemplateVariable;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: string;
};

export type TemplateItemStatic = {
  id: string;
  type: "static";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: string;
};

export type TemplateItem = TemplateItemVariable | TemplateItemStatic;

export type TemplateLayout = {
  pageWidth: number;
  pageHeight: number;
  items: TemplateItem[];
};
