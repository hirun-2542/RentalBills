import { serve } from "inngest/next";
import { generateBillPdf } from "@/inngest/generate-bill-pdf";
import { inngest } from "@/lib/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateBillPdf],
});
