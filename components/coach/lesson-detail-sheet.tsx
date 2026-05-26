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

const STATUS_DESCRIPTIONS: Record<string, string> = {
  PENDING: "수강생이 신청한 레슨이에요. 수락하거나 거절해주세요.",
  CONFIRMED: "예정된 레슨이에요. 시간에 맞춰 진행해 주세요.",
  IN_PROGRESS: "지금 진행 중인 레슨이에요.",
  COMPLETED: "완료 처리된 레슨이에요.",
  ABSENT: "결강 처리된 레슨이에요.",
  CANCELLED: "취소된 레슨이에요.",
  RESCHEDULE_REQUESTED: "변경 요청이 진행 중이에요.",
  RESCHEDULE_COMPLETED: "변경 처리가 완료된 레슨이에요.",
  MAKEUP_PENDING: "보강 일정을 수강생이 선택하고 있어요.",
  MAKEUP_CONFIRMED: "보강 일정이 확정된 레슨이에요.",
  MAKEUP_REQUESTED: "수강생이 보강을 요청했어요.",
  MERGE: "다른 회차와 통합된 레슨이에요.",
  SPLIT: "회차가 분할된 레슨이에요.",
};

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
  // 2단계 — detail(기본) / actions(상태 처리)
  const [view, setView] = useState<"detail" | "actions">("detail");

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
      // 새 레슨 열 때마다 detail 단계로 리셋
      setView("detail");
    }
  }, [lesson?.id]);

  useEffect(() => {
    if (open) setView("detail");
  }, [open]);

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
  const statusDesc = STATUS_DESCRIPTIONS[displayStatus] ?? "";
  const isCancelled = lesson.status === "CANCELLED";

  // 지난 레슨 (시작 시각이 현재보다 이전) — 취소 비표시
  const isPast = parseIsoUtc(lesson.scheduledAt).getTime() < Date.now();
  const canCancel = !isCancelled && !isPast;
  const canRestore = isCancelled && !isPast && !!onRestore;

  // 상태 전이 액션 — CONFIRMED / IN_PROGRESS 상태에서만 가능
  const isActive = lesson.status === "CONFIRMED" || lesson.status === "IN_PROGRESS";
  const canComplete = isActive && !!onComplete;
  const canAbsent = isActive && !!onAbsent;
  const canMarkPaid = lesson.paymentStatus === "UNPAID" && !!onMarkPaid;

  const hasAnyAction = canComplete || canAbsent || canMarkPaid || canCancel || canRestore;

  const anyPending =
    pendingCancel ||
    pendingNotes ||
    !!pendingRestore ||
    !!pendingComplete ||
    !!pendingAbsent ||
    !!pendingPaid;
  const notesChanged = notesDraft.trim() !== (lesson.notes ?? "").trim();

  const paymentLabel = (() => {
    switch (lesson.paymentStatus) {
      case "PAID": return { text: "결제 완료", bg: "bg-emerald-50", fg: "text-emerald-600" };
      case "UNPAID": return { text: "미결제", bg: "bg-red-50", fg: "text-red-500" };
      case "EXTERNAL": return { text: "외부결제", bg: "bg-sky-50", fg: "text-sky-600" };
      default: return null;
    }
  })();

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
        className="absolute left-0 right-0 bottom-0 bg-surface rounded-t-3xl px-5 pt-3 pb-6 shadow-2xl max-h-[90vh] flex flex-col"
        style={{ animation: "courtside-sheet-up 0.25s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 — 드래그 핸들 + 닫기 */}
        <div className="relative flex-none">
          <div className="w-10 h-1 rounded-full bg-line mx-auto mb-3" />
          <div className="flex items-center justify-between">
            {view === "actions" ? (
              <button
                type="button"
                onClick={() => setView("detail")}
                aria-label="뒤로"
                className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink rounded-md px-2 py-1 -ml-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                뒤로
              </button>
            ) : (
              <span aria-hidden />
            )}
            <button
              type="button"
              onClick={requestClose}
              aria-label="닫기"
              className="w-9 h-9 rounded-full text-ink-3 hover:bg-soft transition flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* 본문 — 스크롤 가능 영역 */}
        <div className="flex-1 overflow-y-auto -mx-5 px-5">
          {/* 일자·시간 */}
          <div className="mt-2">
            <div className="text-base font-extrabold text-ink">{dateLabel}</div>
            <div className="mt-0.5 text-sm text-ink-2">{timeLabel}</div>
          </div>

          {/* 상태 — 본문에 명확히 노출 */}
          <div className={`mt-4 rounded-xl border border-line ${status.bg} p-4`}>
            <div className="text-[11px] font-semibold text-ink-3">현재 상태</div>
            <div className={`mt-1 text-lg font-extrabold ${status.fg}`}>
              {status.text}
            </div>
            {statusDesc && (
              <p className="mt-1 text-xs text-ink-2 leading-relaxed">{statusDesc}</p>
            )}
          </div>

          {/* 학생 카드 */}
          <div className="mt-4 p-4 rounded-xl border border-line bg-surface">
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

          {view === "detail" && (
            <>
              {/* 코치 메모 */}
              <div className="mt-4">
                <div className="text-xs font-semibold text-ink-2 mb-1.5">코치 메모</div>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder={isPast ? "이 레슨에 대한 코멘트를 남겨보세요 (자세, 진도, 다음 회차 등)" : "레슨 전 메모, 코칭 포인트 등"}
                  rows={4}
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
            </>
          )}

          {view === "actions" && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-ink-2 mb-2">가능한 작업</div>

              {!hasAnyAction ? (
                <div className="rounded-xl border border-line bg-soft p-5 text-center">
                  <p className="text-sm text-ink-2">현재 상태에서 가능한 작업이 없어요</p>
                  <p className="mt-1 text-[11px] text-ink-3">상태가 바뀌면 이곳에서 처리할 수 있어요</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {canComplete && (
                    <ActionButton
                      onClick={onComplete!}
                      disabled={anyPending}
                      pending={!!pendingComplete}
                      label="레슨 완료 처리"
                      sub="레슨이 정상적으로 끝났어요"
                      tone="primary"
                    />
                  )}
                  {canAbsent && (
                    <ActionButton
                      onClick={onAbsent!}
                      disabled={anyPending}
                      pending={!!pendingAbsent}
                      label="결강 처리"
                      sub="수강생이 오지 않았어요"
                      tone="neutral"
                    />
                  )}
                  {canMarkPaid && (
                    <ActionButton
                      onClick={onMarkPaid!}
                      disabled={anyPending}
                      pending={!!pendingPaid}
                      label="결제 확인"
                      sub="결제를 받았어요 — 결제 완료로 처리"
                      tone="info"
                    />
                  )}
                  {canCancel && (
                    <ActionButton
                      onClick={onCancel}
                      disabled={anyPending}
                      pending={pendingCancel}
                      label="레슨 취소"
                      sub="예정된 이 레슨을 취소해요"
                      tone="danger"
                    />
                  )}
                  {canRestore && (
                    <ActionButton
                      onClick={onRestore!}
                      disabled={anyPending}
                      pending={!!pendingRestore}
                      label="취소된 레슨 복구"
                      sub="이 레슨을 다시 예정 상태로 되돌려요"
                      tone="primary"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 하단 CTA */}
        <div className="flex-none pt-3 space-y-2">
          {view === "detail" ? (
            <>
              {hasAnyAction && (
                <button
                  type="button"
                  onClick={() => setView("actions")}
                  className="w-full h-12 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition active:scale-[0.99] inline-flex items-center justify-center gap-1"
                >
                  상태 처리하기
                  <span aria-hidden>›</span>
                </button>
              )}
              <div className="flex gap-2">
                <Link
                  href={`/coach/lessons/${lesson.id}`}
                  prefetch={false}
                  onClick={onClose}
                  className="flex-1 h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition inline-flex items-center justify-center"
                >
                  전체 상세
                </Link>
                <button
                  type="button"
                  onClick={requestClose}
                  className="flex-1 h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition"
                >
                  닫기
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setView("detail")}
              className="w-full h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition"
            >
              뒤로
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ActionButton({
  onClick,
  disabled,
  pending,
  label,
  sub,
  tone,
}: {
  onClick: () => void;
  disabled: boolean;
  pending: boolean;
  label: string;
  sub: string;
  tone: "primary" | "neutral" | "info" | "danger";
}) {
  const styles = {
    primary: "border-primary/30 hover:bg-primary/5 text-primary-600",
    neutral: "border-line hover:bg-soft text-ink-2",
    info: "border-sky-200 hover:bg-sky-50 text-sky-600",
    danger: "border-red-200 hover:bg-red-50 text-red-500",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left rounded-xl border-[1.5px] bg-surface px-4 py-3 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed ${styles}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{pending ? "처리 중…" : label}</div>
          <div className="mt-0.5 text-[11px] text-ink-3">{sub}</div>
        </div>
        {pending ? (
          <svg className="animate-spin h-4 w-4 flex-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
          </svg>
        ) : (
          <span aria-hidden className="text-base flex-none opacity-70">›</span>
        )}
      </div>
    </button>
  );
}
