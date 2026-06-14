"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type PdfStatus = "NONE" | "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export type BillPdfState = {
  id: string;
  pdfStatus: PdfStatus;
  pdfUrl: string | null;
  pdfError: string | null;
};

type BillResponse = BillPdfState;
const POLLING_TIMEOUT_MS = 5 * 60 * 1000;

async function readApiError(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.error ?? "เกิดข้อผิดพลาด";
}

function isGenerating(status: PdfStatus) {
  return status === "PENDING" || status === "PROCESSING";
}

export function BillPdfPanel({ initialBill }: { initialBill: BillPdfState }) {
  const [bill, setBill] = useState(initialBill);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const generating = isGenerating(bill.pdfStatus);

  useEffect(() => {
    if (!generating) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const response = await fetch(`/api/bills/${bill.id}`);

      if (!response.ok) {
        setError(await readApiError(response));
        window.clearInterval(intervalId);
        return;
      }

      const nextBill = (await response.json()) as BillResponse;
      setBill({
        id: nextBill.id,
        pdfStatus: nextBill.pdfStatus,
        pdfUrl: nextBill.pdfUrl,
        pdfError: nextBill.pdfError,
      });
    }, 2000);
    const timeoutId = window.setTimeout(() => {
      setError("ใช้เวลาสร้าง PDF นานเกินไป กรุณาลองใหม่อีกครั้ง");
      window.clearInterval(intervalId);
    }, POLLING_TIMEOUT_MS);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [bill.id, generating]);

  async function generatePdf() {
    setSubmitting(true);
    setError("");

    const response = await fetch(`/api/bills/${bill.id}/generate`, {
      method: "POST",
    });

    if (!response.ok) {
      setError(await readApiError(response));
      setSubmitting(false);
      return;
    }

    setBill((current) => ({
      ...current,
      pdfStatus: "PENDING",
      pdfUrl: null,
      pdfError: null,
    }));
    setSubmitting(false);
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">PDF</h2>
          <p className="text-sm text-muted-foreground">
            สถานะ: {bill.pdfStatus}
          </p>
        </div>
        <Button onClick={generatePdf} disabled={submitting || generating}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {bill.pdfStatus === "FAILED" ? "ลองใหม่" : "สร้าง PDF"}
        </Button>
      </div>

      {generating ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          กำลังสร้าง PDF
        </div>
      ) : null}

      {bill.pdfStatus === "DONE" && bill.pdfUrl ? (
        <Button asChild variant="outline">
          <a href={bill.pdfUrl} download>
            ดาวน์โหลด PDF
          </a>
        </Button>
      ) : null}

      {bill.pdfStatus === "FAILED" && bill.pdfError ? (
        <p className="text-sm text-destructive">{bill.pdfError}</p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
