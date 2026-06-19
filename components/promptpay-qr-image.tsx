"use client";

import { useState } from "react";

type PromptPayQrImageProps = {
  billId: string;
};

export function PromptPayQrImage({ billId }: PromptPayQrImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex aspect-[3/4] w-full max-w-[300px] items-center justify-center rounded-xl border bg-muted px-4 text-center text-sm text-muted-foreground">
        ไม่สามารถแสดง QR PromptPay ได้
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/bills/${billId}/qr`}
      alt="QR PromptPay พร้อมยอดชำระ"
      width={300}
      height={400}
      className="h-auto w-full max-w-[300px] rounded-xl shadow-sm"
      onError={() => setFailed(true)}
    />
  );
}
