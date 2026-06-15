"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PaymentBadge } from "@/components/PaymentBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildBillsUrl,
  getHistorySummary,
  getPreviousMonthSelection,
} from "@/lib/dashboard-bills-ui";

type BillStatus = "DRAFT" | "SENT" | "PAID";
const MAX_YEAR = 9999;

type BillRow = {
  id: string;
  waterTotal: number;
  elecTotal: number;
  rent: number;
  total: number;
  status: BillStatus;
  tenant: { name: string };
  room: { number: string };
};

const bahtFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
});

const defaultSelection = getPreviousMonthSelection(new Date());

async function readApiError(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return body?.error ?? "เกิดข้อผิดพลาด";
}

export default function HistoryPage() {
  const [month, setMonth] = useState(defaultSelection.month);
  const [year, setYear] = useState(defaultSelection.year);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const summary = useMemo(() => getHistorySummary(bills), [bills]);
  const stats = [
    { label: "ยอดรวม", value: bahtFormatter.format(summary.totalAmount) },
    { label: "ชำระแล้ว", value: summary.paidCount },
    { label: "ยังไม่ชำระ", value: summary.unpaidCount },
  ];

  useEffect(() => {
    const controller = new AbortController();

    async function loadBills() {
      setLoading(true);
      setError("");

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="history-month">
            เดือน
          </label>
          <Input
            id="history-month"
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="w-28"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="history-year">
            ปี
          </label>
          <Input
            id="history-year"
            type="number"
            min={2000}
            max={MAX_YEAR}
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="w-32"
          />
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">ประวัติบิล</h1>
        <p className="text-sm text-muted-foreground">
          แสดงข้อมูลบิลย้อนหลังตามเดือนและปีที่เลือก
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">ห้อง</th>
              <th className="px-3 py-2 font-medium">ผู้เช่า</th>
              <th className="px-3 py-2 font-medium">ค่าน้ำ</th>
              <th className="px-3 py-2 font-medium">ค่าไฟ</th>
              <th className="px-3 py-2 font-medium">ค่าเช่า</th>
              <th className="px-3 py-2 font-medium">รวม</th>
              <th className="px-3 py-2 font-medium">สถานะ</th>
              <th className="px-3 py-2 font-medium">ดูรายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={8}>
                  กำลังโหลด...
                </td>
              </tr>
            ) : bills.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={8}>
                  ไม่มีข้อมูลบิลสำหรับเดือนที่เลือก
                </td>
              </tr>
            ) : (
              bills.map((bill) => (
                <tr key={bill.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{bill.room.number}</td>
                  <td className="px-3 py-2">{bill.tenant.name}</td>
                  <td className="px-3 py-2">
                    {bahtFormatter.format(bill.waterTotal)}
                  </td>
                  <td className="px-3 py-2">
                    {bahtFormatter.format(bill.elecTotal)}
                  </td>
                  <td className="px-3 py-2">
                    {bahtFormatter.format(bill.rent)}
                  </td>
                  <td className="px-3 py-2">
                    {bahtFormatter.format(bill.total)}
                  </td>
                  <td className="px-3 py-2">
                    <PaymentBadge status={bill.status} />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      href={`/bills/${bill.id}`}
                    >
                      ดูรายละเอียด
                    </Link>
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
