import { notFound } from "next/navigation";
import { BillPdfPanel, type BillPdfState } from "@/components/bill-pdf-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function BillDetailPage({ params }: PageProps) {
  const { id } = await params;
  const bill = await db.bill.findUnique({
    where: { id },
    include: { tenant: true, room: true },
  });

  if (!bill) {
    notFound();
  }

  const pdfState: BillPdfState = {
    id: bill.id,
    pdfStatus: bill.pdfStatus,
    pdfUrl: bill.pdfUrl,
    pdfError: bill.pdfError,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">
        Bill {bill.room.number} / {bill.month}/{bill.year}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>รายละเอียดบิล</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">ผู้เช่า</span>
            <div>{bill.tenant.name}</div>
          </div>
          <div>
            <span className="text-muted-foreground">ยอดรวม</span>
            <div>{bill.total.toString()}</div>
          </div>
        </CardContent>
      </Card>
      <BillPdfPanel initialBill={pdfState} />
    </div>
  );
}
