"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  timeLabel: string;
  hasSlot: boolean;
  pending: boolean;
  onToggleAvailability: () => void;
  onBookLesson?: () => void; // 곧 제공
  onBlock?: () => void; // 곧 제공
};

export function EmptySlotSheet({
  open,
  onClose,
  timeLabel,
  hasSlot,
  pending,
  onToggleAvailability,
  onBookLesson,
  onBlock,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="courtside-backdrop-anim fixed inset-0 z-[10000]"
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(15, 23, 42, 0.4)" }}
        onClick={onClose}
      />
      <div
        className="absolute left-0 right-0 bottom-0 bg-surface rounded-t-3xl px-5 pt-3 pb-6 shadow-2xl"
        style={{ animation: "courtside-sheet-up 0.25s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-line mx-auto mb-4" />
        <div className="text-base font-extrabold text-ink">{timeLabel}</div>
        <div className="mt-1 text-xs text-ink-3">이 시간에 할 작업을 선택하세요</div>

        <div className="mt-4 space-y-2">
          <SheetButton
            onClick={onToggleAvailability}
            disabled={pending}
            iconBg="bg-primary/15"
            icon={
              <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {hasSlot ? <path d="M6 18L18 6M6 6l12 12" /> : (<>
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M8 2v4M16 2v4M3 10h18M9 16l2 2 4-4" />
                </>)}
              </svg>
            }
            title={hasSlot ? "이 시간 레슨 안 받기" : "이 시간 레슨 받기"}
            desc={
              hasSlot
                ? "이 시간을 닫아 수강생이 신청하지 못하게 합니다. (매주 반복 해제)"
                : "수강생이 이 시간에 레슨 신청을 할 수 있게 열어둡니다. (매주 반복)"
            }
            tone={hasSlot ? "danger" : "primary"}
          />

          <SheetButton
            onClick={onBookLesson}
            disabled
            iconBg="bg-soft"
            icon={
              <svg className="w-5 h-5 text-ink-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            }
            title="이 시간에 레슨 잡기"
            desc="수강생을 선택해 직접 레슨을 잡습니다 (곧 제공)"
            tone="muted"
          />

          <SheetButton
            onClick={onBlock}
            disabled
            iconBg="bg-soft"
            icon={
              <svg className="w-5 h-5 text-ink-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            }
            title="이 시간 블록하기"
            desc="개인 일정으로 이 시간의 예약을 차단합니다 (곧 제공)"
            tone="muted"
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition"
        >
          취소
        </button>
      </div>
    </div>,
    document.body,
  );
}

function SheetButton({
  onClick,
  disabled,
  iconBg,
  icon,
  title,
  desc,
  tone,
}: {
  onClick?: () => void;
  disabled?: boolean;
  iconBg: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  tone: "primary" | "danger" | "muted";
}) {
  const titleColor =
    tone === "danger" ? "text-red-500" : tone === "muted" ? "text-ink-3" : "text-ink";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 px-4 py-3.5 bg-soft rounded-xl text-left transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-none ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-bold ${titleColor}`}>{title}</div>
        <div className="mt-0.5 text-[11px] text-ink-3 leading-relaxed">{desc}</div>
      </div>
    </button>
  );
}
