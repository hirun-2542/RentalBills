import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BillStatus = "DRAFT" | "SENT" | "PAID";

const statusStyles: Record<BillStatus, string> = {
  DRAFT: "border-transparent bg-gray-100 text-gray-700 hover:bg-gray-100",
  SENT: "border-transparent bg-blue-100 text-blue-700 hover:bg-blue-100",
  PAID: "border-transparent bg-green-100 text-green-700 hover:bg-green-100",
};

export function PaymentBadge({ status }: { status: BillStatus }) {
  return (
    <Badge variant="outline" className={cn("w-fit", statusStyles[status])}>
      {status}
    </Badge>
  );
}
