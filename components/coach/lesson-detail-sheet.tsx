"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { maskPhone } from "@/lib/masking";

export type LessonDetail = {
  id: number;
  studentName: string;
  studentPhone: string | null;
  scheduledAt: string; // ISO
  durationMinutes: number;
  status: "CONFIRMED" | "PENDING" | "UPCOMING" | "CHANGE_REQUEST" | "COMPLETED" | "CANCELLED";
};

type Props = {
  open: boolean;
  onClose: () => void;
  lesson: LessonDetail | null;
  pendingCancel: boolean;
  onCancel: () => void;
};

const STATUS_LABEL: Record<LessonDetail["status"], { text: string; bg: string; fg: string }> = {
  CONFIRMED: { text: "레슨 확정", bg: "bg-emerald-50", fg: "text-emerald-600" },
  PENDING: { text: "대기 중", bg: "bg-amber-50", fg: "text-amber-600" },
  UPCOMING: { text: "레슨 예정", bg: "bg-violet-50", fg: "text-violet-600" },
  CHANGE_REQUEST: { text: "변경 요청", bg: "bg-orange-50", fg: "text-orange-600" },
  COMPLETED: { text: "완료", bg: "bg-blue-50", fg: "text-blue-600" },
  CANCELLED: { text: "취소됨", bg: "bg-soft", fg: "text-ink-3" },
};

const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];

function parseIsoUtc(s: string): Date {
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + "Z");
}

function formatKstTimeRange(iso: string, durationMinutes: number) {
  const start = new Date(parseIsoUtc(iso).getTime() + 9 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const m = start.getUTCMonth() + 1;
  const day = start.getUTCDate();
  const dow = DOW_KOR[start.getUTCDay()];
  const hh1 = String(start.getUTCHours()).padStart(2, "0");
  const mm1 = String(start.getUTCMinutes()).padStart(2, "0");
  const hh2 = String(end.getUTCHours()).padStart(2, "0");
  const mm2 = String(end.getUTCMinutes()).padStart(2, "0");
  return {
    dateLabel: `${m}월 ${day}일 ${dow}요일`,
    timeLabel: `${hh1}:${mm1} ~ ${hh2}:${mm2}`,
  };
}

export function LessonDetailSheet({ open, onClose, lesson, pendingCancel, onCancel }: Props) {
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

  if (!open || !lesson) return null;
  if (typeof document === "undefined") return null;

  const { dateLabel, timeLabel } = formatKstTimeRange(lesson.scheduledAt, lesson.durationMinutes);
  const status = STATUS_LABEL[lesson.status];
  const isCancelled = lesson.status === "CANCELLED";

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

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-base font-extrabold text-ink">{dateLabel}</div>
            <div className="mt-0.5 text-sm text-ink-2">{timeLabel}</div>
          </div>
          <span className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.bg} ${status.fg}`}>
            {status.text}
          </span>
        </div>

        <div className="mt-4 p-4 rounded-xl bg-soft">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm flex-none">
              {lesson.studentName.slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-ink">{lesson.studentName}</div>
              <div className="mt-0.5 text-[11px] text-ink-3">
                {lesson.studentPhone ? maskPhone(lesson.studentPhone) : "전화번호 없음"}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {!isCancelled && (
            <button
              type="button"
              onClick={onCancel}
              disabled={pendingCancel}
              className="w-full h-12 rounded-xl bg-red-50 text-red-500 text-sm font-semibold hover:bg-red-100 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {pendingCancel && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                </svg>
              )}
              {pendingCancel ? "취소 중…" : "레슨 취소"}
            </button>
          )}

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
