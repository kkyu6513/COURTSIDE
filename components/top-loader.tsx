"use client";

import NextTopLoader from "nextjs-toploader";

export function TopLoader() {
  return (
    <NextTopLoader
      color="#10B981"
      height={4}
      crawl={true}
      crawlSpeed={200}
      initialPosition={0.1}
      easing="ease"
      speed={400}
      showSpinner={false}
      zIndex={9999}
      shadow="0 0 10px #10B981, 0 0 5px #10B981"
    />
  );
}
