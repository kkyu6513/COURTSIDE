"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { LessonDetail } from "@/components/coach/lesson-detail-sheet";

const STATUS_LABEL: Record<LessonDetail["status"], { text: string; bg: string; fg: string }> = {
  CONFIRMED: { text: "확정", bg: "bg-emerald-50", fg: "text-emerald-600" },
  PENDING: { text: "대기", bg: "bg-amber-50", fg: "text-amber-600" },
  UPCOMING: { text: "예정", bg: "bg-violet-50", fg: "text-violet-600" },
  CHANGE_REQUEST: { text: "변경 요청", bg: "bg-orange-50", fg: "text-orange-600" },
  COMPLETED: { text: "완료", bg: "bg-blue-50", fg: "text-blue-600" },
  CANCELLED: { text: "취소", bg: "bg-soft", fg: "text-ink-3" },
};

function formatKstHm(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  hourLabel: string; // "5월 16일 토요일 · 10시"
  lessons: LessonDetail[];
  onPickLesson: (lesson: LessonDetail) => void;
  onBookNew: () => void;
};

export function LessonListSheet({ open, onClose, hourLabel, lessons, onPickLesson, onBookNew }: Props) {
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
        className="absolute left-0 right-0 bottom-0 bg-surface rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh]"
        style={{ animation: "courtside-sheet-up 0.25s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-3 pb-3 flex-none">
          <div className="w-10 h-1 rounded-full bg-line mx-auto mb-4" />
          <div className="text-base font-extrabold text-ink">{hourLabel}</div>
          <div className="mt-1 text-xs text-ink-3">{lessons.length}개의 레슨이 잡혀있어요</div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-2">
          <ul className="space-y-2">
            {lessons.map((l) => {
              const status = STATUS_LABEL[l.status];
              const endIso = new Date(new Date(l.scheduledAt).getTime() + l.durationMinutes * 60 * 1000).toISOString();
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => onPickLesson(l)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-soft hover:bg-line/60 transition active:scale-[0.99] text-left"
                  >
                    <div className="w-12 flex-none text-center">
                      <div className="text-xs font-bold text-ink">{formatKstHm(l.scheduledAt)}</div>
                      <div className="text-[10px] text-ink-3">~{formatKstHm(endIso)}</div>
                    </div>
                    <div className="w-px h-10 bg-line flex-none" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-ink truncate">{l.studentName}</div>
                      <div className="mt-0.5 text-[11px] text-ink-3">{l.durationMinutes}분</div>
                    </div>
                    <span className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.bg} ${status.fg}`}>
                      {status.text}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="px-5 pb-6 pt-3 border-t border-line flex-none space-y-2">
          <button
            type="button"
            onClick={onBookNew}
            className="w-full h-12 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition active:scale-[0.99]"
          >
            이 시간대에 레슨 추가로 잡기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
