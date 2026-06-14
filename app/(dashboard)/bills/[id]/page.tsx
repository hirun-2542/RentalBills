import { notFound } from "next/navigation";
import { BillPdfPanel, type BillPdfState } from "@/components/bill-pdf-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

const bahtFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
});

export default async function BillDetailPage({ params }: PageProps) {
  const { id } = await params;
  const bill = await db.bill.findUnique({
    where: { id },
    include: { tenant: true, room: true },
  });

  if (!bill) {
    notFound();
  }

  const settings = await db.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

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
            <div>{bahtFormatter.format(bill.total.toNumber())}</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>ชำระเงิน</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-[250px_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/bills/${bill.id}/qr`}
            alt="QR PromptPay"
            width={250}
            height={250}
          />
          <div className="space-y-3">
            <div>
              <span className="text-muted-foreground">ยอดที่ต้องชำระ</span>
              <div className="text-lg font-semibold">
                {bahtFormatter.format(bill.total.toNumber())}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">ชื่อบัญชี</span>
              <div>{settings.bankAccountName || "-"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">เลขบัญชีธนาคาร</span>
              <div>{settings.bankAccountNumber || "-"}</div>
            </div>
          </div>
        </CardContent>
      </Card>
      <BillPdfPanel initialBill={pdfState} />
    </div>
  );
}
