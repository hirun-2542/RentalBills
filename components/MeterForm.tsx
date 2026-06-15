"use client";

import type { Room, Tenant } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { getMeterUsage } from "@/lib/dashboard-bills-ui";

type MeterRoom = Pick<Room, "id" | "number"> & {
  tenant: Pick<Tenant, "id" | "name">;
};

type MeterFormProps = {
  room: MeterRoom;
  index: number;
  onValidityChange?: (index: number, hasError: boolean) => void;
};

export function MeterForm({ room, index, onValidityChange }: MeterFormProps) {
  const [readings, setReadings] = useState({
    waterPrevReading: "",
    waterCurrReading: "",
    elecPrevReading: "",
    elecCurrReading: "",
  });
  const usage = useMemo(() => getMeterUsage(readings), [readings]);
  const hasWaterError = usage.waterUsage < 0;
  const hasElecError = usage.elecUsage < 0;

  useEffect(() => {
    onValidityChange?.(index, hasWaterError || hasElecError);
  }, [hasElecError, hasWaterError, index, onValidityChange]);

  function updateReading(name: keyof typeof readings, value: string) {
    setReadings((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className="grid gap-4 rounded-lg border p-4 lg:grid-cols-[1fr_repeat(4,minmax(110px,1fr))_120px_120px]">
      <input name={`bills.${index}.roomId`} type="hidden" value={room.id} />
      <div className="space-y-1">
        <div className="font-medium">ห้อง {room.number}</div>
        <div className="text-sm text-muted-foreground">{room.tenant.name}</div>
      </div>
      <ReadingInput
        id={`water-prev-${room.id}`}
        label="น้ำก่อนหน้า"
        name={`bills.${index}.waterPrevReading`}
        onChange={(value) => updateReading("waterPrevReading", value)}
        value={readings.waterPrevReading}
      />
      <ReadingInput
        id={`water-curr-${room.id}`}
        label="น้ำปัจจุบัน"
        name={`bills.${index}.waterCurrReading`}
        onChange={(value) => updateReading("waterCurrReading", value)}
        value={readings.waterCurrReading}
      />
      <ReadingInput
        id={`elec-prev-${room.id}`}
        label="ไฟก่อนหน้า"
        name={`bills.${index}.elecPrevReading`}
        onChange={(value) => updateReading("elecPrevReading", value)}
        value={readings.elecPrevReading}
      />
      <ReadingInput
        id={`elec-curr-${room.id}`}
        label="ไฟปัจจุบัน"
        name={`bills.${index}.elecCurrReading`}
        onChange={(value) => updateReading("elecCurrReading", value)}
        value={readings.elecCurrReading}
      />
      <UsageDisplay
        error={hasWaterError}
        label="ใช้น้ำ"
        value={usage.waterUsage}
      />
      <UsageDisplay error={hasElecError} label="ใช้ไฟ" value={usage.elecUsage} />
      {(hasWaterError || hasElecError) ? (
        <div className="text-sm text-destructive lg:col-start-2 lg:col-end-8">
          {hasWaterError ? (
            <p>ค่ามิเตอร์น้ำปัจจุบันต้องไม่น้อยกว่าค่าก่อนหน้า</p>
          ) : null}
          {hasElecError ? (
            <p>ค่ามิเตอร์ไฟปัจจุบันต้องไม่น้อยกว่าค่าก่อนหน้า</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReadingInput({
  id,
  label,
  name,
  onChange,
  value,
}: {
  id: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="space-y-1 text-sm" htmlFor={id}>
      <span className="font-medium">{label}</span>
      <Input
        id={id}
        name={name}
        min={0}
        onChange={(event) => onChange(event.target.value)}
        step="0.01"
        type="number"
        value={value}
        required
      />
    </label>
  );
}

function UsageDisplay({
  error,
  label,
  value,
}: {
  error: boolean;
  label: string;
  value: number;
}) {
  return (
    <div className="space-y-1 text-sm">
      <span className="block font-medium">{label}</span>
      <span
        className={error ? "block text-destructive" : "block text-muted-foreground"}
      >
        {Number.isFinite(value) ? value : 0}
      </span>
    </div>
  );
}
