import { BillStatus } from "@prisma/client";

type DashboardBill = {
  status: BillStatus;
};

type BillLineState = {
  status: "DRAFT" | "SENT" | "PAID";
  pdfStatus: "NONE" | "PENDING" | "PROCESSING" | "DONE" | "FAILED";
};

type MeterReadings = {
  waterPrevReading: string;
  waterCurrReading: string;
  elecPrevReading: string;
  elecCurrReading: string;
};

type BillCreateRoom = {
  id: string;
};

type ApiCreateResult = {
  skipped?: Array<{ roomId: string; reason: string }>;
};

export function getDashboardStats(bills: DashboardBill[]) {
  return {
    sent: bills.filter((bill) => bill.status === BillStatus.SENT).length,
    pending: bills.filter(
      (bill) =>
        bill.status === BillStatus.DRAFT || bill.status === BillStatus.SENT
    ).length,
    paid: bills.filter((bill) => bill.status === BillStatus.PAID).length,
  };
}

export function buildBillsUrl(month: string, year: string) {
  return `/api/bills?month=${month}&year=${year}`;
}

export function canSendLine(bill: BillLineState) {
  return (
    (bill.status === "DRAFT" || bill.status === "SENT") &&
    bill.pdfStatus === "DONE"
  );
}

export function getMeterUsage(readings: MeterReadings) {
  return {
    waterUsage:
      Number(readings.waterCurrReading || 0) -
      Number(readings.waterPrevReading || 0),
    elecUsage:
      Number(readings.elecCurrReading || 0) -
      Number(readings.elecPrevReading || 0),
  };
}

export function hasMeterError(readings: MeterReadings) {
  const usage = getMeterUsage(readings);
  return usage.waterUsage < 0 || usage.elecUsage < 0;
}

function readNumber(formData: FormData, name: string) {
  return Number(formData.get(name));
}

export function buildBillCreatePayload({
  formData,
  month,
  rooms,
  year,
}: {
  formData: FormData;
  month: string;
  rooms: BillCreateRoom[];
  year: string;
}) {
  return {
    month: Number(month),
    year: Number(year),
    bills: rooms.map((room, index) => ({
      roomId: String(formData.get(`bills.${index}.roomId`) ?? room.id),
      waterPrevReading: readNumber(formData, `bills.${index}.waterPrevReading`),
      waterCurrReading: readNumber(formData, `bills.${index}.waterCurrReading`),
      elecPrevReading: readNumber(formData, `bills.${index}.elecPrevReading`),
      elecCurrReading: readNumber(formData, `bills.${index}.elecCurrReading`),
    })),
  };
}

export function shouldRedirectAfterCreate(data: ApiCreateResult) {
  return Boolean(data.skipped?.length);
}
