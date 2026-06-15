"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PaymentBadge } from "@/components/PaymentBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildBillsUrl, canSendLine } from "@/lib/dashboard-bills-ui";

type BillStatus = "DRAFT" | "SENT" | "PAID";
type PdfStatus = "NONE" | "PENDING" | "PROCESSING" | "DONE" | "FAILED";
const MAX_YEAR = 9999;

type BillRow = {
  id: string;
  month: number;
  year: number;
  total: number;
  status: BillStatus;
  pdfStatus: PdfStatus;
  sentAt: string | null;
  tenant: { name: string };
  room: { number: string };
};

const current = new Date();

function getMonthLabel(month: number) {
  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
  }).format(new Date(2024, month - 1, 1));
}

async function readApiError(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return body?.error ?? "เกิดข้อผิดพลาด";
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function BillsPage() {
  const [month, setMonth] = useState(String(current.getMonth() + 1));
  const [year, setYear] = useState(String(current.getFullYear()));
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyBillId, setBusyBillId] = useState<string | null>(null);
  const [busySendBillId, setBusySendBillId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const title = useMemo(
    () => `บิลเดือน ${getMonthLabel(Number(month))} ${year}`,
    [month, year]
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadBills() {
      setLoading(true);
      setError("");
      setNotice("");

      const response = await fetch(buildBillsUrl(month, year), {
        signal: controller.signal,
      }).catch(() => null);

      if (!response) {
        setError("ไม่สามารถโหลดข้อมูลบิลได้");
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setError(await readApiError(response));
        setLoading(false);
        return;
      }

      const data = (await response.json()) as BillRow[];
      setBills(data);
      setLoading(false);
    }

    void loadBills();

    return () => controller.abort();
  }, [month, year]);

  useEffect(() => {
    const warning = window.sessionStorage.getItem("billCreateWarning");

    if (warning) {
      setNotice(warning);
      window.sessionStorage.removeItem("billCreateWarning");
    }
  }, []);

  async function markPaid(id: string) {
    setBusyBillId(id);
    setError("");

    const response = await fetch(`/api/bills/${id}/paid`, {
      method: "POST",
    }).catch(() => null);

    if (!response) {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      setBusyBillId(null);
      return;
    }

    if (!response.ok) {
      setError(await readApiError(response));
      setBusyBillId(null);
      return;
    }

    const updated = (await response.json()) as BillRow;
    setBills((currentBills) =>
      currentBills.map((bill) => (bill.id === id ? updated : bill))
    );
    setBusyBillId(null);
  }

  async function sendLine(id: string) {
    setBusySendBillId(id);
    setError("");
    setNotice("");

    const response = await fetch(`/api/bills/${id}/send`, {
      method: "POST",
    }).catch(() => null);

    if (!response) {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      setBusySendBillId(null);
      return;
    }

    if (!response.ok) {
      setError(await readApiError(response));
      setBusySendBillId(null);
      return;
    }

    const updated = (await response.json()) as BillRow;
    setBills((currentBills) =>
      currentBills.map((bill) => (bill.id === id ? updated : bill))
    );
    setNotice("ส่ง LINE สำเร็จ");
    setBusySendBillId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="month">
            เดือน
          </label>
          <Input
            id="month"
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="w-28"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="year">
            ปี
          </label>
          <Input
            id="year"
            type="number"
            min={2000}
            max={MAX_YEAR}
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="w-32"
          />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          แสดงรายการบิลตามเดือนและปีที่เลือก
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      {notice ? (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">ห้อง</th>
              <th className="px-3 py-2 font-medium">ผู้เช่า</th>
              <th className="px-3 py-2 font-medium">ยอดรวม</th>
              <th className="px-3 py-2 font-medium">สถานะ</th>
              <th className="px-3 py-2 font-medium">วันส่ง</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={6}>
                  กำลังโหลด...
                </td>
              </tr>
            ) : bills.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={6}>
                  ยังไม่มีบิลสำหรับช่วงเวลานี้
                </td>
              </tr>
            ) : (
              bills.map((bill) => (
                <tr key={bill.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{bill.room.number}</td>
                  <td className="px-3 py-2">{bill.tenant.name}</td>
                  <td className="px-3 py-2">
                    {bill.total.toLocaleString("th-TH", {
                      style: "currency",
                      currency: "THB",
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <PaymentBadge status={bill.status} />
                  </td>
                  <td className="px-3 py-2">{formatDate(bill.sentAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/bills/${bill.id}`}>ดูรายละเอียด</Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markPaid(bill.id)}
                        disabled={busyBillId === bill.id || bill.status === "PAID"}
                      >
                        {busyBillId === bill.id ? "กำลังบันทึก" : "Mark Paid"}
                      </Button>
                      {canSendLine(bill) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendLine(bill.id)}
                          disabled={busySendBillId === bill.id}
                        >
                          {busySendBillId === bill.id ? "กำลังส่ง" : "ส่ง LINE"}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
