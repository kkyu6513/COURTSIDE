import type { Metadata, Viewport } from "next";
import { TopLoader } from "@/components/top-loader";
import "./globals.css";

export const metadata: Metadata = {
  title: "COURTSIDE",
  description: "테니스 코치 SaaS",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#2DD4BF",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-bg text-ink min-h-screen">
        <TopLoader />
        {children}
      </body>
    </html>
  );
}
