"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AlertModal, type AlertVariant } from "@/components/alert-modal";
import {
  completeLesson,
  markLessonAbsent,
  requestMakeup,
  cancelLessonWithReason,
  saveLessonNotes,
} from "@/app/actions/lessons";
import {
  ageGroupLabel,
  deriveDisplayStatus as deriveStatus,
  formatDateLabel,
  formatTimeRange,
  formatTimeShort,
  genderLabel,
  lessonFormatLabel,
} from "@/lib/lesson-time";

export type LessonDetailData = {
  lesson: {
    id: number;
    coachId: string;
    studentId: string;
    scheduledAt: string;
    durationMinutes: number;
    status: string;
    paymentStatus: string;
    lessonFormat: string;
    roundNumber: number | null;
    totalRounds: number | null;
    originalScheduledAt: string | null;
    splitIndex: number | null;
    splitTotal: number | null;
    notes: string | null;
  };
  viewerRole: "COACH" | "STUDENT";
  counterpart: { id: string; name: string; phone: string | null } | null;
  studentProfile: { gender: string | null; ageGroup: string | null; ntrpLevel: string | null } | null;
  coachProfile: {
    areaSido: string | null;
    areaSigungu: string | null;
    ntrpMin: number | null;
    ntrpMax: number | null;
  } | null;
};

type DisplayStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ABSENT"
  | "CANCELLED"
  | "RESCHEDULE_REQUESTED"
  | "RESCHEDULE_COMPLETED"
  | "MAKEUP_PENDING"
  | "MAKEUP_CONFIRMED"
  | "MAKEUP_REQUESTED"
  | "MERGE"
  | "SPLIT";

const STATUS_BADGE: Record<DisplayStatus, { label: string; bg: string; fg: string }> = {
  PENDING: { label: "대기 중", bg: "bg-amber-50", fg: "text-amber-600" },
  CONFIRMED: { label: "레슨 예정", bg: "bg-accent-purple-soft", fg: "text-accent-purple" },
  IN_PROGRESS: { label: "진행 중", bg: "bg-accent-coral-soft", fg: "text-accent-coral" },
  COMPLETED: { label: "완료", bg: "bg-blue-50", fg: "text-blue-600" },
  ABSENT: { label: "결강", bg: "bg-soft", fg: "text-ink-3" },
  CANCELLED: { label: "취소됨", bg: "bg-soft", fg: "text-ink-3" },
  RESCHEDULE_REQUESTED: { label: "변경 요청", bg: "bg-orange-50", fg: "text-orange-600" },
  RESCHEDULE_COMPLETED: { label: "변경 완료", bg: "bg-blue-50", fg: "text-blue-600" },
  MAKEUP_PENDING: { label: "보강 일정 선택중", bg: "bg-amber-50", fg: "text-amber-600" },
  MAKEUP_CONFIRMED: { label: "보강 확정", bg: "bg-accent-purple-soft", fg: "text-accent-purple" },
  MAKEUP_REQUESTED: { label: "보강 요청", bg: "bg-amber-50", fg: "text-amber-600" },
  MERGE: { label: "통합 회차", bg: "bg-accent-purple-soft", fg: "text-accent-purple" },
  SPLIT: { label: "분할 회차", bg: "bg-accent-purple-soft", fg: "text-accent-purple" },
};

function paymentBadge(status: string, lessonStatus: string): {
  text: string;
  bg: string;
  fg: string;
} {
  // 보강/통합/분할 회차의 NONE 은 정상 — "결제 무관" 으로 표시
  const isAuxiliary = ["MAKEUP_REQUESTED", "MAKEUP_PENDING", "MAKEUP_CONFIRMED", "MERGE", "SPLIT"].includes(
    lessonStatus,
  );
  switch (status) {
    case "PAID":
      return { text: "결제완료", bg: "bg-primary-50", fg: "text-primary-700" };
    case "UNPAID":
      return { text: "미결제", bg: "bg-red-50", fg: "text-red-600" };
    case "EXTERNAL":
      return { text: "외부 결제", bg: "bg-soft", fg: "text-ink-2" };
    case "NONE":
    default:
      return {
        text: isAuxiliary ? "결제 무관" : "정보 없음",
        bg: "bg-soft",
        fg: "text-ink-3",
      };
  }
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/** "{name} 코치" 중복 방지 — 이미 "코치"로 끝나면 그대로 */
function coachDisplayName(name: string): string {
  if (/코치\s*$/.test(name)) return name;
  return `${name} 코치`;
}

export function LessonDetailScreen({ data, backHref }: { data: LessonDetailData; backHref: string }) {
  const router = useRouter();
  const { lesson, viewerRole, counterpart, studentProfile, coachProfile } = data;
  const isCoach = viewerRole === "COACH";

  // hydration-safe — 실제 표시 상태는 mount 후에 client 시각으로 계산
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const t = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  // SSR/첫 paint 에서는 DB status 그대로 (IN_PROGRESS 도출 X) — hydration mismatch 방지
  const displayStatus = (
    nowMs == null ? lesson.status : deriveStatus(lesson.status, lesson.scheduledAt, lesson.durationMinutes, nowMs)
  ) as DisplayStatus;
  const badge = STATUS_BADGE[displayStatus] ?? STATUS_BADGE.CONFIRMED;
  const payment = paymentBadge(lesson.paymentStatus, lesson.status);

  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [reasonSheet, setReasonSheet] = useState<null | "ABSENT" | "MAKEUP" | "CANCEL">(null);
  const [reasonText, setReasonText] = useState("");
  const [notesDraft, setNotesDraft] = useState(lesson.notes ?? "");
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);
  const [alert, setAlert] = useState<{
    open: boolean;
    variant: AlertVariant;
    title: string;
    description?: string;
  }>({ open: false, variant: "success", title: "" });

  useEffect(() => setNotesDraft(lesson.notes ?? ""), [lesson.notes]);

  const notesChanged = notesDraft.trim() !== (lesson.notes ?? "").trim();

  const onComplete = () => {
    setStatusSheetOpen(false);
    setPending(true);
    startTransition(async () => {
      const res = await completeLesson(lesson.id);
      setPending(false);
      if (!res.ok) {
        setAlert({ open: true, variant: "error", title: "처리 실패", description: res.error });
        return;
      }
      setAlert({ open: true, variant: "success", title: "레슨이 완료 처리되었어요" });
      router.refresh();
    });
  };

  const openReasonSheet = (kind: "ABSENT" | "MAKEUP" | "CANCEL") => {
    setStatusSheetOpen(false);
    setReasonText("");
    setReasonSheet(kind);
  };

  const submitReason = () => {
    if (!reasonSheet) return;
    const kind = reasonSheet;
    setPending(true);
    startTransition(async () => {
      const fn =
        kind === "ABSENT"
          ? markLessonAbsent
          : kind === "MAKEUP"
            ? requestMakeup
            : cancelLessonWithReason;
      const res = await fn(lesson.id, reasonText);
      setPending(false);
      if (!res.ok) {
        setAlert({ open: true, variant: "error", title: "처리 실패", description: res.error });
        return;
      }
      setReasonSheet(null);
      setAlert({
        open: true,
        variant: "success",
        title:
          kind === "ABSENT"
            ? "결강 처리되었어요"
            : kind === "MAKEUP"
              ? "보강 요청을 등록했어요"
              : "레슨이 취소되었어요",
      });
      router.refresh();
    });
  };

  const onSaveNotes = () => {
    setPending(true);
    startTransition(async () => {
      const res = await saveLessonNotes(lesson.id, notesDraft);
      setPending(false);
      if (!res.ok) {
        setAlert({ open: true, variant: "error", title: "메모 저장 실패", description: res.error });
        return;
      }
      setAlert({ open: true, variant: "success", title: "메모가 저장되었어요" });
      router.refresh();
    });
  };

  const onContactCounterpart = () => {
    setAlert({
      open: true,
      variant: "info",
      title: "준비 중이에요",
      description: "1:1 대화 기능은 다음 업데이트에 추가됩니다.",
    });
  };

  const handleBack = () => {
    // 가능하면 history 뒤로, 없으면 backHref 로 fallback
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(backHref);
  };

  const counterpartName = counterpart?.name ?? "이름 미입력";
  const counterpartInitial = counterpartName.slice(0, 1) || "?";
  const headerName = isCoach ? counterpartName : coachDisplayName(counterpartName);
  const formatText = lessonFormatLabel(lesson.lessonFormat);

  // 학생 셀프 취소 — mount 후에만 활성화 (hydration mismatch 방지)
  const canStudentCancel =
    viewerRole === "STUDENT" &&
    nowMs != null &&
    !["CANCELLED", "COMPLETED", "ABSENT", "RESCHEDULE_COMPLETED"].includes(lesson.status) &&
    new Date(lesson.scheduledAt).getTime() - nowMs >= 24 * 60 * 60 * 1000;

  return (
    <main className="min-h-screen bg-bg flex flex-col">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        {/* 상단 바 */}
        <div className="flex items-center h-14 px-3 sticky top-0 z-10 bg-bg/85 backdrop-blur border-b border-line">
          <button
            type="button"
            onClick={handleBack}
            aria-label="뒤로가기"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-soft transition text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex-1 text-center text-sm font-bold text-ink">레슨 상세</div>
          <div className="w-10 h-10" />
        </div>

        <div className="flex-1 px-5 py-4 pb-32">
          {/* 헤더 — 날짜/시간 + 상태 배지 */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg font-extrabold text-ink leading-tight">
                {formatDateLabel(lesson.scheduledAt)}
              </div>
              <div className="mt-1 text-sm text-ink-2">
                {formatTimeRange(lesson.scheduledAt, lesson.durationMinutes)}
              </div>
              {lesson.originalScheduledAt && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-soft px-2 py-0.5 text-[11px] text-ink-3">
                  <span>변경 전</span>
                  <span className="line-through">
                    {formatDateLabel(lesson.originalScheduledAt)} {formatTimeShort(lesson.originalScheduledAt)}
                  </span>
                </div>
              )}
            </div>
            <span className={`flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${badge.bg} ${badge.fg}`}>
              {badge.label}
            </span>
          </div>

          {/* 상대방 프로필 */}
          <div className="mt-4 rounded-2xl border border-line bg-surface p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary/15 text-primary-700 flex items-center justify-center font-bold text-base flex-none">
              {counterpartInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-ink truncate">{headerName}</div>
              <div className="mt-0.5 text-xs text-ink-3 truncate">
                {isCoach && studentProfile ? (
                  [
                    ageGroupLabel(studentProfile.ageGroup),
                    genderLabel(studentProfile.gender),
                    studentProfile.ntrpLevel ? `NTRP ${studentProfile.ntrpLevel}` : null,
                  ].filter(Boolean).join(" · ") || "프로필 미입력"
                ) : !isCoach && coachProfile ? (
                  [
                    [coachProfile.areaSido, coachProfile.areaSigungu].filter(Boolean).join(" "),
                    coachProfile.ntrpMin != null && coachProfile.ntrpMax != null
                      ? `지도 NTRP ${coachProfile.ntrpMin} ~ ${coachProfile.ntrpMax}`
                      : null,
                  ].filter(Boolean).join(" · ") || "프로필 정보 없음"
                ) : (
                  "프로필 정보 없음"
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onContactCounterpart}
              className="flex-none text-xs font-semibold text-ink-2 px-3 py-1.5 rounded-lg border border-line bg-surface hover:bg-soft transition active:scale-[0.97]"
            >
              대화하기
            </button>
          </div>

          {/* 레슨 정보 표 */}
          <div className="mt-4 rounded-2xl border border-line bg-surface px-4">
            {(() => {
              const rows: Array<{ k: string; v: React.ReactNode }> = [
                { k: "레슨 형태", v: formatText },
                { k: "레슨 시간", v: `${lesson.durationMinutes}분 (회당)` },
              ];
              if (lesson.roundNumber != null && lesson.totalRounds != null) {
                rows.push({
                  k: "현재 회차",
                  v: `${lesson.roundNumber} / ${lesson.totalRounds}회`,
                });
              }
              if (lesson.splitIndex != null && lesson.splitTotal != null) {
                rows.push({ k: "분할", v: `${lesson.splitIndex} / ${lesson.splitTotal}회` });
              }
              rows.push({
                k: "결제",
                v: (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${payment.bg} ${payment.fg}`}
                  >
                    {payment.text}
                  </span>
                ),
              });
              return rows.map((r, i) => (
                <InfoRow key={r.k} k={r.k} v={r.v} last={i === rows.length - 1} />
              ));
            })()}
          </div>

          {/* 결제일/변경 카운트 — 백엔드 스키마 미구현 (TODO Sprint 2) */}
          {/* TODO(FR-06,12b): paymentSchedule 컬럼 추가 후 최근/다음 결제일, 이번 달 변경 카운트 표시 */}

          {/* 메모 / 코치 코멘트 */}
          {isCoach ? (
            <div className="mt-4">
              <div className="text-xs font-semibold text-ink-2 mb-1.5">코치 메모</div>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="레슨 메모, 코칭 포인트, 다음 회차 계획 등을 기록하세요"
                rows={4}
                maxLength={1000}
                className="w-full rounded-xl border border-line bg-surface p-3 text-sm text-ink placeholder:text-ink-3 resize-none outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[11px] text-ink-3">{notesDraft.length} / 1000</span>
                {notesChanged && (
                  <button
                    type="button"
                    onClick={onSaveNotes}
                    disabled={pending}
                    className="text-xs font-semibold text-primary-700 px-3 py-1 rounded-md hover:bg-primary/10 disabled:opacity-60"
                  >
                    {pending ? "저장 중…" : "메모 저장"}
                  </button>
                )}
              </div>
            </div>
          ) : lesson.notes ? (
            <div className="mt-4">
              <div className="text-xs font-semibold text-ink-2 mb-1.5">코치 메모</div>
              <div className="rounded-xl border border-line bg-soft p-3 text-sm text-ink-2 whitespace-pre-wrap leading-relaxed">
                {lesson.notes}
              </div>
            </div>
          ) : null}

          {/* 학생 안내 — 24h 정책 (취소 불가 시) */}
          {!isCoach && nowMs != null && !canStudentCancel && !["CANCELLED", "COMPLETED", "ABSENT", "RESCHEDULE_COMPLETED"].includes(lesson.status) && (
            <div className="mt-4 rounded-xl bg-soft px-3.5 py-3 text-xs text-ink-3 leading-relaxed">
              레슨 24시간 전부터는 셀프 취소가 불가합니다. 변경/취소가 필요하면 코치에게 문의해주세요.
            </div>
          )}
        </div>

        {/* 하단 액션 영역 */}
        <div className="sticky bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-line px-5 py-4 flex gap-2 max-w-md mx-auto w-full">
          {isCoach ? (
            <CoachActions
              status={displayStatus}
              onComplete={onComplete}
              onOpenStatusSheet={() => setStatusSheetOpen(true)}
              onOpenCancel={() => openReasonSheet("CANCEL")}
              onOpenMakeup={() => openReasonSheet("MAKEUP")}
              onClose={handleBack}
              pending={pending}
            />
          ) : (
            <StudentActions
              canCancel={canStudentCancel}
              onCancel={() => openReasonSheet("CANCEL")}
              onClose={handleBack}
              pending={pending}
            />
          )}
        </div>
      </div>

      {/* 상태 처리 바텀시트 (코치 전용) */}
      {statusSheetOpen && (
        <BottomSheet onClose={() => setStatusSheetOpen(false)} title="상태 처리하기">
          <SheetItem label="레슨 완료 처리" onClick={onComplete} icon={<CheckIcon />} />
          <SheetItem label="보강 처리" onClick={() => openReasonSheet("MAKEUP")} icon={<RefreshIcon />} />
          <SheetItem label="결강 처리" onClick={() => openReasonSheet("ABSENT")} icon={<XIcon />} />
          <SheetItem label="레슨 취소" onClick={() => openReasonSheet("CANCEL")} icon={<TrashIcon />} danger />
        </BottomSheet>
      )}

      {/* 사유 입력 바텀시트 */}
      {reasonSheet && (
        <BottomSheet
          onClose={() => setReasonSheet(null)}
          title={
            reasonSheet === "ABSENT"
              ? "결강 사유"
              : reasonSheet === "MAKEUP"
                ? "보강 요청 사유"
                : "취소 사유"
          }
        >
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder={
              reasonSheet === "ABSENT"
                ? "예: 학생 무단 불참, 코치 사정 등 (필수)"
                : reasonSheet === "MAKEUP"
                  ? "예: 우천, 학생 사정 등 보강이 필요한 사유 (필수)"
                  : "취소 사유를 입력해주세요 (필수)"
            }
            rows={4}
            maxLength={500}
            className="w-full rounded-xl border border-line bg-surface p-3 text-sm text-ink placeholder:text-ink-3 resize-none outline-none focus:ring-2 focus:ring-primary/40"
            autoFocus
          />
          <div className="mt-1 text-right text-[11px] text-ink-3">{reasonText.length} / 500</div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setReasonSheet(null)}
              className="flex-1 h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition"
            >
              이전
            </button>
            <button
              type="button"
              onClick={submitReason}
              disabled={pending || !reasonText.trim()}
              className="flex-1 h-12 rounded-xl bg-ink text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {pending ? "처리 중…" : "확인"}
            </button>
          </div>
        </BottomSheet>
      )}

      <AlertModal
        open={alert.open}
        onClose={() => setAlert((a) => ({ ...a, open: false }))}
        variant={alert.variant}
        title={alert.title}
        description={alert.description}
      />
    </main>
  );
}

function InfoRow({ k, v, last }: { k: string; v: React.ReactNode; last?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between py-3 ${last ? "" : "border-b border-line/70"}`}
    >
      <span className="text-xs font-medium text-ink-3">{k}</span>
      <span className="text-sm font-semibold text-ink">{v}</span>
    </div>
  );
}

function CoachActions({
  status,
  onComplete,
  onOpenStatusSheet,
  onOpenCancel,
  onOpenMakeup,
  onClose,
  pending,
}: {
  status: DisplayStatus;
  onComplete: () => void;
  onOpenStatusSheet: () => void;
  onOpenCancel: () => void;
  onOpenMakeup: () => void;
  onClose: () => void;
  pending: boolean;
}) {
  if (status === "IN_PROGRESS") {
    return (
      <button
        type="button"
        onClick={onComplete}
        disabled={pending}
        className="flex-1 h-12 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-500 transition disabled:opacity-60"
      >
        {pending ? "처리 중…" : "레슨 완료 처리"}
      </button>
    );
  }
  if (status === "CONFIRMED" || status === "MAKEUP_CONFIRMED") {
    return (
      <button
        type="button"
        onClick={onOpenStatusSheet}
        disabled={pending}
        className="flex-1 h-12 rounded-xl bg-ink text-white text-sm font-bold hover:opacity-90 transition disabled:opacity-60"
      >
        상태 처리하기
      </button>
    );
  }
  if (status === "ABSENT") {
    return (
      <>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition"
        >
          닫기
        </button>
        <button
          type="button"
          onClick={onOpenMakeup}
          disabled={pending}
          className="flex-1 h-12 rounded-xl bg-ink text-white text-sm font-bold hover:opacity-90 transition disabled:opacity-60"
        >
          보강 요청
        </button>
      </>
    );
  }
  if (status === "PENDING") {
    // PENDING은 학생 신청 대기 — "취소"가 아닌 "거절"로 표현 + 확정 액션은 다음 PR
    return (
      <>
        <button
          type="button"
          onClick={onOpenCancel}
          disabled={pending}
          className="flex-1 h-12 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-500 hover:bg-red-100 transition disabled:opacity-60"
        >
          거절
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-12 rounded-xl bg-ink text-white text-sm font-bold hover:opacity-90 transition"
        >
          닫기
        </button>
      </>
    );
  }
  if (status === "RESCHEDULE_REQUESTED" || status === "MAKEUP_REQUESTED" || status === "MAKEUP_PENDING") {
    return (
      <>
        <button
          type="button"
          onClick={onOpenCancel}
          disabled={pending}
          className="flex-1 h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition disabled:opacity-60"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-12 rounded-xl bg-ink text-white text-sm font-bold hover:opacity-90 transition"
        >
          닫기
        </button>
      </>
    );
  }
  // COMPLETED / CANCELLED / RESCHEDULE_COMPLETED / MERGE / SPLIT — 종료 또는 정보 표시
  return (
    <button
      type="button"
      onClick={onClose}
      className="flex-1 h-12 rounded-xl bg-ink text-white text-sm font-bold hover:opacity-90 transition"
    >
      닫기
    </button>
  );
}

function StudentActions({
  canCancel,
  onCancel,
  onClose,
  pending,
}: {
  canCancel: boolean;
  onCancel: () => void;
  onClose: () => void;
  pending: boolean;
}) {
  if (canCancel) {
    return (
      <>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="flex-1 h-12 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-500 hover:bg-red-100 transition disabled:opacity-60"
        >
          레슨 취소
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-12 rounded-xl bg-ink text-white text-sm font-bold hover:opacity-90 transition"
        >
          닫기
        </button>
      </>
    );
  }
  return (
    <button
      type="button"
      onClick={onClose}
      className="flex-1 h-12 rounded-xl bg-ink text-white text-sm font-bold hover:opacity-90 transition"
    >
      닫기
    </button>
  );
}

function BottomSheet({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[10000]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        className="absolute left-0 right-0 bottom-0 bg-surface rounded-t-3xl px-5 pt-3 pb-6 shadow-2xl max-w-md mx-auto"
        style={{ animation: "courtside-sheet-up 0.25s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-line mx-auto mb-4" />
        <div className="text-sm font-bold text-ink mb-3">{title}</div>
        {children}
      </div>
    </div>
  );
}

function SheetItem({
  label,
  onClick,
  icon,
  danger,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 py-3.5 px-2 rounded-lg hover:bg-soft transition text-left ${
        danger ? "text-red-500" : "text-ink"
      }`}
    >
      <span
        className={`w-8 h-8 rounded-full flex items-center justify-center ${danger ? "bg-red-50 text-red-500" : "bg-soft text-ink-2"}`}
      >
        {icon}
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}
