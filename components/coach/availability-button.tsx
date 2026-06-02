"use client";

import { useState } from "react";
import { AvailabilitySheet } from "@/components/coach/availability-sheet";

/**
 * 코치 홈 진입점 — "가능 시간대 확인" 버튼 + 시트 상태 관리.
 * 코치 홈은 server component라 client 상태가 필요한 부분만 분리.
 */
export function AvailabilityButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex-none inline-flex items-center gap-1.5 rounded-full border border-line bg-surface text-ink-2 text-xs font-semibold px-3 py-2 hover:bg-soft transition active:scale-[0.98]"
        title="기간 / 시간대 / 길이를 골라 가능한 빈 시간을 확인합니다"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        가능 시간 확인
      </button>
      <AvailabilitySheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
