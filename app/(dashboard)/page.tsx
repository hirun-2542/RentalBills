import Link from "next/link";
import { BillStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function getNextCycle(month: number, year: number) {
  if (month === 12) {
    return { month: 1, year: year + 1 };
  }

  return { month: month + 1, year };
}

export default async function DashboardPage() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const nextCycle = getNextCycle(month, year);

  const bills = await db.bill.findMany({
    where: { month, year },
    select: { status: true },
  });

  const sent = bills.filter((bill) => bill.status === BillStatus.SENT).length;
  const paid = bills.filter((bill) => bill.status === BillStatus.PAID).length;
  const pending = bills.filter(
    (bill) =>
      bill.status === BillStatus.DRAFT || bill.status === BillStatus.SENT
  ).length;

  const stats = [
    { label: "ส่งแล้ว", value: sent },
    { label: "รอดำเนินการ", value: pending },
    { label: "ชำระแล้ว", value: paid },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          รอบบิลถัดไป: 1 {nextCycle.month}/{nextCycle.year}
        </p>
      </div>

      {bills.length === 0 ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm font-medium">ยังไม่มีบิลเดือนนี้</p>
          <Button asChild size="sm">
            <Link href="/bills/new">สร้างบิล</Link>
          </Button>
        </div>
      ) : null}

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

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/bills">Bills</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/rooms">Rooms</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings">Settings</Link>
        </Button>
      </div>
    </div>
  );
}
