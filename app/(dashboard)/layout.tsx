import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Rooms", href: "/rooms" },
  { label: "Bills", href: "/bills" },
  { label: "History", href: "/history" },
  { label: "Settings", href: "/settings" },
];

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card px-4 py-6 md:block">
        <div className="text-lg font-semibold">RentalBills</div>
        <Separator className="my-4" />
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              className="justify-start"
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-background px-6">
          <div className="text-sm font-medium text-muted-foreground">
            RentalBills
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
