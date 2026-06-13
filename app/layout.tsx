import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RentalBills",
  description: "Rental bill management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
