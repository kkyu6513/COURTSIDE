"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { maskPhone } from "@/lib/masking";
import { deriveDisplayStatus, getStatusLabel } from "@/lib/lesson-status";
import { KST_OFFSET_MS, parseIsoUtc } from "@/lib/kst";

export type LessonDetail = {
  id: number;
  studentName: string;
  studentPhone: string | null;
  scheduledAt: string; // ISO
  durationMinutes: number;
  // DB lessons.status (12종) — 라벨/색은 @/lib/lesson-status 단일 소스
  status: string;
  paymentStatus?: string | null; // PAID | UNPAID | EXTERNAL | NONE
  notes?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  lesson: LessonDetail | null;
  pendingCancel: boolean;
  pendingNotes: boolean;
  pendingRestore?: boolean;
  pendingComplete?: boolean;
  pendingAbsent?: boolean;
  pendingPaid?: boolean;
  onCancel: () => void;
  onSaveNotes: (notes: string) => void;
  onRestore?: () => void; // CANCELLED 레슨 복구
  onComplete?: () => void; // CONFIRMED/IN_PROGRESS → COMPLETED
  onAbsent?: () => void; // CONFIRMED/IN_PROGRESS → ABSENT
  onMarkPaid?: () => void; // paymentStatus UNPAID → PAID
};

const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];

function formatKstTimeRange(iso: string, durationMinutes: number) {
  const start = new Date(parseIsoUtc(iso).getTime() + KST_OFFSET_MS);
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

export function LessonDetailSheet({
  open,
  onClose,
  lesson,
  pendingCancel,
  pendingNotes,
  pendingRestore,
  pendingComplete,
  pendingAbsent,
  pendingPaid,
  onCancel,
  onSaveNotes,
  onRestore,
  onComplete,
  onAbsent,
  onMarkPaid,
}: Props) {
  const [notesDraft, setNotesDraft] = useState("");

  // 닫기 확인용 — 최신 메모 변경 여부를 핸들러 안에서 확인하기 위한 ref
  const notesDraftRef = useRef(notesDraft);
  const originalNotesRef = useRef<string>(lesson?.notes ?? "");
  useEffect(() => {
    notesDraftRef.current = notesDraft;
  }, [notesDraft]);

  useEffect(() => {
    if (lesson) {
      setNotesDraft(lesson.notes ?? "");
      originalNotesRef.current = lesson.notes ?? "";
    }
  }, [lesson]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (notesDraftRef.current.trim() !== originalNotesRef.current.trim()) {
        if (!window.confirm("저장하지 않은 메모 변경이 있어요. 닫을까요?")) return;
      }
      onClose();
    };
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

  // 상태 전이 액션 — CONFIRMED / IN_PROGRESS 상태에서만 가능
  const isInProgress = lesson.status === "CONFIRMED" || lesson.status === "IN_PROGRESS";
  const canComplete = isInProgress && !!onComplete;
  const canAbsent = isInProgress && !!onAbsent;
  // 메모 저장 중에도 상태 전이 액션 차단 — 둘이 동시에 들어가면 ordering 꼬임
  const anyPending =
    pendingCancel ||
    pendingNotes ||
    !!pendingRestore ||
    !!pendingComplete ||
    !!pendingAbsent ||
    !!pendingPaid;
  const notesChanged = notesDraft.trim() !== (lesson.notes ?? "").trim();
  const canMarkPaid = lesson.paymentStatus === "UNPAID" && !!onMarkPaid;
  const paymentLabel = (() => {
    switch (lesson.paymentStatus) {
      case "PAID": return { text: "결제 완료", bg: "bg-blue-50", fg: "text-blue-600" };
      case "UNPAID": return { text: "미결제", bg: "bg-red-50", fg: "text-red-500" };
      case "EXTERNAL": return { text: "외부결제", bg: "bg-sky-50", fg: "text-sky-600" };
      default: return null;
    }
  })();

  // 메모 변경 미저장 상태에서 시트 닫기 시 확인 (#39)
  const requestClose = () => {
    if (notesChanged) {
      const ok = window.confirm("저장하지 않은 메모 변경이 있어요. 닫을까요?");
      if (!ok) return;
    }
    onClose();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="courtside-backdrop-anim fixed inset-0 z-[10000]"
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(15, 23, 42, 0.4)" }}
        onClick={requestClose}
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
            onClick={requestClose}
            aria-label="닫기"
            className="absolute -top-1 right-0 w-9 h-9 rounded-full text-ink-3 hover:bg-soft transition flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
            {paymentLabel && (
              <span className={`flex-none rounded-full px-2 py-1 text-[10px] font-bold ${paymentLabel.bg} ${paymentLabel.fg}`}>
                {paymentLabel.text}
              </span>
            )}
          </div>
        </div>

        {/* 코치 코멘트 */}
        <div className="mt-4">
          <div className="text-xs font-semibold text-ink-2 mb-1.5">코치 메모</div>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder={isPast ? "이 레슨에 대한 코멘트를 남겨보세요 (자세, 진도, 다음 회차 등)" : "레슨 전 메모, 코칭 포인트 등"}
            rows={5}
            maxLength={1000}
            className="w-full rounded-xl border border-line bg-surface p-3 text-sm text-ink placeholder:text-ink-3 resize-none outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] text-ink-3">{notesDraft.length} / 1000</span>
            {notesChanged && (
              <button
                type="button"
                onClick={() => onSaveNotes(notesDraft)}
                disabled={anyPending}
                className="text-[11px] font-semibold text-primary px-3 py-1 rounded-md hover:bg-primary/10 disabled:opacity-60"
              >
                {pendingNotes ? "저장 중…" : "메모 저장"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {/* 결제확인 — paymentStatus UNPAID 일 때 */}
          {canMarkPaid && (
            <button
              type="button"
              onClick={onMarkPaid}
              disabled={anyPending}
              className="w-full h-12 rounded-xl bg-sky-50 text-sky-700 text-sm font-semibold hover:bg-sky-100 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {pendingPaid && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                </svg>
              )}
              {pendingPaid ? "처리 중…" : "결제 확인"}
            </button>
          )}

          {/* 상태 전이 — 완료/결강 (CONFIRMED/IN_PROGRESS 한정) */}
          {(canComplete || canAbsent) && (
            <div className="grid grid-cols-2 gap-2">
              {canComplete && (
                <button
                  type="button"
                  onClick={onComplete}
                  disabled={anyPending}
                  className="h-12 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {pendingComplete && (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                    </svg>
                  )}
                  {pendingComplete ? "처리 중…" : "레슨 완료"}
                </button>
              )}
              {canAbsent && (
                <button
                  type="button"
                  onClick={onAbsent}
                  disabled={anyPending}
                  className="h-12 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {pendingAbsent && (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                    </svg>
                  )}
                  {pendingAbsent ? "처리 중…" : "결강 처리"}
                </button>
              )}
            </div>
          )}

          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={anyPending}
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

          {/* 과거 레슨 — 취소 불가 이유 안내 (#18) */}
          {!isCancelled && isPast && (
            <button
              type="button"
              disabled
              title="지난 레슨은 취소할 수 없어요"
              className="w-full h-12 rounded-xl bg-soft text-ink-3 text-sm font-semibold cursor-not-allowed inline-flex items-center justify-center"
            >
              지난 레슨 — 취소 불가
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

          <Link
            href={`/coach/lessons/${lesson.id}`}
            prefetch={false}
            onClick={onClose}
            className="w-full h-12 rounded-xl bg-ink text-white text-sm font-semibold hover:opacity-90 transition inline-flex items-center justify-center gap-1"
          >
            상태 처리·전체 상세
            <span aria-hidden>›</span>
          </Link>

          <button
            type="button"
            onClick={requestClose}
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
