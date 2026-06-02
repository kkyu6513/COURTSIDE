"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { KST_OFFSET_MS, parseIsoUtc } from "@/lib/kst";

type Lesson = {
  id: number;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
};

type RangeKey = "today" | "tomorrow" | "thisWeek" | "nextWeek";
type TimeBandKey = "morning" | "afternoon" | "evening" | "all";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "tomorrow", label: "내일" },
  { key: "thisWeek", label: "이번 주" },
  { key: "nextWeek", label: "다음 주" },
];

const TIME_BAND_OPTIONS: { key: TimeBandKey; label: string; startHour: number; endHour: number }[] = [
  { key: "morning", label: "오전 (06~12시)", startHour: 6, endHour: 12 },
  { key: "afternoon", label: "오후 (12~18시)", startHour: 12, endHour: 18 },
  { key: "evening", label: "저녁 (18~22시)", startHour: 18, endHour: 22 },
  { key: "all", label: "전체 (06~22시)", startHour: 6, endHour: 22 },
];

const DURATION_OPTIONS = [30, 60, 90];
const SLOT_STEP_MIN = 30; // 30분 단위 슬롯 후보 생성

const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];

type Props = {
  open: boolean;
  onClose: () => void;
};

type AvailableSlot = {
  date: Date;       // KST trick
  startMin: number; // KST 자정 기준 분
  endMin: number;
};

export function AvailabilitySheet({ open, onClose }: Props) {
  const [step, setStep] = useState<"select" | "result">("select");
  const [range, setRange] = useState<RangeKey>("today");
  const [timeBand, setTimeBand] = useState<TimeBandKey>("all");
  const [duration, setDuration] = useState<number>(60);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 시트 열릴 때 초기화 + lessons fetch
  useEffect(() => {
    if (!open) return;
    setStep("select");
    setRange("today");
    setTimeBand("all");
    setDuration(60);
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

  // 결과 — 선택된 조건으로 가능 시간 슬롯 계산
  const availableSlots = useMemo<AvailableSlot[]>(() => {
    if (step !== "result") return [];
    const band = TIME_BAND_OPTIONS.find((b) => b.key === timeBand)!;
    const dates = getDateRange(range);
    const out: AvailableSlot[] = [];
    const nowMs = Date.now();
    for (const date of dates) {
      const dayUtcMidnight = date.getTime() - KST_OFFSET_MS;
      // 30분 단위 슬롯 후보
      for (
        let startMin = band.startHour * 60;
        startMin + duration <= band.endHour * 60;
        startMin += SLOT_STEP_MIN
      ) {
        const slotStartMs = dayUtcMidnight + startMin * 60 * 1000;
        const slotEndMs = slotStartMs + duration * 60 * 1000;
        // 과거 시각 제외
        if (slotStartMs < nowMs) continue;
        // 충돌 검사
        const conflict = lessons.some((l) => {
          if (l.status === "CANCELLED" || l.status === "COMPLETED" || l.status === "ABSENT") {
            return false;
          }
          const lStart = parseIsoUtc(l.scheduledAt).getTime();
          const lEnd = lStart + l.durationMinutes * 60 * 1000;
          return slotStartMs < lEnd && slotEndMs > lStart;
        });
        if (conflict) continue;
        out.push({
          date,
          startMin,
          endMin: startMin + duration,
        });
      }
    }
    return out;
  }, [step, range, timeBand, duration, lessons]);

  // 결과 날짜별 그룹
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
            {step === "select" ? "가능한 시간대 확인" : "가능한 시간"}
          </div>
          <div className="mt-1 text-xs text-ink-3">
            {step === "select"
              ? "기간과 시간대, 레슨 길이를 선택하세요"
              : `${rangeLabel(range)} · ${TIME_BAND_OPTIONS.find((b) => b.key === timeBand)?.label} · ${duration}분`}
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {step === "select" ? (
            <div className="space-y-4">
              <Section title="기간">
                <ChipGrid
                  options={RANGE_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
                  value={range}
                  onChange={(v) => setRange(v as RangeKey)}
                  cols={4}
                />
              </Section>

              <Section title="시간대">
                <ChipGrid
                  options={TIME_BAND_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
                  value={timeBand}
                  onChange={(v) => setTimeBand(v as TimeBandKey)}
                  cols={2}
                />
              </Section>

              <Section title="레슨 길이">
                <ChipGrid
                  options={DURATION_OPTIONS.map((d) => ({ key: String(d), label: `${d}분` }))}
                  value={String(duration)}
                  onChange={(v) => setDuration(Number(v))}
                  cols={3}
                />
              </Section>
            </div>
          ) : (
            <div>
              {loading ? (
                <div className="py-10 text-center text-xs text-ink-3">불러오는 중…</div>
              ) : error ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              ) : groupedByDay.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-semibold text-ink">가능한 시간이 없어요</p>
                  <p className="mt-1 text-xs text-ink-3">
                    기간이나 시간대를 넓혀서 다시 시도해 보세요
                  </p>
                </div>
              ) : (
                <div className="space-y-4 pb-2">
                  {groupedByDay.map(({ date, slots }) => {
                    const m = date.getUTCMonth() + 1;
                    const d = date.getUTCDate();
                    const dow = DOW_KOR[date.getUTCDay()];
                    return (
                      <div key={`${m}-${d}`}>
                        <div className="text-xs font-bold text-ink-2 mb-2">
                          {m}월 {d}일 ({dow})
                          <span className="ml-1.5 text-[11px] text-ink-3 font-medium">
                            {slots.length}개 슬롯
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

        <div className="px-5 pb-6 pt-3 border-t border-line flex-none space-y-2">
          {step === "select" ? (
            <>
              <button
                type="button"
                onClick={() => setStep("result")}
                disabled={loading}
                className="w-full h-12 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? "불러오는 중…" : "가능한 시간 보기"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition"
              >
                닫기
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep("select")}
                className="w-full h-12 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition active:scale-[0.99]"
              >
                다시 선택하기
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition"
              >
                닫기
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-ink-2 mb-1.5">{title}</div>
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
  // KST trick — getTime()이 KST midnight + 9h ms 가 되는 Date
  const nowKst = new Date(Date.now() + KST_OFFSET_MS);
  return new Date(Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

function getDateRange(range: RangeKey): Date[] {
  const today = todayKstTrick();
  if (range === "today") return [today];
  if (range === "tomorrow") return [addDays(today, 1)];
  // 이번 주: today부터 이번 주 일요일까지 (월요일 기준 주)
  const dow = today.getUTCDay(); // 0=일
  const daysToSun = (7 - dow) % 7; // 일요일까지 남은 일수
  if (range === "thisWeek") {
    const arr: Date[] = [];
    for (let i = 0; i <= daysToSun; i++) arr.push(addDays(today, i));
    return arr;
  }
  // 다음 주 월~일
  const nextMon = addDays(today, daysToSun + 1);
  const arr: Date[] = [];
  for (let i = 0; i < 7; i++) arr.push(addDays(nextMon, i));
  return arr;
}

function hm(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function rangeLabel(r: RangeKey): string {
  switch (r) {
    case "today": return "오늘";
    case "tomorrow": return "내일";
    case "thisWeek": return "이번 주";
    case "nextWeek": return "다음 주";
  }
}
