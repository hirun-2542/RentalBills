"use client";

import { useState } from "react";

type PromptPayQrImageProps = {
  billId: string;
};

export function PromptPayQrImage({ billId }: PromptPayQrImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-[250px] w-[250px] items-center justify-center border bg-muted px-4 text-center text-sm text-muted-foreground">
        ไม่สามารถแสดง QR PromptPay ได้
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/bills/${billId}/qr`}
      alt="QR PromptPay"
      width={250}
      height={250}
      onError={() => setFailed(true)}
    />
  );
}
