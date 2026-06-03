"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { proposeMakeup } from "@/app/actions/lessons";

type Step = "reason" | "method" | "date";
type Reason = "COACH" | "STUDENT" | "WEATHER" | "COURT" | "OTHER";
type Method = "ADD" | "MERGE" | "SPLIT";

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

  // open 시 상태 리셋 + 날짜 기본값(원 회차 + 7일, 같은 시각)
  useEffect(() => {
    if (!open) return;
    setStep("reason");
    setReason(null);
    setOtherText("");
    setMethod("ADD");
    setError(null);
    const orig = new Date(originalScheduledAt);
    const next = new Date(orig.getTime() + 7 * 24 * 60 * 60 * 1000);
    const kst = new Date(next.getTime() + 9 * 60 * 60 * 1000);
    setDate(kst.toISOString().slice(0, 10));
    setTime(kst.toISOString().slice(11, 16));
  }, [open, originalScheduledAt]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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

  const todayIso = (() => {
    const k = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return k.toISOString().slice(0, 10);
  })();

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
                수강생에게 제안할 보강 날짜와 시작 시각을 골라주세요
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1.5">날짜</label>
                  <input
                    type="date"
                    value={date}
                    min={todayIso}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-12 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1.5">시작 시각</label>
                  <input
                    type="time"
                    value={time}
                    step={600}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full h-12 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-primary/40"
                  />
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
