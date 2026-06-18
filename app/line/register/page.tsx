import { Building2 } from "lucide-react";
import { LineRegistrationForm } from "@/components/line-registration-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { verifyLineRegistrationToken } from "@/lib/line-registration";

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function LineRegisterPage({ searchParams }: PageProps) {
  const { token = "" } = await searchParams;
  const valid = Boolean(token && verifyLineRegistrationToken(token));

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-white px-4 py-8">
      <Card className="mx-auto w-full max-w-md overflow-hidden shadow-lg">
        <div className="h-2 bg-emerald-600" />
        <CardHeader className="items-center pb-4 text-center">
          <div className="mb-2 rounded-full bg-emerald-50 p-3 text-emerald-700">
            <Building2 className="h-7 w-7" />
          </div>
          <CardTitle>ลงทะเบียนผู้เข้าพัก</CardTitle>
          <p className="text-sm text-muted-foreground">
            กรอกข้อมูลเพื่อเชื่อมบัญชี LINE กับห้องพัก
          </p>
        </CardHeader>
        <CardContent>
          {valid ? (
            <LineRegistrationForm token={token} />
          ) : (
            <div className="rounded-lg bg-amber-50 px-4 py-5 text-center text-sm leading-6 text-amber-800">
              ลิงก์ลงทะเบียนไม่ถูกต้องหรือหมดอายุ
              <br />
              กรุณากลับไปกดปุ่ม “ลงทะเบียน” ใน LINE อีกครั้ง
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
