"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { KST_OFFSET_MS, parseIsoUtc } from "@/lib/kst";
import { Toast } from "@/components/toast";
import { AlertModal } from "@/components/alert-modal";
import { sendAvailabilityToStudent } from "@/app/coach/schedule/availability-actions";

type Lesson = {
  id: number;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
};

type Student = {
  id: string;
  name: string;
  phone: string | null;
};

// 요일 — 0=일 ~ 6=토 (Date.getUTCDay 와 동일)
type DowKey = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DOW_OPTIONS: { key: DowKey; label: string }[] = [
  { key: 1, label: "월" },
  { key: 2, label: "화" },
  { key: 3, label: "수" },
  { key: 4, label: "목" },
  { key: 5, label: "금" },
  { key: 6, label: "토" },
  { key: 0, label: "일" },
];

const DURATION_OPTIONS = [20, 30, 40, 60];
const SLOT_STEP_MIN = 10;

const HOUR_MIN = 6;
const HOUR_MAX = 23;
const DAY_END_MIN = 24 * 60;
const DEFAULT_HOUR = 9;

const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];

type Props = {
  open: boolean;
  onClose: () => void;
};

type AvailableSlot = {
  date: Date;
  startMin: number;
  endMin: number;
};

export function AvailabilitySheet({ open, onClose }: Props) {
  // 기본 요일 — 오늘
  const todayDow = ((): DowKey => {
    const k = new Date(Date.now() + KST_OFFSET_MS);
    return k.getUTCDay() as DowKey;
  })();
  const [dow, setDow] = useState<DowKey>(todayDow);
  const [hour, setHour] = useState<number>(DEFAULT_HOUR);
  const [duration, setDuration] = useState<number>(60);

  // 단계별 위저드 — dow → hour → duration → result
  type Step = "dow" | "hour" | "duration" | "result";
  const [step, setStep] = useState<Step>("dow");

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 학생 선택 모드 — true면 본문이 학생 리스트로 전환
  const [pickingStudent, setPickingStudent] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // 토스트 / 알림
  const [toast, setToast] = useState<{ open: boolean; title: string; description?: string }>({
    open: false,
    title: "",
  });
  const [alert, setAlert] = useState<{ open: boolean; title: string; description?: string }>({
    open: false,
    title: "",
  });

  // 시트 열릴 때 초기화 + lessons fetch
  useEffect(() => {
    if (!open) return;
    const k = new Date(Date.now() + KST_OFFSET_MS);
    setDow(k.getUTCDay() as DowKey);
    setHour(DEFAULT_HOUR);
    setDuration(60);
    setStep("dow");
    setPickingStudent(false);
    setError(null);
    let cancelled = false;
    setLoading(true);
    fetch("/api/coach/lessons", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setLessons((data?.lessons ?? []) as Lesson[]);
        setStudents((data?.students ?? []) as Student[]);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "네트워크 오류");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // ESC 닫기 + body 스크롤 차단
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

  // 가능 슬롯 — 선택된 요일의 가장 가까운 미래 날짜 + 선택된 시간(1시간) 범위 내
  const targetDate = useMemo(() => nextDateForDow(dow), [dow]);

  const availableSlots = useMemo<AvailableSlot[]>(() => {
    if (loading || error) return [];
    const dates = [targetDate];
    const out: AvailableSlot[] = [];
    const nowMs = Date.now();
    const bandStartMin = hour * 60;
    const bandEndMin = (hour + 1) * 60;
    for (const date of dates) {
      const dayUtcMidnight = date.getTime() - KST_OFFSET_MS;
      // 시작 시각이 선택된 1시간 범위 [bandStart, bandEnd) 안에 있어야 함.
      // 종료는 자정(24:00)까지 허용 — 그래야 22~23시 슬롯에서 60분 레슨도 표시됨.
      for (let startMin = bandStartMin; startMin < bandEndMin; startMin += SLOT_STEP_MIN) {
        const endMin = startMin + duration;
        if (endMin > DAY_END_MIN) break;
        const slotStartMs = dayUtcMidnight + startMin * 60 * 1000;
        const slotEndMs = slotStartMs + duration * 60 * 1000;
        if (slotStartMs < nowMs) continue;
        const conflict = lessons.some((l) => {
          if (l.status === "CANCELLED" || l.status === "COMPLETED" || l.status === "ABSENT") {
            return false;
          }
          const lStart = parseIsoUtc(l.scheduledAt).getTime();
          const lEnd = lStart + l.durationMinutes * 60 * 1000;
          return slotStartMs < lEnd && slotEndMs > lStart;
        });
        if (conflict) continue;
        out.push({ date, startMin, endMin });
      }
    }
    return out;
  }, [loading, error, targetDate, hour, duration, lessons]);

  // 날짜별 그룹
  const groupedByDay = useMemo(() => {
    const m = new Map<string, { date: Date; slots: AvailableSlot[] }>();
    for (const s of availableSlots) {
      const key = `${s.date.getUTCFullYear()}-${s.date.getUTCMonth()}-${s.date.getUTCDate()}`;
      const cur = m.get(key);
      if (cur) cur.slots.push(s);
      else m.set(key, { date: s.date, slots: [s] });
    }
    return Array.from(m.values());
  }, [availableSlots]);

  const goPrevHour = () => setHour((h) => Math.max(HOUR_MIN, h - 1));
  const goNextHour = () => setHour((h) => Math.min(HOUR_MAX, h + 1));

  // 메시지 빌드 — 복사 / 발송 공용
  const messageText = useMemo(() => {
    if (groupedByDay.length === 0) return "";
    const lines: string[] = ["[COURTSIDE]", ""];
    for (const { date, slots } of groupedByDay) {
      const m = date.getUTCMonth() + 1;
      const d = date.getUTCDate();
      const dowK = DOW_KOR[date.getUTCDay()];
      lines.push(`${m}/${d} (${dowK}) 가능한 레슨 시간`);
      lines.push("");
      for (const s of slots) {
        lines.push(`- ${hm(s.startMin)}~${hm(s.endMin)}`);
      }
      lines.push("");
    }
    lines.push("원하시는 시간 알려주세요.");
    return lines.join("\n");
  }, [groupedByDay]);

  const canShare = availableSlots.length > 0;

  const handleCopy = async () => {
    if (!canShare) return;
    try {
      await navigator.clipboard.writeText(messageText);
      setToast({ open: true, title: "복사되었어요", description: "카톡이나 문자에 붙여넣어 사용하세요" });
    } catch {
      setAlert({
        open: true,
        title: "복사에 실패했어요",
        description: "브라우저가 클립보드를 차단했어요. 수동으로 메시지를 길게 눌러 복사해주세요.",
      });
    }
  };

  const handleStartMessaging = () => {
    if (!canShare) return;
    setPickingStudent(true);
  };

  const handleSendTo = (studentId: string) => {
    if (!canShare || sendingTo) return;
    setSendingTo(studentId);
    startTransition(async () => {
      const res = await sendAvailabilityToStudent(studentId, messageText);
      setSendingTo(null);
      if (!res.ok) {
        setAlert({ open: true, title: "메시지 발송 실패", description: res.error });
        return;
      }
      setPickingStudent(false);
      setToast({
        open: true,
        title: "메시지를 보냈어요",
        description: "학생 홈에서 코치 메시지로 확인할 수 있어요",
      });
    });
  };

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
          <div className="relative">
            <div className="w-10 h-1 rounded-full bg-line mx-auto mb-4" />
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="absolute -top-1 right-0 w-9 h-9 rounded-full text-ink-3 hover:bg-soft transition flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="text-base font-extrabold text-ink">
            {pickingStudent ? "메시지 보낼 수강생 선택" : "가능한 시간대 확인"}
          </div>
          <div className="mt-1 text-xs text-ink-3">
            {pickingStudent
              ? `${availableSlots.length}개 슬롯이 학생 홈에 메시지로 전달돼요`
              : "기간 / 시간 / 길이를 선택하면 바로 결과가 보여요"}
          </div>
        </div>

        {/* 본문 */}
        {pickingStudent ? (
          <StudentList
            students={students}
            sendingTo={sendingTo}
            onPick={handleSendTo}
            onBack={() => setPickingStudent(false)}
          />
        ) : (
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {/* 단계 인디케이터 */}
          <div className="flex items-center gap-1.5 text-[10px] font-semibold mb-3">
            <span className={step === "dow" ? "text-primary-600" : "text-ink-3"}>① 요일</span>
            <span className="text-ink-3">›</span>
            <span className={step === "hour" ? "text-primary-600" : "text-ink-3"}>② 시간대</span>
            <span className="text-ink-3">›</span>
            <span className={step === "duration" ? "text-primary-600" : "text-ink-3"}>③ 레슨 길이</span>
            <span className="text-ink-3">›</span>
            <span className={step === "result" ? "text-primary-600" : "text-ink-3"}>④ 결과</span>
          </div>

          {step === "dow" && (
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-extrabold text-ink">언제 가능한 시간을 찾으시나요?</h3>
                <p className="mt-1 text-xs text-ink-3 leading-relaxed">
                  요일을 골라주세요. 선택한 요일의 가장 가까운 날짜
                  <b className="text-ink-2"> {targetDate.getUTCMonth() + 1}월 {targetDate.getUTCDate()}일</b>
                  의 일정에서 빈 시간을 찾아요.
                </p>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {DOW_OPTIONS.map((o) => {
                  const active = o.key === dow;
                  const isWeekend = o.key === 0 || o.key === 6;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setDow(o.key)}
                      className={`h-12 rounded-lg text-sm font-bold transition active:scale-[0.97] ${
                        active
                          ? "bg-primary text-white shadow-sm"
                          : isWeekend
                            ? "bg-soft text-red-500 hover:bg-line"
                            : "bg-soft text-ink-2 hover:bg-line"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === "hour" && (
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-extrabold text-ink">어떤 시간대를 확인할까요?</h3>
                <p className="mt-1 text-xs text-ink-3 leading-relaxed">
                  화살표로 1시간 단위로 빠르게 돌려가며 확인할 수 있어요.
                  보통 학생이 묻는 시간대(예: 오전 09시, 오후 14시)부터 시작해 보세요.
                </p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={goPrevHour}
                  disabled={hour <= HOUR_MIN}
                  aria-label="이전 시간"
                  className="flex-none w-14 h-14 rounded-xl border border-line bg-surface text-ink-2 text-xl font-bold hover:bg-soft transition active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  ‹
                </button>
                <div className="flex-1 h-14 rounded-xl bg-primary/10 text-primary-700 flex items-center justify-center font-extrabold text-xl tabular-nums">
                  {String(hour).padStart(2, "0")}시 ~ {String(hour + 1).padStart(2, "0")}시
                </div>
                <button
                  type="button"
                  onClick={goNextHour}
                  disabled={hour >= HOUR_MAX}
                  aria-label="다음 시간"
                  className="flex-none w-14 h-14 rounded-xl border border-line bg-surface text-ink-2 text-xl font-bold hover:bg-soft transition active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  ›
                </button>
              </div>
            </div>
          )}

          {step === "duration" && (
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-extrabold text-ink">레슨 시간은 얼마나 되나요?</h3>
                <p className="mt-1 text-xs text-ink-3 leading-relaxed">
                  레슨 길이에 맞춰 빈 시간을 계산해요. 학생 정규 회차와 동일한 시간을 골라주세요.
                </p>
              </div>
              <ChipGrid
                options={DURATION_OPTIONS.map((d) => ({ key: String(d), label: `${d}분` }))}
                value={String(duration)}
                onChange={(v) => setDuration(Number(v))}
                cols={4}
              />
            </div>
          )}

          {step === "result" && (
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-extrabold text-ink">가능한 시간을 찾았어요</h3>
                <p className="mt-1 text-xs text-ink-3 leading-relaxed">
                  아래 시간 중에서 학생에게 제안할 시간을 골라
                  <b className="text-ink-2"> 복사하기</b> 또는
                  <b className="text-ink-2"> 메시지 보내기</b>를 누르세요.
                </p>
              </div>
              <div className="rounded-xl bg-soft px-3 py-2 text-[11px] text-ink-2 flex items-center justify-between">
                <span>
                  <b className="text-ink">{targetDate.getUTCMonth() + 1}월 {targetDate.getUTCDate()}일 ({DOW_KOR[targetDate.getUTCDay()]})</b>
                  {" · "}
                  {String(hour).padStart(2, "0")}시~{String(hour + 1).padStart(2, "0")}시 · {duration}분
                </span>
                {!loading && !error && (
                  <span className="font-bold text-primary-700">{availableSlots.length}개</span>
                )}
              </div>
              {loading ? (
                <div className="py-8 text-center text-xs text-ink-3">불러오는 중…</div>
              ) : error ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              ) : groupedByDay.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line py-8 text-center">
                  <p className="text-sm font-semibold text-ink">가능한 시간이 없어요</p>
                  <p className="mt-1 text-xs text-ink-3">
                    이전 단계에서 다른 요일/시간/길이를 시도해 보세요
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pb-2">
                  {groupedByDay.map(({ date, slots }) => {
                    const m = date.getUTCMonth() + 1;
                    const d = date.getUTCDate();
                    const dowKor = DOW_KOR[date.getUTCDay()];
                    return (
                      <div key={`${m}-${d}`}>
                        <div className="text-[11px] font-bold text-ink-2 mb-1.5">
                          {m}월 {d}일 ({dowKor})
                          <span className="ml-1.5 text-[10px] text-ink-3 font-medium">
                            {slots.length}개
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {slots.map((s) => (
                            <div
                              key={`${s.startMin}`}
                              className="rounded-lg border border-line bg-soft px-2 py-1.5 text-center text-[11px] font-semibold text-ink tabular-nums"
                            >
                              {hm(s.startMin)}~{hm(s.endMin)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {!pickingStudent && (
          <div className="px-5 pb-6 pt-3 border-t border-line flex-none space-y-2">
            {step === "result" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!canShare}
                    className="h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    복사하기
                  </button>
                  <button
                    type="button"
                    onClick={handleStartMessaging}
                    disabled={!canShare}
                    className="h-12 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                    메시지 보내기
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("duration")}
                    className="flex-1 h-11 rounded-xl border border-line bg-surface text-xs font-semibold text-ink-2 hover:bg-soft transition"
                  >
                    ‹ 이전 단계
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 h-11 rounded-xl text-xs font-semibold text-ink-3 hover:bg-soft transition"
                  >
                    닫기
                  </button>
                </div>
              </>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (step === "dow") {
                      onClose();
                      return;
                    }
                    setStep(step === "hour" ? "dow" : "hour");
                  }}
                  className="flex-1 h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition"
                >
                  {step === "dow" ? "닫기" : "‹ 이전"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (step === "dow") setStep("hour");
                    else if (step === "hour") setStep("duration");
                    else if (step === "duration") setStep("result");
                  }}
                  className="flex-1 h-12 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition active:scale-[0.99]"
                >
                  다음 ›
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Toast
        open={toast.open}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        variant="success"
        title={toast.title}
        description={toast.description}
      />
      <AlertModal
        open={alert.open}
        onClose={() => setAlert((a) => ({ ...a, open: false }))}
        variant="error"
        title={alert.title}
        description={alert.description}
      />
    </div>,
    document.body,
  );
}

// 학생 선택 (메시지 보내기 단계) — 시트 본문 영역만 교체
function StudentList({
  students,
  sendingTo,
  onPick,
  onBack,
}: {
  students: Student[];
  sendingTo: string | null;
  onPick: (studentId: string) => void;
  onBack: () => void;
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {students.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-ink">연결된 수강생이 없어요</p>
            <p className="mt-1 text-xs text-ink-3">
              학생 신청 수락 후 메시지를 보낼 수 있어요
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5 mt-1">
            {students.map((s) => {
              const pending = sendingTo === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onPick(s.id)}
                    disabled={!!sendingTo}
                    className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-soft transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm flex-none">
                      {s.name.slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-bold text-ink">{s.name}</div>
                    </div>
                    {pending && (
                      <svg className="animate-spin h-4 w-4 text-ink-3 flex-none" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="px-5 pb-6 pt-3 border-t border-line flex-none">
        <button
          type="button"
          onClick={onBack}
          disabled={!!sendingTo}
          className="w-full h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition disabled:opacity-50"
        >
          ‹ 이전
        </button>
      </div>
    </>
  );
}

function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="text-[11px] font-semibold text-ink-2">{title}</div>
        {sub && <div className="text-[10px] text-ink-3 font-medium truncate ml-2">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function ChipGrid({
  options,
  value,
  onChange,
  cols,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  cols: number;
}) {
  const gridCols = cols === 4 ? "grid-cols-4" : cols === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className={`grid ${gridCols} gap-1.5`}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`h-10 rounded-lg text-xs font-bold transition active:scale-[0.97] ${
              active ? "bg-primary text-white shadow-sm" : "bg-soft text-ink-2 hover:bg-line"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- 유틸 ----------

function todayKstTrick(): Date {
  const nowKst = new Date(Date.now() + KST_OFFSET_MS);
  return new Date(Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

/** 선택된 요일(dow)의 가장 가까운 미래 날짜 — 오늘이 해당 요일이면 오늘 반환 */
function nextDateForDow(dow: DowKey): Date {
  const today = todayKstTrick();
  const todayDow = today.getUTCDay();
  const diff = (dow - todayDow + 7) % 7;
  return addDays(today, diff);
}

function hm(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
