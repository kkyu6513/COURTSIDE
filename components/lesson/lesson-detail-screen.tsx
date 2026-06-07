"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AlertModal, type AlertVariant } from "@/components/alert-modal";
import { BottomNav } from "@/components/bottom-nav";
import { Toast } from "@/components/toast";
import { MakeupWizard } from "@/components/lesson/makeup-wizard";
import {
  completeLesson,
  markLessonAbsent,
  cancelLessonWithReason,
  saveLessonNotes,
  confirmPendingLesson,
  markLessonPaid,
  revertLessonStatus,
  unmarkLessonPaid,
} from "@/app/actions/lessons";
import { parseIsoUtc, toKstTrick } from "@/lib/kst";
import {
  deriveDisplayStatus,
  getStatusLabel,
  type LessonStatus,
} from "@/lib/lesson-status";

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
  /** 코치 뷰 전용 — 학생의 정규 패턴 + 해당 월 결강/보강 통계 */
  studentInsights?: {
    /** 정기 패턴 (요일·시간·길이) — 최근 active 회차 mode 기반. 데이터 부족하면 null */
    recurringPattern: {
      dayOfWeek: number; // 0=일 ~ 6=토 (KST)
      hour: number;      // KST 시간 0-23
      minute: number;    // KST 분 0-59
      durationMinutes: number;
      sampleCount: number;
    } | null;
    /** 해당 월(현재 레슨이 속한 달, KST) 결강 횟수 */
    monthlyAbsentCount: number;
    /** 해당 월 보강 회차 횟수 (MAKEUP_* 상태 또는 originalLessonId 있음) */
    monthlyMakeupCount: number;
    /** 통계 기준 월 라벨 (예: "5월") */
    monthLabel: string;
  } | null;
};

const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];

function kstParts(d: Date) {
  const k = toKstTrick(d);
  return {
    m: k.getUTCMonth() + 1,
    day: k.getUTCDate(),
    dow: k.getUTCDay(),
    hh: String(k.getUTCHours()).padStart(2, "0"),
    mm: String(k.getUTCMinutes()).padStart(2, "0"),
  };
}

function formatDateLabel(iso: string) {
  const p = kstParts(parseIsoUtc(iso));
  return `${p.m}월 ${p.day}일 (${DOW_KOR[p.dow]})`;
}

function formatTimeRange(iso: string, durationMinutes: number) {
  const start = parseIsoUtc(iso);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const s = kstParts(start);
  const e = kstParts(end);
  return `${s.hh}:${s.mm} ~ ${e.hh}:${e.mm}`;
}

function formatTimeShort(iso: string) {
  const p = kstParts(parseIsoUtc(iso));
  return `${p.hh}:${p.mm}`;
}

function paymentBadge(status: string, lessonStatus: string): {
  text: string;
  bg: string;
  fg: string;
} {
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
        text: isAuxiliary ? "해당 없음" : "정보 없음",
        bg: "bg-soft",
        fg: "text-ink-3",
      };
  }
}

function lessonFormatLabel(f: string): string {
  return f === "GROUP" ? "그룹" : "1:1 개인";
}

function ageGroupLabel(v: string | null): string | null {
  if (!v) return null;
  const map: Record<string, string> = {
    TEENS: "10대",
    TWENTIES: "20대",
    THIRTIES: "30대",
    FORTIES: "40대",
    FIFTIES_PLUS: "50대+",
  };
  return map[v] ?? null;
}

function genderLabel(v: string | null): string | null {
  if (!v) return null;
  if (v === "MALE") return "남";
  if (v === "FEMALE") return "여";
  return null;
}

function coachDisplayName(name: string): string {
  if (/코치\s*$/.test(name)) return name;
  return `${name} 코치`;
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

function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 14 4 9 9 4" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

type ConfirmAction =
  | { kind: "COMPLETE" }
  | { kind: "CONFIRM_PENDING" }
  | { kind: "MARK_PAID" }
  | { kind: "MAKEUP_FOLLOWUP" } // ABSENT 후 보강 안내
  | { kind: "DIRTY_NAV"; proceed: () => void }; // 메모 미저장 + 이탈

export function LessonDetailScreen({ data, backHref }: { data: LessonDetailData; backHref: string }) {
  const router = useRouter();
  const { viewerRole, counterpart, studentProfile, coachProfile, studentInsights } = data;
  const isCoach = viewerRole === "COACH";

  // 낙관적 업데이트용 로컬 상태 — SSR refresh 도착 전에도 즉시 화면 반영
  const [lesson, setLesson] = useState(data.lesson);
  useEffect(() => setLesson(data.lesson), [data.lesson]);

  // hydration-safe — 실 시각은 mount 후에만 사용
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const t = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const displayStatus = (
    nowMs == null
      ? lesson.status
      : deriveDisplayStatus(lesson.status, lesson.scheduledAt, lesson.durationMinutes, nowMs)
  ) as LessonStatus | string;
  const badge = getStatusLabel(displayStatus);
  const payment = paymentBadge(lesson.paymentStatus, lesson.status);

  // 지난 레슨 — 시작 시각이 현재보다 이전 + 아직 활성 상태
  const isPast =
    nowMs != null &&
    new Date(lesson.scheduledAt).getTime() < nowMs &&
    !["COMPLETED", "CANCELLED", "ABSENT", "RESCHEDULE_COMPLETED"].includes(lesson.status);

  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  // ABSENT/CANCEL은 사유 텍스트 단일 입력 시트, MAKEUP은 별도 위저드(MakeupWizard)
  const [reasonSheet, setReasonSheet] = useState<null | "ABSENT" | "CANCEL">(null);
  const [reasonText, setReasonText] = useState("");
  const [makeupOpen, setMakeupOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(lesson.notes ?? "");
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [alert, setAlert] = useState<{
    open: boolean;
    variant: AlertVariant;
    title: string;
    description?: string;
  }>({ open: false, variant: "success", title: "" });
  const [toast, setToast] = useState<{
    open: boolean;
    variant: "success" | "info";
    title: string;
    description?: string;
  }>({ open: false, variant: "success", title: "" });

  useEffect(() => setNotesDraft(lesson.notes ?? ""), [lesson.notes]);

  const notesDirty = notesDraft.trim() !== (lesson.notes ?? "").trim();

  const showSuccess = (title: string, description?: string) =>
    setToast({ open: true, variant: "success", title, description });

  const showError = (title: string, description?: string) =>
    setAlert({ open: true, variant: "error", title, description });

  // 낙관적 업데이트 헬퍼
  const applyOptimistic = (patch: Partial<typeof lesson>) => setLesson((l) => ({ ...l, ...patch }));

  const runComplete = () => {
    setStatusSheetOpen(false);
    setPending(true);
    startTransition(async () => {
      const res = await completeLesson(lesson.id);
      setPending(false);
      if (!res.ok) {
        showError("완료 처리 실패", res.error);
        return;
      }
      applyOptimistic({ status: "COMPLETED" });
      showSuccess("레슨이 완료 처리되었어요");
      router.refresh();
    });
  };

  const runConfirmPending = () => {
    setPending(true);
    startTransition(async () => {
      const res = await confirmPendingLesson(lesson.id);
      setPending(false);
      if (!res.ok) {
        showError("스케줄 확정 실패", res.error);
        return;
      }
      applyOptimistic({ status: "CONFIRMED" });
      showSuccess("스케줄이 확정되었어요", "학생에게 알림이 전송됩니다.");
      router.refresh();
    });
  };

  const runMarkPaid = () => {
    setPending(true);
    startTransition(async () => {
      const res = await markLessonPaid(lesson.id);
      setPending(false);
      if (!res.ok) {
        showError("결제 확인 실패", res.error);
        return;
      }
      applyOptimistic({ paymentStatus: "PAID" });
      showSuccess("결제완료로 처리했어요");
      router.refresh();
    });
  };

  // 되돌리기 — 완료/결강 → 예정
  const runRevertStatus = () => {
    setStatusSheetOpen(false);
    if (!window.confirm("완료/결강 처리를 취소하고 예정 상태로 되돌릴까요?")) return;
    setPending(true);
    startTransition(async () => {
      const res = await revertLessonStatus(lesson.id);
      setPending(false);
      if (!res.ok) {
        showError("되돌리기 실패", res.error);
        return;
      }
      applyOptimistic({ status: "CONFIRMED" });
      showSuccess("예정 상태로 되돌렸어요");
      router.refresh();
    });
  };

  // 되돌리기 — 결제확인 → 미결제
  const runUnmarkPaid = () => {
    if (!window.confirm("결제 확인을 취소하고 미결제로 되돌릴까요?")) return;
    setPending(true);
    startTransition(async () => {
      const res = await unmarkLessonPaid(lesson.id);
      setPending(false);
      if (!res.ok) {
        showError("결제 되돌리기 실패", res.error);
        return;
      }
      applyOptimistic({ paymentStatus: "UNPAID" });
      showSuccess("미결제로 되돌렸어요");
      router.refresh();
    });
  };

  const openReasonSheet = (kind: "ABSENT" | "CANCEL") => {
    setStatusSheetOpen(false);
    setReasonText("");
    setReasonSheet(kind);
  };

  const openMakeupWizard = () => {
    setStatusSheetOpen(false);
    setMakeupOpen(true);
  };

  const submitReason = () => {
    if (!reasonSheet) return;
    const kind = reasonSheet;
    setPending(true);
    startTransition(async () => {
      const fn = kind === "ABSENT" ? markLessonAbsent : cancelLessonWithReason;
      const res = await fn(lesson.id, reasonText);
      setPending(false);
      if (!res.ok) {
        showError(kind === "ABSENT" ? "결강 처리 실패" : "취소 실패", res.error);
        return;
      }
      setReasonSheet(null);

      if (kind === "ABSENT") {
        applyOptimistic({ status: "ABSENT" });
        // 결강 후 보강 안내 (#46) — 위저드로 진입
        setConfirm({ kind: "MAKEUP_FOLLOWUP" });
      } else {
        applyOptimistic({ status: "CANCELLED" });
        showSuccess("레슨이 취소되었어요");
      }
      router.refresh();
    });
  };

  const onSaveNotes = () => {
    setPending(true);
    startTransition(async () => {
      const res = await saveLessonNotes(lesson.id, notesDraft);
      setPending(false);
      if (!res.ok) {
        showError("메모 저장 실패", res.error);
        return;
      }
      applyOptimistic({ notes: notesDraft.trim() || null });
      showSuccess("메모가 저장되었어요");
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

  // 메모 변경 미저장 가드 후 실제 이동
  const guardedNav = (proceed: () => void) => {
    if (notesDirty) {
      setConfirm({ kind: "DIRTY_NAV", proceed });
      return;
    }
    proceed();
  };

  const navBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(backHref);
  };

  const handleBack = () => guardedNav(navBack);

  const handleOpenStatusSheet = () => guardedNav(() => setStatusSheetOpen(true));

  const handleConfirmPending = () => setConfirm({ kind: "CONFIRM_PENDING" });
  const handleMarkPaid = () => setConfirm({ kind: "MARK_PAID" });
  const handleCompleteFromSheet = () => {
    setStatusSheetOpen(false);
    setConfirm({ kind: "COMPLETE" });
  };

  const counterpartName = counterpart?.name ?? "이름 미입력";
  const counterpartInitial = counterpartName.slice(0, 1) || "?";
  const headerName = isCoach ? counterpartName : coachDisplayName(counterpartName);
  const formatText = lessonFormatLabel(lesson.lessonFormat);

  const canStudentCancel =
    viewerRole === "STUDENT" &&
    nowMs != null &&
    !["CANCELLED", "COMPLETED", "ABSENT", "RESCHEDULE_COMPLETED"].includes(lesson.status) &&
    new Date(lesson.scheduledAt).getTime() - nowMs >= 24 * 60 * 60 * 1000;

  const onConfirmYes = () => {
    if (!confirm) return;
    const kind = confirm.kind;
    if (kind === "DIRTY_NAV") {
      const proceed = confirm.proceed;
      setConfirm(null);
      proceed();
      return;
    }
    if (kind === "MAKEUP_FOLLOWUP") {
      setConfirm(null);
      // 보강 처리 위저드 진입 (사유 → 방식 → 날짜)
      setMakeupOpen(true);
      return;
    }
    setConfirm(null);
    if (kind === "COMPLETE") runComplete();
    else if (kind === "CONFIRM_PENDING") runConfirmPending();
    else if (kind === "MARK_PAID") runMarkPaid();
  };

  const confirmCopy = (() => {
    if (!confirm) return null;
    switch (confirm.kind) {
      case "COMPLETE":
        return {
          title: "레슨을 완료 처리할까요?",
          description: "처리 후 학생에게 알림이 전송됩니다.",
          yes: "완료 처리",
          no: "취소",
        };
      case "CONFIRM_PENDING":
        return {
          title: "스케줄을 확정할까요?",
          description: "확정 후 학생에게 알림이 전송됩니다.",
          yes: "확정",
          no: "취소",
        };
      case "MARK_PAID":
        return {
          title: "결제완료로 처리할까요?",
          description: "학생이 외부로 결제한 내역을 확인한 후 처리해주세요.",
          yes: "결제완료 처리",
          no: "취소",
        };
      case "MAKEUP_FOLLOWUP":
        return {
          title: "결강 처리되었어요",
          description: "보강 일정도 잡으시겠어요?",
          yes: "보강 요청 보내기",
          no: "나중에",
        };
      case "DIRTY_NAV":
        return {
          title: "저장하지 않은 메모가 있어요",
          description: "지금 이동하면 변경 사항이 사라집니다.",
          yes: "이동",
          no: "계속 작성",
        };
    }
  })();

  return (
    <main className="min-h-screen bg-bg flex flex-col pb-24">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        {/* 상단 바 */}
        <div className="flex items-center h-14 px-3 sticky top-0 z-20 bg-bg/85 backdrop-blur border-b border-line">
          <button
            type="button"
            onClick={handleBack}
            aria-label={`뒤로가기 — ${counterpartName} ${formatDateLabel(lesson.scheduledAt)} 레슨`}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-soft transition text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0 text-center">
            <div className="text-sm font-bold text-ink truncate">{counterpartName}</div>
            <div className="text-[11px] text-ink-3 truncate">
              {formatDateLabel(lesson.scheduledAt)} {formatTimeShort(lesson.scheduledAt)}
            </div>
          </div>
          <div className="w-10 h-10" />
        </div>

        <div className="flex-1 px-5 py-4 pb-40">
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
            <span
              role="status"
              aria-label={`레슨 상태: ${badge.text}`}
              className={`flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${badge.bg} ${badge.fg}`}
            >
              {badge.text}
            </span>
          </div>

          {/* 지난 레슨 안내 (#48) */}
          {isPast && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700 leading-relaxed">
              지난 레슨이에요. 취소는 불가하며, 결강 또는 완료 처리만 가능합니다.
            </div>
          )}

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

          {/* 정규 패턴 + 해당 월 결강/보강 통계 — 코치/학생 공용 */}
          {studentInsights && (
            <div className="mt-3 rounded-2xl border border-line bg-surface px-4 py-3">
              <div className="text-[11px] font-bold text-ink-3 mb-2 tracking-wide">
                {isCoach ? `${counterpart?.name ?? "학생"} 정보` : "내 레슨 정보"}
              </div>
              <div className="space-y-2.5">
                {/* 정규 패턴 */}
                <div className="flex items-start gap-2">
                  <div className="w-16 flex-none text-[11px] text-ink-3">정기 패턴</div>
                  <div className="flex-1 min-w-0 text-xs text-ink">
                    {studentInsights.recurringPattern ? (
                      <span>
                        매주{" "}
                        <span className="font-semibold">
                          {DOW_KOR[studentInsights.recurringPattern.dayOfWeek]}요일{" "}
                          {String(studentInsights.recurringPattern.hour).padStart(2, "0")}:
                          {String(studentInsights.recurringPattern.minute).padStart(2, "0")}
                        </span>
                        {" · "}
                        <span className="font-semibold">{studentInsights.recurringPattern.durationMinutes}분</span>
                        <span className="ml-1.5 text-[10px] text-ink-3">
                          (최근 {studentInsights.recurringPattern.sampleCount}회 일치)
                        </span>
                      </span>
                    ) : (
                      <span className="text-ink-3">반복 패턴 미파악 (최근 회차 부족)</span>
                    )}
                  </div>
                </div>

                {/* 해당 월 결강 / 보강 */}
                <div className="flex items-stretch gap-2">
                  <div className="w-16 flex-none text-[11px] text-ink-3 pt-1">
                    {studentInsights.monthLabel} 통계
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <div className="text-[10px] text-ink-3">결강</div>
                      <div className="mt-0.5 text-base font-extrabold text-gray-700 tabular-nums leading-none">
                        {studentInsights.monthlyAbsentCount}
                        <span className="ml-0.5 text-[10px] font-semibold text-ink-3">회</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-3 py-2">
                      <div className="text-[10px] text-emerald-700/70">보강</div>
                      <div className="mt-0.5 text-base font-extrabold text-emerald-700 tabular-nums leading-none">
                        {studentInsights.monthlyMakeupCount}
                        <span className="ml-0.5 text-[10px] font-semibold text-emerald-700/70">회</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 레슨 정보 표 */}
          <div className="mt-4 rounded-2xl border border-line bg-surface px-4">
            {(() => {
              const rows: Array<{ k: string; v: React.ReactNode }> = [
                { k: "레슨 형태", v: formatText },
                { k: "레슨 시간", v: `회당 ${lesson.durationMinutes}분` },
              ];
              if (lesson.roundNumber != null && lesson.totalRounds != null) {
                const ratio = Math.max(0, Math.min(1, lesson.roundNumber / lesson.totalRounds));
                rows.push({
                  k: "현재 회차",
                  v: (
                    <span className="inline-flex items-center gap-2">
                      <span>{lesson.roundNumber} / {lesson.totalRounds}회</span>
                      <span className="inline-block w-14 h-1.5 rounded-full bg-soft overflow-hidden" aria-hidden>
                        <span
                          className="block h-full bg-primary"
                          style={{ width: `${ratio * 100}%` }}
                        />
                      </span>
                    </span>
                  ),
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

          {/* 결제 확인 액션 (#16) — 코치 + UNPAID 일 때만 */}
          {isCoach && lesson.paymentStatus === "UNPAID" && (
            <button
              type="button"
              onClick={handleMarkPaid}
              disabled={pending}
              className="mt-3 w-full flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 transition active:scale-[0.99] disabled:opacity-60"
            >
              <span>미결제 — 결제확인 처리</span>
              <span aria-hidden>›</span>
            </button>
          )}

          {/* 결제 되돌리기 — 코치 + PAID 일 때만 */}
          {isCoach && lesson.paymentStatus === "PAID" && (
            <button
              type="button"
              onClick={runUnmarkPaid}
              disabled={pending}
              className="mt-3 w-full flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-xs font-semibold text-ink-3 hover:bg-soft transition active:scale-[0.99] disabled:opacity-60"
              title="실수로 결제 확인한 경우 미결제로 되돌립니다"
            >
              <span>결제 확인 되돌리기 (미결제로)</span>
              <span aria-hidden>↺</span>
            </button>
          )}

          {/* 메모 / 코치 코멘트 */}
          {isCoach ? (
            <div className="mt-5">
              <label htmlFor="lesson-notes" className="block text-sm font-semibold text-ink mb-1.5">
                코치 메모
              </label>
              <textarea
                id="lesson-notes"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="레슨 메모, 코칭 포인트, 다음 회차 계획 등을 기록하세요"
                rows={4}
                maxLength={1000}
                className="w-full rounded-xl border border-line bg-surface p-3 text-sm text-ink placeholder:text-ink-3 resize-none outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[11px] text-ink-3">
                  {notesDirty ? "저장되지 않은 변경 사항이 있어요" : `${notesDraft.length} / 1000`}
                </span>
                {notesDirty && (
                  <button
                    type="button"
                    onClick={onSaveNotes}
                    disabled={pending}
                    className="text-xs font-semibold text-primary-700 px-3 py-1 rounded-md hover:bg-primary/10 disabled:opacity-60 inline-flex items-center gap-1.5"
                  >
                    {pending && (
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                      </svg>
                    )}
                    {pending ? "저장 중" : "메모 저장"}
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

        {/* 하단 액션 영역 — BottomNav 위에 sticky */}
        <div
          className="fixed inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line px-5 py-3 flex gap-2 max-w-md mx-auto"
          style={{ bottom: "76px" }}
        >
          {isCoach ? (
            <CoachActions
              status={displayStatus as LessonStatus}
              isPast={isPast}
              onComplete={handleCompleteFromSheet}
              onOpenStatusSheet={handleOpenStatusSheet}
              onOpenCancel={() => openReasonSheet("CANCEL")}
              onOpenMakeup={openMakeupWizard}
              onConfirmPending={handleConfirmPending}
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

      <BottomNav role={viewerRole} active="" />

      {/* 상태 처리 바텀시트 (코치 전용) */}
      {statusSheetOpen && (
        <BottomSheet onClose={() => setStatusSheetOpen(false)} title="상태 처리하기">
          {/* 이미 완료/결강 처리됐으면 "되돌리기" 가 최상단에 노출 */}
          {(lesson.status === "COMPLETED" || lesson.status === "ABSENT") && (
            <>
              <SheetItem
                label={lesson.status === "COMPLETED" ? "완료 처리 되돌리기" : "결강 처리 되돌리기"}
                onClick={runRevertStatus}
                icon={<UndoIcon />}
                primary
              />
              <p className="px-2 mt-1 text-[11px] text-ink-3">실수로 처리한 경우 예정 상태로 복원합니다.</p>
              <div className="my-2 border-t border-line/70" />
            </>
          )}

          <SheetItem
            label="레슨 완료 처리"
            onClick={handleCompleteFromSheet}
            icon={<CheckIcon />}
            primary
            disabled={lesson.status === "COMPLETED" || lesson.status === "ABSENT"}
          />
          <SheetItem
            label="보강 처리"
            onClick={openMakeupWizard}
            icon={<RefreshIcon />}
            disabled={lesson.status === "COMPLETED" || lesson.status === "ABSENT" || isPast}
          />
          {isPast && lesson.status !== "COMPLETED" && lesson.status !== "ABSENT" && (
            <p className="px-2 -mt-1 mb-1 text-[11px] text-ink-3">
              지난 레슨에는 보강을 잡을 수 없어요
            </p>
          )}
          <SheetItem
            label="결강 처리"
            onClick={() => openReasonSheet("ABSENT")}
            icon={<XIcon />}
            disabled={lesson.status === "COMPLETED" || lesson.status === "ABSENT"}
          />
          <div className="my-2 border-t border-line/70" />
          <SheetItem label="레슨 취소" onClick={() => openReasonSheet("CANCEL")} icon={<TrashIcon />} danger disabled={isPast} />
          {isPast && (
            <p className="px-2 mt-1 text-[11px] text-ink-3">지난 레슨은 취소할 수 없어요.</p>
          )}
        </BottomSheet>
      )}

      {/* 사유 입력 바텀시트 */}
      {reasonSheet && (
        <BottomSheet
          onClose={() => setReasonSheet(null)}
          title={reasonSheet === "ABSENT" ? "결강 사유" : "취소 사유"}
        >
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder={
              reasonSheet === "ABSENT"
                ? "예: 학생 무단 불참, 코치 사정 등 (필수)"
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
              className="flex-1 h-12 rounded-xl bg-ink text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {pending && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                </svg>
              )}
              {pending ? "처리 중" : "확인"}
            </button>
          </div>
        </BottomSheet>
      )}

      {/* 일반 확인 시트 (완료/확정/결제확인/보강안내/이탈가드) */}
      {confirm && confirmCopy && (
        <BottomSheet onClose={() => setConfirm(null)} title={confirmCopy.title}>
          {confirmCopy.description && (
            <p className="text-xs text-ink-2 leading-relaxed mb-4">{confirmCopy.description}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirm(null)}
              className="flex-1 h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition"
            >
              {confirmCopy.no}
            </button>
            <button
              type="button"
              onClick={onConfirmYes}
              disabled={pending}
              className={`flex-1 h-12 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${
                confirm.kind === "DIRTY_NAV"
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-ink text-white hover:opacity-90"
              }`}
            >
              {confirmCopy.yes}
            </button>
          </div>
        </BottomSheet>
      )}

      {/* 보강 처리 위저드 — 사유 → 방식 → 날짜 3단계 (프로토타입 7-0 기준) */}
      <MakeupWizard
        open={makeupOpen}
        onClose={() => setMakeupOpen(false)}
        originalLessonId={lesson.id}
        originalScheduledAt={lesson.scheduledAt}
        originalDurationMinutes={lesson.durationMinutes}
        onProposed={() => {
          showSuccess("보강 제안을 보냈어요", "수강생이 수락하면 확정됩니다.");
          router.refresh();
        }}
      />

      <AlertModal
        open={alert.open}
        onClose={() => setAlert((a) => ({ ...a, open: false }))}
        variant={alert.variant}
        title={alert.title}
        description={alert.description}
      />

      <Toast
        open={toast.open}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        variant={toast.variant}
        title={toast.title}
        description={toast.description}
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
  isPast,
  onComplete,
  onOpenStatusSheet,
  onOpenCancel,
  onOpenMakeup,
  onConfirmPending,
  onClose,
  pending,
}: {
  status: LessonStatus | string;
  isPast: boolean;
  onComplete: () => void;
  onOpenStatusSheet: () => void;
  onOpenCancel: () => void;
  onOpenMakeup: () => void;
  onConfirmPending: () => void;
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
        상태 처리하기 (완료·보강·결강)
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
          onClick={onConfirmPending}
          disabled={pending || isPast}
          className="flex-1 h-12 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-500 transition disabled:opacity-60"
        >
          {pending ? "처리 중…" : "스케줄 확정"}
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
  primary,
  disabled,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  danger?: boolean;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 py-3.5 px-2 rounded-lg transition text-left ${
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-soft"
      } ${danger ? "text-red-500" : "text-ink"}`}
    >
      <span
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          danger ? "bg-red-50 text-red-500" : primary ? "bg-primary/15 text-primary-700" : "bg-soft text-ink-2"
        }`}
      >
        {icon}
      </span>
      <span className={`text-sm ${primary ? "font-bold" : "font-semibold"}`}>{label}</span>
    </button>
  );
}
