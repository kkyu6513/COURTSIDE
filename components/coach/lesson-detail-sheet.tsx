"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { maskPhone } from "@/lib/masking";
import { deriveDisplayStatus, getStatusLabel } from "@/lib/lesson-status";

export type LessonDetail = {
  id: number;
  studentName: string;
  studentPhone: string | null;
  scheduledAt: string; // ISO
  durationMinutes: number;
  // DB lessons.status (12종) — 라벨/색은 @/lib/lesson-status 단일 소스
  status: string;
  notes?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  lesson: LessonDetail | null;
  pendingCancel: boolean;
  pendingNotes: boolean;
  pendingRestore?: boolean;
  onCancel: () => void;
  onSaveNotes: (notes: string) => void;
  onRestore?: () => void; // CANCELLED 레슨 복구
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

export function LessonDetailSheet({ open, onClose, lesson, pendingCancel, pendingNotes, pendingRestore, onCancel, onSaveNotes, onRestore }: Props) {
  const [notesDraft, setNotesDraft] = useState("");

  useEffect(() => {
    if (lesson) setNotesDraft(lesson.notes ?? "");
  }, [lesson]);

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
  // 진행 시간대면 CONFIRMED → IN_PROGRESS 자동 변환 (코치 홈과 동일 규칙)
  const displayStatus = deriveDisplayStatus(lesson.status, lesson.scheduledAt, lesson.durationMinutes);
  const status = getStatusLabel(displayStatus);
  const isCancelled = lesson.status === "CANCELLED";

  // 지난 레슨 (시작 시각이 현재보다 이전) — 취소 비표시
  const isPast = parseIsoUtc(lesson.scheduledAt).getTime() < Date.now();
  const canCancel = !isCancelled && !isPast;
  const canRestore = isCancelled && !isPast && !!onRestore;
  const notesChanged = notesDraft.trim() !== (lesson.notes ?? "").trim();

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
        <div className="relative">
          <div className="w-10 h-1 rounded-full bg-line mx-auto mb-4" />
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute -top-1 right-0 w-8 h-8 rounded-full text-ink-3 hover:bg-soft transition flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

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

        {/* 코치 코멘트 */}
        <div className="mt-4">
          <div className="text-xs font-semibold text-ink-2 mb-1.5">코치 메모</div>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder={isPast ? "이 레슨에 대한 코멘트를 남겨보세요 (자세, 진도, 다음 회차 등)" : "레슨 전 메모, 코칭 포인트 등"}
            rows={3}
            maxLength={1000}
            className="w-full rounded-xl border border-line bg-surface p-3 text-sm text-ink placeholder:text-ink-3 resize-none outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] text-ink-3">{notesDraft.length} / 1000</span>
            {notesChanged && (
              <button
                type="button"
                onClick={() => onSaveNotes(notesDraft)}
                disabled={pendingNotes}
                className="text-[11px] font-semibold text-primary px-3 py-1 rounded-md hover:bg-primary/10 disabled:opacity-60"
              >
                {pendingNotes ? "저장 중…" : "메모 저장"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {canCancel && (
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

          {canRestore && (
            <button
              type="button"
              onClick={onRestore}
              disabled={!!pendingRestore}
              className="w-full h-12 rounded-xl bg-emerald-50 text-emerald-600 text-sm font-semibold hover:bg-emerald-100 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {pendingRestore && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                </svg>
              )}
              {pendingRestore ? "복구 중…" : "취소된 레슨 복구"}
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
