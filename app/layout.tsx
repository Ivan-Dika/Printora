import type { Metadata } from "next";
import "./globals.css";
import { BRAND } from "../lib/brand";

export const metadata: Metadata = {
  title: "Printora | Pesanan Percetakan",
  description: "Jelajahi layanan cetak dan ajukan pesanan Anda di Printora.",
  icons: {
    icon: BRAND.favicon,
    shortcut: BRAND.favicon,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}

