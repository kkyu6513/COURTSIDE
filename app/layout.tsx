import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
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
      <body className="bg-bg text-ink min-h-screen">
        <NextTopLoader
          color="#0F172A"
          height={3}
          showSpinner={false}
          shadow="0 0 10px #0F172A, 0 0 5px #0F172A"
        />
        {children}
      </body>
    </html>
  );
}
