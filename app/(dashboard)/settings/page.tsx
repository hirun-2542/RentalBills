"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SettingsForm = {
  waterRatePerUnit: string;
  waterCollectionFee: string;
  elecRatePerUnit: string;
  bankAccountName: string;
  bankAccountNumber: string;
  promptpayNumber: string;
};

type Notice = {
  type: "success" | "error";
  message: string;
} | null;

const defaultValues: SettingsForm = {
  waterRatePerUnit: "",
  waterCollectionFee: "",
  elecRatePerUnit: "",
  bankAccountName: "",
  bankAccountNumber: "",
  promptpayNumber: "",
};

function normalizeSettings(data: Partial<Record<keyof SettingsForm, unknown>>) {
  return {
    waterRatePerUnit: String(data.waterRatePerUnit ?? ""),
    waterCollectionFee: String(data.waterCollectionFee ?? ""),
    elecRatePerUnit: String(data.elecRatePerUnit ?? ""),
    bankAccountName: String(data.bankAccountName ?? ""),
    bankAccountNumber: String(data.bankAccountNumber ?? ""),
    promptpayNumber: String(data.promptpayNumber ?? ""),
  };
}

function getNumericError(value: string) {
  const numberValue = Number(value);
  return !value || !Number.isFinite(numberValue) || numberValue < 0;
}

export default function SettingsPage() {
  const [form, setForm] = useState<SettingsForm>(defaultValues);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      setLoading(true);
      setNotice(null);

      try {
        const response = await fetch("/api/settings", { cache: "no-store" });

        if (!response.ok) {
          throw new Error("โหลดการตั้งค่าไม่สำเร็จ");
        }

        const data = await response.json();
        if (active) {
          setForm(normalizeSettings(data));
        }
      } catch (error) {
        if (active) {
          setNotice({
            type: "error",
            message:
              error instanceof Error ? error.message : "โหลดการตั้งค่าไม่สำเร็จ",
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      active = false;
    };
  }, []);

  const numericErrors = {
    waterRatePerUnit: getNumericError(form.waterRatePerUnit),
    waterCollectionFee: getNumericError(form.waterCollectionFee),
    elecRatePerUnit: getNumericError(form.elecRatePerUnit),
  };
  const hasNumericError = Object.values(numericErrors).some(Boolean);

  function updateField(key: keyof SettingsForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (hasNumericError) {
      setNotice({ type: "error", message: "กรุณากรอกตัวเลขไม่ติดลบ" });
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waterRatePerUnit: Number(form.waterRatePerUnit),
          waterCollectionFee: Number(form.waterCollectionFee),
          elecRatePerUnit: Number(form.elecRatePerUnit),
          bankAccountName: form.bankAccountName,
          bankAccountNumber: form.bankAccountNumber,
          promptpayNumber: form.promptpayNumber,
        }),
      });

      if (!response.ok) {
        throw new Error("บันทึกการตั้งค่าไม่สำเร็จ");
      }

      const data = await response.json();
      setForm(normalizeSettings(data));
      setNotice({ type: "success", message: "บันทึกการตั้งค่าแล้ว" });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "บันทึกการตั้งค่าไม่สำเร็จ",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          จัดการอัตราค่าน้ำ ค่าไฟ บัญชีธนาคาร และ PromptPay
        </p>
      </div>

      {notice ? (
        <div
          role="status"
          className={
            notice.type === "success"
              ? "rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
              : "rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          }
        >
          {notice.message}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>อัตราค่าสาธารณูปโภค</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="waterRatePerUnit">ค่าน้ำ บาท/หน่วย</Label>
              <Input
                id="waterRatePerUnit"
                type="number"
                min="0"
                step="0.01"
                value={form.waterRatePerUnit}
                onChange={(event) =>
                  updateField("waterRatePerUnit", event.target.value)
                }
                aria-invalid={numericErrors.waterRatePerUnit}
                disabled={loading || saving}
              />
              {numericErrors.waterRatePerUnit ? (
                <p className="text-sm text-destructive">ต้องไม่ติดลบ</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="waterCollectionFee">ค่าจัดเก็บน้ำ บาท/บิล</Label>
              <Input
                id="waterCollectionFee"
                type="number"
                min="0"
                step="0.01"
                value={form.waterCollectionFee}
                onChange={(event) =>
                  updateField("waterCollectionFee", event.target.value)
                }
                aria-invalid={numericErrors.waterCollectionFee}
                disabled={loading || saving}
              />
              {numericErrors.waterCollectionFee ? (
                <p className="text-sm text-destructive">ต้องไม่ติดลบ</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="elecRatePerUnit">ค่าไฟ บาท/หน่วย</Label>
              <Input
                id="elecRatePerUnit"
                type="number"
                min="0"
                step="0.01"
                value={form.elecRatePerUnit}
                onChange={(event) =>
                  updateField("elecRatePerUnit", event.target.value)
                }
                aria-invalid={numericErrors.elecRatePerUnit}
                disabled={loading || saving}
              />
              {numericErrors.elecRatePerUnit ? (
                <p className="text-sm text-destructive">ต้องไม่ติดลบ</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>บัญชีธนาคาร</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bankAccountName">ชื่อบัญชี</Label>
              <Input
                id="bankAccountName"
                value={form.bankAccountName}
                onChange={(event) =>
                  updateField("bankAccountName", event.target.value)
                }
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankAccountNumber">เลขบัญชี</Label>
              <Input
                id="bankAccountNumber"
                value={form.bankAccountNumber}
                onChange={(event) =>
                  updateField("bankAccountNumber", event.target.value)
                }
                disabled={loading || saving}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PromptPay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="promptpayNumber">เลขบัตรประชาชน / เบอร์โทร</Label>
            <Input
              id="promptpayNumber"
              value={form.promptpayNumber}
              onChange={(event) =>
                updateField("promptpayNumber", event.target.value)
              }
              disabled={loading || saving}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={loading || saving || hasNumericError}>
            {saving ? "กำลังบันทึก" : "บันทึก"}
          </Button>
        </div>
      </form>
    </div>
  );
}
