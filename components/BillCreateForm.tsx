"use client";

import type { Room, Tenant } from "@prisma/client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { MeterForm } from "@/components/MeterForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MeterRoom = Pick<Room, "id" | "number"> & {
  tenant: Pick<Tenant, "id" | "name">;
};

type BillCreateFormProps = {
  rooms: MeterRoom[];
};

type ApiError = {
  error?: string;
  errors?: Array<{ roomId: string; error: string }>;
  skipped?: Array<{ roomId: string; reason: string }>;
  duplicates?: Array<{ roomId: string; roomNumber: string }>;
};

const now = new Date();

function readNumber(formData: FormData, name: string) {
  return Number(formData.get(name));
}

function formatApiErrors(data: ApiError) {
  const messages = [
    data.error,
    ...(data.errors ?? []).map((item) => item.error),
    ...(data.skipped ?? []).map((item) => item.reason),
    ...(data.duplicates ?? []).map(
      (item) => `มีบิลของห้อง ${item.roomNumber} แล้ว`
    ),
  ].filter((message): message is string => Boolean(message));

  return messages.length > 0 ? messages : ["ไม่สามารถสร้างบิลได้"];
}

export function BillCreateForm({ rooms }: BillCreateFormProps) {
  const router = useRouter();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors([]);

    const formData = new FormData(event.currentTarget);
    const bills = rooms.map((room, index) => ({
      roomId: String(formData.get(`bills.${index}.roomId`) ?? room.id),
      waterPrevReading: readNumber(formData, `bills.${index}.waterPrevReading`),
      waterCurrReading: readNumber(formData, `bills.${index}.waterCurrReading`),
      elecPrevReading: readNumber(formData, `bills.${index}.elecPrevReading`),
      elecCurrReading: readNumber(formData, `bills.${index}.elecCurrReading`),
    }));

    const response = await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: Number(month),
        year: Number(year),
        bills,
      }),
    }).catch(() => null);

    if (!response) {
      setErrors(["ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้"]);
      setSubmitting(false);
      return;
    }

    const data = (await response.json().catch(() => ({}))) as ApiError;

    if (!response.ok) {
      setErrors(formatApiErrors(data));
      setSubmitting(false);
      return;
    }

    if (data.skipped?.length) {
      setErrors(formatApiErrors(data));
      setSubmitting(false);
      return;
    }

    router.push("/bills");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm" htmlFor="bill-month">
          <span className="font-medium">เดือน</span>
          <Input
            id="bill-month"
            max={12}
            min={1}
            onChange={(event) => setMonth(event.target.value)}
            type="number"
            value={month}
            className="w-28"
            required
          />
        </label>
        <label className="space-y-1 text-sm" htmlFor="bill-year">
          <span className="font-medium">ปี</span>
          <Input
            id="bill-year"
            min={2000}
            onChange={(event) => setYear(event.target.value)}
            type="number"
            value={year}
            className="w-32"
            required
          />
        </label>
      </div>

      {errors.length > 0 ? (
        <div
          role="alert"
          className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        {rooms.map((room, index) => (
          <MeterForm key={room.id} index={index} room={room} />
        ))}
      </div>

      <Button disabled={submitting || rooms.length === 0} type="submit">
        {submitting ? "กำลังสร้างบิล" : "สร้างบิล"}
      </Button>
    </form>
  );
}
