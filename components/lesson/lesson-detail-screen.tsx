"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AlertModal } from "@/components/alert-modal";
import {
  completeLesson,
  markLessonAbsent,
  requestMakeup,
  cancelLessonWithReason,
  saveLessonNotes,
} from "@/app/actions/lessons";

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

const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];

function parseIsoUtc(s: string): Date {
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + "Z");
}

function kstParts(d: Date) {
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return {
    y: k.getUTCFullYear(),
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

function deriveDisplayStatus(lesson: LessonDetailData["lesson"]): DisplayStatus {
  const known = lesson.status as DisplayStatus;
  if (known === "CONFIRMED") {
    const start = parseIsoUtc(lesson.scheduledAt).getTime();
    const end = start + lesson.durationMinutes * 60 * 1000;
    const now = Date.now();
    if (now >= start && now < end) return "IN_PROGRESS";
  }
  return known in STATUS_BADGE ? known : "CONFIRMED";
}

function paymentLabel(status: string): { text: string; tone: "ok" | "warn" | "muted" } {
  switch (status) {
    case "PAID":
      return { text: "결제완료", tone: "ok" };
    case "UNPAID":
      return { text: "미결제", tone: "warn" };
    case "EXTERNAL":
      return { text: "외부결제", tone: "muted" };
    case "NONE":
    default:
      return { text: "해당 없음", tone: "muted" };
  }
}

function formatLabel(f: string) {
  return f === "GROUP" ? "그룹" : "1:1 개인";
}

function ageGroupLabel(v: string | null) {
  if (!v) return null;
  return v.replace(/^TEEN/, "10대").replace(/^TWENTIES/, "20대").replace(/^THIRTIES/, "30대").replace(/^FORTIES/, "40대").replace(/^FIFTIES_PLUS/, "50대+");
}

function genderLabel(v: string | null) {
  if (!v) return null;
  return v === "MALE" ? "남" : v === "FEMALE" ? "여" : null;
}

export function LessonDetailScreen({ data, backHref }: { data: LessonDetailData; backHref: string }) {
  const router = useRouter();
  const { lesson, viewerRole, counterpart, studentProfile, coachProfile } = data;
  const isCoach = viewerRole === "COACH";
  const displayStatus = deriveDisplayStatus(lesson);
  const badge = STATUS_BADGE[displayStatus];

  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [reasonSheet, setReasonSheet] = useState<null | "ABSENT" | "MAKEUP" | "CANCEL">(null);
  const [reasonText, setReasonText] = useState("");
  const [notesDraft, setNotesDraft] = useState(lesson.notes ?? "");
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);
  const [alert, setAlert] = useState<{
    open: boolean;
    variant: "success" | "error";
    title: string;
    description?: string;
  }>({ open: false, variant: "success", title: "" });

  useEffect(() => setNotesDraft(lesson.notes ?? ""), [lesson.notes]);

  const payment = paymentLabel(lesson.paymentStatus);
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

  const counterpartName = counterpart?.name ?? "이름 미입력";
  const counterpartInitial = counterpartName.slice(0, 1);
  const formatText = formatLabel(lesson.lessonFormat);

  // 학생 셀프 취소 가용 — 24시간 전까지
  const canStudentCancel =
    viewerRole === "STUDENT" &&
    !["CANCELLED", "COMPLETED", "ABSENT"].includes(lesson.status) &&
    parseIsoUtc(lesson.scheduledAt).getTime() - Date.now() >= 24 * 60 * 60 * 1000;

  return (
    <main className="min-h-screen bg-bg flex flex-col">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        {/* 상단 바 */}
        <div className="flex items-center h-14 px-3 sticky top-0 z-10 bg-bg/85 backdrop-blur border-b border-line">
          <Link
            href={backHref}
            aria-label="뒤로가기"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-soft transition text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
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
                <div className="mt-0.5 text-xs text-ink-3 line-through">
                  변경 전 {formatDateLabel(lesson.originalScheduledAt)} ·
                  {" "}{kstParts(parseIsoUtc(lesson.originalScheduledAt)).hh}:
                  {kstParts(parseIsoUtc(lesson.originalScheduledAt)).mm}
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
              <div className="text-sm font-bold text-ink">
                {isCoach ? counterpartName : `${counterpartName} 코치`}
              </div>
              <div className="mt-0.5 text-xs text-ink-3">
                {isCoach && studentProfile ? (
                  <>
                    {[
                      ageGroupLabel(studentProfile.ageGroup),
                      genderLabel(studentProfile.gender),
                      studentProfile.ntrpLevel ? `NTRP ${studentProfile.ntrpLevel}` : null,
                    ].filter(Boolean).join(" · ") || "프로필 미입력"}
                  </>
                ) : !isCoach && coachProfile ? (
                  <>
                    {[
                      [coachProfile.areaSido, coachProfile.areaSigungu].filter(Boolean).join(" "),
                      coachProfile.ntrpMin != null && coachProfile.ntrpMax != null
                        ? `NTRP ${coachProfile.ntrpMin}~${coachProfile.ntrpMax}`
                        : null,
                    ].filter(Boolean).join(" · ") || "프로필 정보 없음"}
                  </>
                ) : (
                  "프로필 정보 없음"
                )}
              </div>
            </div>
            <button
              type="button"
              disabled
              className="flex-none text-xs font-semibold text-ink-3 px-3 py-1.5 rounded-lg border border-line bg-surface cursor-not-allowed"
              aria-label="대화하기 (준비 중)"
            >
              대화하기
            </button>
          </div>

          {/* 레슨 정보 표 */}
          <div className="mt-4 rounded-2xl border border-line bg-surface px-4">
            {(() => {
              const rows: Array<{ k: string; v: React.ReactNode }> = [
                { k: "레슨 유형", v: "정규 레슨" },
                { k: "레슨 형태", v: formatText },
                { k: "레슨 시간", v: `${lesson.durationMinutes}분 (회당)` },
                {
                  k: "현재 회차",
                  v:
                    lesson.roundNumber != null && lesson.totalRounds != null
                      ? `${lesson.roundNumber} / ${lesson.totalRounds}회`
                      : "—",
                },
                {
                  k: "결제",
                  v: (
                    <span
                      className={`text-xs font-semibold ${
                        payment.tone === "ok"
                          ? "text-primary-600"
                          : payment.tone === "warn"
                            ? "text-red-500"
                            : "text-ink-3"
                      }`}
                    >
                      {payment.text}
                    </span>
                  ),
                },
              ];
              if (lesson.splitIndex != null && lesson.splitTotal != null) {
                rows.push({ k: "분할", v: `${lesson.splitIndex} / ${lesson.splitTotal}회` });
              }
              return rows.map((r, i) => (
                <InfoRow key={r.k} k={r.k} v={r.v} last={i === rows.length - 1} />
              ));
            })()}
          </div>

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
        </div>

        {/* 하단 액션 영역 */}
        <div className="sticky bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-line px-5 py-4 flex gap-2 max-w-md mx-auto w-full">
          {isCoach ? (
            <CoachActions
              status={displayStatus}
              onComplete={onComplete}
              onOpenStatusSheet={() => setStatusSheetOpen(true)}
              onOpenCancel={() => openReasonSheet("CANCEL")}
              onClose={() => router.push(backHref)}
              pending={pending}
            />
          ) : (
            <StudentActions
              status={displayStatus}
              canCancel={canStudentCancel}
              onCancel={() => openReasonSheet("CANCEL")}
              onClose={() => router.push(backHref)}
              pending={pending}
            />
          )}
        </div>
      </div>

      {/* 상태 처리 바텀시트 (코치 전용) */}
      {statusSheetOpen && (
        <BottomSheet onClose={() => setStatusSheetOpen(false)} title="상태 처리하기">
          <SheetItem label="레슨 완료 처리" onClick={onComplete} icon="✓" />
          <SheetItem label="보강 처리" onClick={() => openReasonSheet("MAKEUP")} icon="↻" />
          <SheetItem label="결강 처리" onClick={() => openReasonSheet("ABSENT")} icon="✕" />
          <SheetItem label="레슨 취소" onClick={() => openReasonSheet("CANCEL")} icon="🗑" danger />
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
                ? "예: 학생 무단 불참, 코치 사정 등"
                : reasonSheet === "MAKEUP"
                  ? "예: 우천, 학생 사정 등 보강이 필요한 사유"
                  : "취소 사유를 입력해주세요 (선택)"
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
              취소
            </button>
            <button
              type="button"
              onClick={submitReason}
              disabled={pending || (reasonSheet !== "CANCEL" && !reasonText.trim())}
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
  onClose,
  pending,
}: {
  status: DisplayStatus;
  onComplete: () => void;
  onOpenStatusSheet: () => void;
  onOpenCancel: () => void;
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
  if (status === "PENDING" || status === "RESCHEDULE_REQUESTED" || status === "MAKEUP_REQUESTED" || status === "MAKEUP_PENDING") {
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
  // COMPLETED / ABSENT / CANCELLED 등 종료 상태
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
  status,
  canCancel,
  onCancel,
  onClose,
  pending,
}: {
  status: DisplayStatus;
  canCancel: boolean;
  onCancel: () => void;
  onClose: () => void;
  pending: boolean;
}) {
  if (canCancel && (status === "CONFIRMED" || status === "PENDING" || status === "MAKEUP_CONFIRMED")) {
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
  icon: string;
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
      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${danger ? "bg-red-50" : "bg-soft"}`}>
        {icon}
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}
