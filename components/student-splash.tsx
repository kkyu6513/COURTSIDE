"use client";

import { useEffect, useState } from "react";
import type { Quote } from "@/lib/quotes";

type Phase = "in" | "out" | "gone";

export function StudentSplash({ quote }: { quote: Quote }) {
  const [phase, setPhase] = useState<Phase>("in");

  useEffect(() => {
    const fadeTimer = setTimeout(() => setPhase("out"), 2000);
    const removeTimer = setTimeout(() => setPhase("gone"), 2500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  useEffect(() => {
    if (phase === "gone") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 transition-opacity duration-500 ${
        phase === "out" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="px-8 max-w-md text-center">
        <div className="text-primary/40 text-7xl leading-none font-serif select-none" aria-hidden>
          &ldquo;
        </div>
        <p className="mt-1 text-lg font-semibold text-ink leading-relaxed">{quote.t}</p>
        <p className="mt-3 text-sm text-primary-600 font-medium">
          <cite className="not-italic">{quote.by}</cite>
        </p>

        <div className="mt-10">
          <div
            className="h-1.5 w-full rounded-full bg-primary-100 overflow-hidden"
            role="progressbar"
            aria-label="홈 화면 준비 중"
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="courtside-splash-progress-fill h-full w-full rounded-full bg-primary shadow-[0_0_8px_rgba(45,212,191,0.45)]"
            />
          </div>
          <div className="mt-2.5 text-[11px] text-ink-3 font-medium tracking-wide">
            잠시만요, 홈을 준비하고 있어요…
          </div>
        </div>
      </div>
    </div>
  );
}
