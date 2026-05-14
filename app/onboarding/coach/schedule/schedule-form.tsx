"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  TIME_SLOTS,
  DAY_NAMES,
  DAY_NAMES_FULL,
  type TimeSlot,
} from "@/lib/time-slots";
import { submitSchedule } from "./actions";

type DayMap = Record<number, Set<string>>;

const emptyMap = (): DayMap => ({
  0: new Set(),
  1: new Set(),
  2: new Set(),
  3: new Set(),
  4: new Set(),
  5: new Set(),
  6: new Set(),
});

export function ScheduleForm() {
  const router = useRouter();
  const [data, setData] = useState<DayMap>(emptyMap);
  const [currentDay, setCurrentDay] = useState(1);
  const [isRecurring, setIsRecurring] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalCount = Object.values(data).reduce((sum, s) => sum + s.size, 0);
  const currentSet = data[currentDay];

  const toggleSlot = (code: string) => {
    setData((prev) => {
      const next = { ...prev };
      const s = new Set(next[currentDay]);
      if (s.has(code)) s.delete(code);
      else s.add(code);
      next[currentDay] = s;
      return next;
    });
  };

  const clearDay = (day: number) => {
    setData((prev) => ({ ...prev, [day]: new Set<string>() }));
  };

  const onSubmit = () => {
    if (totalCount === 0) {
      setError("스케줄을 최소 1개 등록해주세요");
      return;
    }
    setError(null);

    const schedules: Array<{
      dayOfWeek: number;
      slotTime: string;
      isRecurring: boolean;
    }> = [];

    for (let d = 0; d < 7; d++) {
      for (const code of data[d]) {
        const slot = [...TIME_SLOTS.AM, ...TIME_SLOTS.PM, ...TIME_SLOTS.EVENING].find(
          (s) => s.code === code,
        );
        if (slot) {
          schedules.push({
            dayOfWeek: d,
            slotTime: slot.label,
            isRecurring,
          });
        }
      }
    }

    startTransition(async () => {
      const res = await submitSchedule(schedules);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.push("/");
    });
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-3rem)]">
      {pending && <FormPendingIndicatorStandalone />}

      <div className="px-5 pt-5 pb-3">
        <h1 className="text-xl font-bold text-ink leading-snug">
          레슨 가능한 시간을
          <br />
          등록해주세요
        </h1>
        <p className="mt-1.5 text-sm text-ink-2">
          요일을 선택하고, 레슨 가능한 시:분을 탭하세요
        </p>
      </div>

      {/* 요일 탭 */}
      <div className="flex border-b border-line px-3">
        {DAY_NAMES.map((name, day) => {
          const hasSlots = data[day].size > 0;
          const active = currentDay === day;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setCurrentDay(day)}
              className={`flex-1 py-2.5 text-sm font-semibold transition border-b-2 ${
                active
                  ? "text-emerald-500 border-emerald-500"
                  : "text-ink-3 border-transparent"
              }`}
            >
              {name}
              <div className="mt-1 h-1.5 flex items-center justify-center">
                {hasSlots && (
                  <span className="block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 슬롯 그리드 */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-sm font-semibold text-ink">
            {DAY_NAMES_FULL[currentDay]} 레슨 시간
          </div>
          <div className="text-xs text-ink-3">
            선택:{" "}
            <span className="text-emerald-500 font-semibold">
              {currentSet.size}
            </span>
            개
          </div>
        </div>

        <SlotGroup label="오전" slots={TIME_SLOTS.AM} selected={currentSet} onToggle={toggleSlot} />
        <SlotGroup label="오후" slots={TIME_SLOTS.PM} selected={currentSet} onToggle={toggleSlot} />
        <SlotGroup label="저녁" slots={TIME_SLOTS.EVENING} selected={currentSet} onToggle={toggleSlot} />
      </div>

      {/* 매주 반복 */}
      <div className="px-5 pb-4">
        <button
          type="button"
          onClick={() => setIsRecurring((v) => !v)}
          className="w-full flex items-center justify-between p-3.5 bg-soft rounded-xl text-left"
        >
          <div>
            <div className="text-sm font-semibold text-ink">매주 반복</div>
            <div className="text-xs text-ink-3 mt-0.5">
              선택한 시간이 매주 반복됩니다
            </div>
          </div>
          <span
            className={`relative w-12 h-7 rounded-full transition ${
              isRecurring ? "bg-emerald-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
                isRecurring ? "left-[22px]" : "left-0.5"
              }`}
            />
          </span>
        </button>
      </div>

      {/* 등록 요약 */}
      <div className="px-5 pb-4">
        <div className="text-sm font-semibold text-ink mb-2.5">
          등록 요약{" "}
          <span className="text-emerald-500">{totalCount}</span>건
        </div>
        {totalCount === 0 ? (
          <div className="text-center py-5 text-xs text-ink-3">
            요일별 시간을 선택하면 여기에 표시됩니다
          </div>
        ) : (
          <div className="space-y-1.5">
            {Array.from({ length: 7 }, (_, d) => d)
              .filter((d) => data[d].size > 0)
              .map((d) => (
                <DaySummaryRow
                  key={d}
                  day={d}
                  slots={data[d]}
                  onClear={() => clearDay(d)}
                />
              ))}
          </div>
        )}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="px-5 pb-2">
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <div className="mt-auto sticky bottom-0 bg-bg border-t border-line px-5 pt-3 pb-8">
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="w-full h-12 rounded-xl bg-ink text-white font-semibold text-sm transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {pending && <Spinner />}
          {pending ? "등록 중…" : "등록 완료"}
        </button>
      </div>
    </div>
  );
}

function SlotGroup({
  label,
  slots,
  selected,
  onToggle,
}: {
  label: string;
  slots: TimeSlot[];
  selected: Set<string>;
  onToggle: (code: string) => void;
}) {
  return (
    <div className="mb-3">
      <div className="text-xs text-ink-3 mb-1.5">{label}</div>
      <div className="grid grid-cols-4 gap-1.5">
        {slots.map((slot) => {
          const active = selected.has(slot.code);
          return (
            <button
              key={slot.code}
              type="button"
              onClick={() => onToggle(slot.code)}
              className={`py-2 rounded-lg text-xs font-semibold border transition ${
                active
                  ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                  : "border-line bg-surface text-ink-2"
              }`}
            >
              {slot.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DaySummaryRow({
  day,
  slots,
  onClear,
}: {
  day: number;
  slots: Set<string>;
  onClear: () => void;
}) {
  const allSlots = [...TIME_SLOTS.AM, ...TIME_SLOTS.PM, ...TIME_SLOTS.EVENING];
  const labels = [...slots]
    .map((code) => allSlots.find((s) => s.code === code)?.label)
    .filter((x): x is string => !!x)
    .sort();

  return (
    <div className="flex items-center gap-2.5 p-3 bg-surface rounded-xl border border-line">
      <div className="w-8 h-8 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center flex-none">
        {DAY_NAMES[day]}
      </div>
      <div className="flex-1 flex flex-wrap gap-1">
        {labels.map((l) => (
          <span
            key={l}
            className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 font-semibold"
          >
            {l}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label="요일 슬롯 전체 삭제"
        className="text-ink-3 hover:text-ink p-1"
      >
        ✕
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4zm2 5.3A7.96 7.96 0 014 12H0c0 3 1.1 5.8 3 7.9l3-2.6z"
      />
    </svg>
  );
}

function FormPendingIndicatorStandalone() {
  // useTransition 사용 시 form 밖이라 FormPendingIndicator의 useFormStatus가 안 됨.
  // 상단 진행 바를 직접 portal 없이 fixed로 그림.
  return (
    <div
      className="courtside-progress-bar"
      aria-hidden
      style={{ position: "fixed" }}
    />
  );
}
