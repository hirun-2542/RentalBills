import { cn } from "@/lib/utils";

type BillStatus = "DRAFT" | "SENT" | "PAID";

const statusStyles: Record<BillStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
};

export function PaymentBadge({ status }: { status: BillStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
        statusStyles[status]
      )}
    >
      {status}
    </span>
  );
}
