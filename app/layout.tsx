import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COURTSIDE",
  description: "테니스 코치 SaaS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-bg text-ink min-h-screen">{children}</body>
    </html>
  );
}
