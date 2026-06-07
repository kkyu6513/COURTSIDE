"use client";

// rev: makeup-wizard-v2 (3-step: reason → method → date) + 가능 슬롯 선택 UI
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { proposeMakeup } from "@/app/actions/lessons";

type Step = "reason" | "method" | "date";
type Reason = "COACH" | "STUDENT" | "WEATHER" | "COURT" | "OTHER";
type Method = "ADD" | "MERGE" | "SPLIT";

type AvailLesson = {
  id: number;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];
const VISIBLE_DAYS = 14; // 오늘부터 N일치 표시
const SLOT_STEP_MIN = 10; // 10분 단위 슬롯 후보
const DAY_START_MIN = 6 * 60;
const DAY_END_MIN = 24 * 60;

const REASON_OPTIONS: Array<{ value: Reason; label: string; sub: string }> = [
  { value: "COACH", label: "코치 사정", sub: "코치의 일정 변경" },
  { value: "STUDENT", label: "고객 사정", sub: "수강생 요청" },
  { value: "WEATHER", label: "날씨", sub: "우천·기온 등 외부 요인" },
  { value: "COURT", label: "코트 사정", sub: "코트 점검·휴장 등" },
  { value: "OTHER", label: "기타", sub: "직접 입력" },
];

const REASON_TEXT: Record<Reason, string> = {
  COACH: "코치 사정",
  STUDENT: "고객 사정",
  WEATHER: "날씨",
  COURT: "코트 사정",
  OTHER: "기타",
};

export type MakeupWizardProps = {
  open: boolean;
  onClose: () => void;
  originalLessonId: number;
  originalScheduledAt: string;
  originalDurationMinutes: number;
  onProposed?: () => void;
};

/** 보강 처리 위저드 — 프로토타입 7-0 보강 사유 → 방식 → 날짜 3단계 */
export function MakeupWizard({
  open,
  onClose,
  originalLessonId,
  originalScheduledAt,
  originalDurationMinutes,
  onProposed,
}: MakeupWizardProps) {
  const [step, setStep] = useState<Step>("reason");
  const [reason, setReason] = useState<Reason | null>(null);
  const [otherText, setOtherText] = useState("");
  const [method, setMethod] = useState<Method>("ADD");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 코치 lessons — 가능 슬롯 계산용 (date 단계 진입 시 fetch)
  const [coachLessons, setCoachLessons] = useState<AvailLesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);

  // open 시 상태 리셋
  useEffect(() => {
    if (!open) return;
    setStep("reason");
    setReason(null);
    setOtherText("");
    setMethod("ADD");
    setDate("");
    setTime("");
    setError(null);
  }, [open, originalScheduledAt]);

  // date 단계 진입 시 lessons fetch (가능 슬롯 계산용)
  useEffect(() => {
    if (!open || step !== "date") return;
    let cancelled = false;
    setLoadingLessons(true);
    fetch("/api/coach/lessons", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (cancelled) return;
        setCoachLessons((data?.lessons ?? []) as AvailLesson[]);
      })
      .catch(() => {
        // 가능 슬롯 계산 실패 시 빈 배열로 (모든 슬롯이 가능으로 표시될 수 있음)
        if (cancelled) return;
        setCoachLessons([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingLessons(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ⚠ Rules of Hooks — 모든 hook은 early return 위에 있어야 함.

  // 오늘부터 N일치 날짜 칩 (KST trick Date)
  const dayChips = useMemo(() => {
    const k = new Date(Date.now() + KST_OFFSET_MS);
    const today = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
    return Array.from({ length: VISIBLE_DAYS }, (_, i) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() + i);
      const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      return {
        iso,
        date: d,
        m: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        dowKor: DOW_KOR[d.getUTCDay()],
        isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
      };
    });
  }, [open]);

  // 자동 기본 날짜 — 오늘로 고정 (date 단계 첫 진입 시)
  useEffect(() => {
    if (!open || step !== "date" || date) return;
    setDate(dayChips[0]?.iso ?? "");
  }, [open, step, dayChips, date]);

  // 선택된 날짜의 가능 슬롯
  const availableSlots = useMemo<{ startMin: number; endMin: number; label: string }[]>(() => {
    if (!date) return [];
    const chip = dayChips.find((c) => c.iso === date);
    if (!chip) return [];
    const dayUtcMidnight = chip.date.getTime() - KST_OFFSET_MS;
    const nowMs = Date.now();
    const result: { startMin: number; endMin: number; label: string }[] = [];
    for (let startMin = DAY_START_MIN; startMin < DAY_END_MIN; startMin += SLOT_STEP_MIN) {
      const endMin = startMin + originalDurationMinutes;
      if (endMin > DAY_END_MIN) break;
      const slotStartMs = dayUtcMidnight + startMin * 60 * 1000;
      const slotEndMs = slotStartMs + originalDurationMinutes * 60 * 1000;
      if (slotStartMs < nowMs) continue;
      const conflict = coachLessons.some((l) => {
        if (l.status === "CANCELLED" || l.status === "COMPLETED" || l.status === "ABSENT") return false;
        const lStart = new Date(l.scheduledAt).getTime();
        const lEnd = lStart + l.durationMinutes * 60 * 1000;
        return slotStartMs < lEnd && slotEndMs > lStart;
      });
      if (conflict) continue;
      const hh = String(Math.floor(startMin / 60)).padStart(2, "0");
      const mm = String(startMin % 60).padStart(2, "0");
      result.push({ startMin, endMin, label: `${hh}:${mm}` });
    }
    return result;
  }, [date, dayChips, coachLessons, originalDurationMinutes]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const reasonText = (): string => {
    if (!reason) return "";
    if (reason === "OTHER") return otherText.trim();
    const base = REASON_TEXT[reason];
    return otherText.trim() ? `${base} — ${otherText.trim()}` : base;
  };

  const canNextFromReason =
    !!reason && (reason !== "OTHER" || otherText.trim().length >= 2);
  const canSubmit = method === "ADD" && !!date && !!time && !pending;

  // 슬롯 선택 시 time state 동기화
  const handlePickSlot = (label: string) => {
    setTime(label);
    setError(null);
  };

  const onSubmit = async () => {
    if (!canSubmit) return;
    const [hh, mm] = time.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) {
      setError("시각이 올바르지 않아요");
      return;
    }
    // KST date+time → UTC ISO
    const kst = new Date(`${date}T00:00:00.000Z`);
    kst.setUTCHours(hh, mm, 0, 0);
    const utcMs = kst.getTime() - 9 * 60 * 60 * 1000;
    if (Number.isNaN(utcMs) || utcMs < Date.now() - 5 * 60 * 1000) {
      setError("이미 지난 시각에는 보강을 잡을 수 없어요");
      return;
    }
    const iso = new Date(utcMs).toISOString();

    setPending(true);
    setError(null);
    const res = await proposeMakeup(
      originalLessonId,
      reasonText(),
      iso,
      originalDurationMinutes,
    );
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onProposed?.();
    onClose();
  };

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[10100]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-0 right-0 bottom-0 bg-surface rounded-t-3xl px-5 pt-3 pb-6 shadow-2xl max-h-[92vh] flex flex-col">
        <div className="w-10 h-1 rounded-full bg-line mx-auto mb-3 flex-none" />

        <div className="flex items-center justify-between flex-none mb-3">
          {step !== "reason" ? (
            <button
              type="button"
              onClick={() =>
                setStep(step === "date" ? "method" : step === "method" ? "reason" : "reason")
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink rounded-md px-2 py-1 -ml-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 18l-6-6 6-6" />
              </svg>
              이전
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-9 h-9 rounded-full text-ink-3 hover:bg-soft transition flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-5 px-5">
          {/* 진행 단계 표시 */}
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-ink-3 mb-3">
            <span className={step === "reason" ? "text-primary-600" : ""}>① 사유</span>
            <span>›</span>
            <span className={step === "method" ? "text-primary-600" : ""}>② 방식</span>
            <span>›</span>
            <span className={step === "date" ? "text-primary-600" : ""}>③ 날짜</span>
          </div>

          {step === "reason" && (
            <div>
              <h2 className="text-lg font-extrabold text-ink">보강 사유 선택</h2>
              <p className="mt-1 text-xs text-ink-3">보강이 필요한 사유를 선택해 주세요</p>

              <div className="mt-4 space-y-2">
                {REASON_OPTIONS.map((o) => {
                  const checked = reason === o.value;
                  return (
                    <label
                      key={o.value}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        checked
                          ? "border-primary-400 bg-primary/5"
                          : "border-line bg-surface hover:bg-soft"
                      }`}
                    >
                      <input
                        type="radio"
                        name="makeup-reason"
                        value={o.value}
                        checked={checked}
                        onChange={() => setReason(o.value)}
                        className="accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-ink">{o.label}</div>
                        <div className="text-[11px] text-ink-3">{o.sub}</div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {reason === "OTHER" && (
                <textarea
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value.slice(0, 200))}
                  placeholder="사유를 직접 입력해 주세요 (2자 이상)"
                  className="mt-3 w-full h-20 rounded-xl border border-line bg-surface p-3 text-sm text-ink placeholder:text-ink-3 resize-none outline-none focus:ring-2 focus:ring-primary/40"
                />
              )}

              {reason && reason !== "OTHER" && (
                <textarea
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value.slice(0, 200))}
                  placeholder="상세 메모(선택)"
                  className="mt-3 w-full h-16 rounded-xl border border-line bg-surface p-3 text-sm text-ink placeholder:text-ink-3 resize-none outline-none focus:ring-2 focus:ring-primary/40"
                />
              )}
            </div>
          )}

          {step === "method" && (
            <div>
              <h2 className="text-lg font-extrabold text-ink">보강 방식 선택</h2>
              <p className="mt-1 text-xs text-ink-3">
                보강을 어떤 방식으로 진행할지 선택해 주세요
              </p>

              <div className="mt-4 space-y-2">
                {/* 추가 */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    method === "ADD"
                      ? "border-primary-400 bg-primary/5"
                      : "border-line bg-surface hover:bg-soft"
                  }`}
                >
                  <input
                    type="radio"
                    name="makeup-method"
                    value="ADD"
                    checked={method === "ADD"}
                    onChange={() => setMethod("ADD")}
                    className="accent-primary mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-ink">
                      ① 추가 <span className="text-[10px] font-semibold text-ink-3 ml-1">가장 일반적</span>
                    </div>
                    <div className="mt-1 text-[11px] text-ink-2 leading-relaxed">
                      회차 차감 없이 새 날짜를 잡아 보강 진행. 1회 보강 케이스에 사용해요.
                    </div>
                  </div>
                </label>

                {/* 통합 — 준비 중 */}
                <label className="flex items-start gap-3 p-3 rounded-xl border border-line bg-soft opacity-60 cursor-not-allowed">
                  <input type="radio" disabled className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-ink-2">
                      ② 통합 <span className="text-[10px] font-semibold text-ink-3 ml-1">준비 중</span>
                    </div>
                    <div className="mt-1 text-[11px] text-ink-3 leading-relaxed">
                      짧은 회차 N개를 한 번에 길게 (예: 20분 × 2회 → 40분 × 1회).
                    </div>
                  </div>
                </label>

                {/* 분할 — 준비 중 */}
                <label className="flex items-start gap-3 p-3 rounded-xl border border-line bg-soft opacity-60 cursor-not-allowed">
                  <input type="radio" disabled className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-ink-2">
                      ③ 분할 <span className="text-[10px] font-semibold text-ink-3 ml-1">준비 중</span>
                    </div>
                    <div className="mt-1 text-[11px] text-ink-3 leading-relaxed">
                      긴 회차 1개를 짧게 N번 (예: 40분 × 1회 → 20분 × 2회).
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === "date" && (
            <div>
              <h2 className="text-lg font-extrabold text-ink">보강 날짜·시간 선택</h2>
              <p className="mt-1 text-xs text-ink-3">
                코치 일정 비어있는 시간만 표시돼요. 가능한 시간을 골라주세요.
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1.5">날짜</label>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "thin" }}>
                    {dayChips.map((c) => {
                      const active = c.iso === date;
                      return (
                        <button
                          key={c.iso}
                          type="button"
                          onClick={() => {
                            setDate(c.iso);
                            setTime("");
                            setError(null);
                          }}
                          className={`flex-none w-14 py-2 rounded-xl text-center transition active:scale-[0.97] ${
                            active
                              ? "bg-primary text-white shadow-sm"
                              : "bg-soft hover:bg-line"
                          }`}
                        >
                          <div className={`text-[10px] ${active ? "text-white/85" : c.isWeekend ? "text-red-500" : "text-ink-3"}`}>
                            {c.dowKor}
                          </div>
                          <div className={`text-sm font-bold mt-0.5 ${active ? "text-white" : "text-ink"}`}>
                            {c.day}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-ink-2">시작 시각</label>
                    {!loadingLessons && date && (
                      <span className="text-[10px] text-ink-3 font-medium">
                        가능한 슬롯 {availableSlots.length}개 · {originalDurationMinutes}분
                      </span>
                    )}
                  </div>
                  {loadingLessons ? (
                    <div className="rounded-xl border border-dashed border-line py-8 text-center text-xs text-ink-3">
                      가능한 시간을 불러오는 중…
                    </div>
                  ) : !date ? (
                    <div className="rounded-xl border border-dashed border-line py-6 text-center text-xs text-ink-3">
                      먼저 날짜를 선택하세요
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line py-6 text-center">
                      <p className="text-xs font-semibold text-ink">가능한 시간이 없어요</p>
                      <p className="mt-1 text-[10px] text-ink-3">
                        다른 날짜를 선택해 주세요
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5 max-h-60 overflow-y-auto pr-1">
                      {availableSlots.map((s) => {
                        const active = s.label === time;
                        return (
                          <button
                            key={s.startMin}
                            type="button"
                            onClick={() => handlePickSlot(s.label)}
                            className={`h-10 rounded-lg text-xs font-bold transition active:scale-[0.97] tabular-nums ${
                              active
                                ? "bg-primary text-white shadow-sm"
                                : "bg-soft text-ink-2 hover:bg-line"
                            }`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-soft px-3 py-2.5 text-[11px] text-ink-2">
                  레슨 시간 <b className="text-ink">{originalDurationMinutes}분</b> (원 회차와 동일).
                  수강생이 수락해야 확정됩니다.
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {error}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 하단 CTA */}
        <div className="flex-none pt-3">
          {step === "reason" && (
            <button
              type="button"
              onClick={() => setStep("method")}
              disabled={!canNextFromReason}
              className="w-full h-12 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1"
            >
              다음: 보강 방식 선택
              <span aria-hidden>›</span>
            </button>
          )}
          {step === "method" && (
            <button
              type="button"
              onClick={() => setStep("date")}
              disabled={method !== "ADD"}
              className="w-full h-12 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1"
            >
              다음: 날짜 선택
              <span aria-hidden>›</span>
            </button>
          )}
          {step === "date" && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="w-full h-12 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "제안 중…" : "수강생에게 제안 보내기"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
