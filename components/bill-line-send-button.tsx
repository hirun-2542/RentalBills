"use client";

import { Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type BillLineSendState = {
  id: string;
  status: "DRAFT" | "SENT" | "PAID";
  pdfStatus: "NONE" | "PENDING" | "PROCESSING" | "DONE" | "FAILED";
  sentAt: string | null;
};

type BillSendResponse = BillLineSendState & {
  error?: string;
};

async function readApiError(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return body?.error ?? "เกิดข้อผิดพลาด";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getDisabledReason(bill: BillLineSendState) {
  if (bill.status === "PAID") {
    return "บิลนี้ชำระแล้ว";
  }

  if (bill.pdfStatus !== "DONE") {
    return "กรุณาสร้าง PDF ก่อนส่ง";
  }

  return "";
}

export function BillLineSendButton({
  initialBill,
}: {
  initialBill: BillLineSendState;
}) {
  const [bill, setBill] = useState(initialBill);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const disabledReason = getDisabledReason(bill);
  const disabled = submitting || !!disabledReason;

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 4000);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  async function sendLine() {
    setSubmitting(true);
    setNotice(null);

    const response = await fetch(`/api/bills/${bill.id}/send`, {
      method: "POST",
    });

    if (!response.ok) {
      setNotice({ type: "error", message: await readApiError(response) });
      setSubmitting(false);
      return;
    }

    const nextBill = (await response.json()) as BillSendResponse;
    setBill({
      id: nextBill.id,
      status: nextBill.status,
      pdfStatus: nextBill.pdfStatus,
      sentAt: nextBill.sentAt,
    });
    setNotice({ type: "success", message: "ส่ง LINE สำเร็จ" });
    setSubmitting(false);
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">LINE</h2>
          <p className="text-sm text-muted-foreground">
            {bill.sentAt ? `ส่งล่าสุด: ${formatDate(bill.sentAt)}` : "ยังไม่เคยส่ง"}
          </p>
        </div>
        <span title={disabledReason || undefined}>
          <Button onClick={sendLine} disabled={disabled}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {submitting ? "กำลังส่ง" : "ส่ง LINE"}
          </Button>
        </span>
      </div>

      {disabledReason ? (
        <p className="text-sm text-muted-foreground">{disabledReason}</p>
      ) : null}

      {notice ? (
        <div
          className={
            notice.type === "success"
              ? "fixed bottom-4 right-4 rounded-md border bg-background px-4 py-3 text-sm shadow"
              : "fixed bottom-4 right-4 rounded-md border border-destructive bg-background px-4 py-3 text-sm text-destructive shadow"
          }
          role={notice.type === "success" ? "status" : "alert"}
        >
          {notice.message}
        </div>
      ) : null}
    </section>
  );
}
