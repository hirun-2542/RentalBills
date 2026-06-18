"use client";

import { CheckCircle2, Home, Loader2, Phone, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LineRegistrationForm({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/line/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        name: formData.get("name"),
        phone: formData.get("phone"),
        roomNumber: formData.get("roomNumber"),
      }),
    });
    const result = await response.json().catch(() => null);

    setSubmitting(false);
    if (!response.ok) {
      setError(result?.error ?? "ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่");
      return;
    }

    setRoomNumber(result.roomNumber);
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="space-y-5 py-4 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
        <div>
          <h2 className="text-xl font-semibold">ลงทะเบียนเรียบร้อยแล้ว</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ห้อง {roomNumber} เชื่อมกับ LINE ของคุณแล้ว
          </p>
        </div>
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          กลับไปที่ LINE แล้วกด “ดูบิล” ได้ทันที
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="name">
          ชื่อผู้เข้าพัก
        </label>
        <div className="relative">
          <UserRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-11 pl-10"
            id="name"
            name="name"
            autoComplete="name"
            placeholder="เช่น สมชาย ใจดี"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="phone">
          เบอร์โทรศัพท์
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-11 pl-10"
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0812345678"
            pattern="0[0-9 -]{8,11}"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="roomNumber">
          เลขห้องที่เข้าพัก
        </label>
        <div className="relative">
          <Home className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-11 pl-10"
            id="roomNumber"
            name="roomNumber"
            inputMode="numeric"
            placeholder="เช่น 101"
            required
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <Button className="h-11 w-full" disabled={submitting} type="submit">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitting ? "กำลังลงทะเบียน..." : "ยืนยันการลงทะเบียน"}
      </Button>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        ข้อมูลนี้ใช้สำหรับเชื่อมบัญชี LINE กับห้องพักและแสดงบิลของคุณ
      </p>
    </form>
  );
}
