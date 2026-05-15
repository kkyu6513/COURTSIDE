"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertModal } from "@/components/alert-modal";
import { EmptySlotSheet } from "@/components/coach/empty-slot-sheet";
import { toggleHourSlot } from "@/app/coach/schedule/actions";

type ScheduleSlot = {
  dayOfWeek: number; // 0=일 ... 6=토
  slotTime: string; // "HH:MM"
  isRecurring: boolean;
};

type Props = {
  schedules: ScheduleSlot[];
};

const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06 ~ 22

function startOfWeekMon(d: Date): Date {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const dow = kst.getUTCDay();
  const offsetToMon = (dow + 6) % 7;
  const mon = new Date(kst);
  mon.setUTCDate(mon.getUTCDate() - offsetToMon);
  mon.setUTCHours(0, 0, 0, 0);
  return mon;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatKstDate(d: Date) {
  return {
    m: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    dow: d.getUTCDay(),
  };
}

export function WeeklyTimetable({ schedules }: Props) {
  const router = useRouter();
  // 주의 시작(월요일) 기준 state
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMon(new Date()));
  // 낙관적 슬롯 state — 클릭 즉시 반영, 서버 실패 시 롤백
  const [localSlots, setLocalSlots] = useState<ScheduleSlot[]>(schedules);
  const [, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ open: boolean; title: string; description?: string }>({
    open: false,
    title: "",
  });
  const [sheet, setSheet] = useState<{
    open: boolean;
    dayOfWeek: number;
    hour: number;
    date: Date;
  } | null>(null);

  const weekDays = useMemo(() => {
    const days: { date: Date; m: number; day: number; dowKor: string; isToday: boolean }[] = [];
    const today = formatKstDate(startOfWeekMon(new Date()));
    const todayKey = `${today.m}-${today.day}`;
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const f = formatKstDate(d);
      days.push({
        date: d,
        m: f.m,
        day: f.day,
        dowKor: DOW_KOR[(weekStart.getUTCDay() + i) % 7],
        isToday: false, // 단순 비교: 오늘 표기는 컴포넌트에서 다시 계산
      });
    }
    // 오늘 마킹: 현재 KST 일자와 일치
    const nowKst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    const yyyy = nowKst.getUTCFullYear();
    const mm = nowKst.getUTCMonth();
    const dd = nowKst.getUTCDate();
    days.forEach((wd) => {
      if (
        wd.date.getUTCFullYear() === yyyy &&
        wd.date.getUTCMonth() === mm &&
        wd.date.getUTCDate() === dd
      ) {
        wd.isToday = true;
      }
    });
    return days;
  }, [weekStart]);

  // 슬롯을 (dayOfWeek, hour) 키로 그룹
  const slotByDayHour = useMemo(() => {
    const m = new Map<string, ScheduleSlot[]>();
    for (const s of localSlots) {
      const hour = parseInt(s.slotTime.slice(0, 2), 10);
      const key = `${s.dayOfWeek}-${hour}`;
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    return m;
  }, [localSlots]);

  const onCellClick = (dayOfWeek: number, hour: number, date: Date) => {
    if (pendingKey) return;
    setSheet({ open: true, dayOfWeek, hour, date });
  };

  const closeSheet = () => setSheet((s) => (s ? { ...s, open: false } : null));

  const runToggleAvailability = () => {
    if (!sheet) return;
    const { dayOfWeek, hour } = sheet;
    const key = `${dayOfWeek}-${hour}`;
    const hh = String(hour).padStart(2, "0");
    const hasSlot = (slotByDayHour.get(key)?.length ?? 0) > 0;

    // 낙관적 업데이트
    if (hasSlot) {
      setLocalSlots((prev) => prev.filter((s) => !(s.dayOfWeek === dayOfWeek && s.slotTime.startsWith(`${hh}:`))));
    } else {
      const added: ScheduleSlot[] = [];
      for (let m = 0; m < 60; m += 10) {
        const mm = String(m).padStart(2, "0");
        added.push({ dayOfWeek, slotTime: `${hh}:${mm}`, isRecurring: true });
      }
      setLocalSlots((prev) => [...prev, ...added]);
    }
    setPendingKey(key);
    closeSheet();

    startTransition(async () => {
      const res = await toggleHourSlot(dayOfWeek, hour);
      setPendingKey(null);
      if (!res.ok) {
        setLocalSlots(schedules);
        setAlert({ open: true, title: "저장 실패", description: res.error });
        return;
      }
      router.refresh();
    });
  };

  const weekStartLabel = formatKstDate(weekStart);
  const weekEnd = addDays(weekStart, 6);
  const weekEndLabel = formatKstDate(weekEnd);
  const yearMonthLabel = `${weekStart.getUTCFullYear()}년 ${weekStartLabel.m}월`;
  const weekRangeLabel = `${weekStartLabel.m}/${weekStartLabel.day} ~ ${weekEndLabel.m}/${weekEndLabel.day}`;

  const goPrevWeek = () => setWeekStart((d) => addDays(d, -7));
  const goNextWeek = () => setWeekStart((d) => addDays(d, 7));

  return (
    <div className="flex flex-col">
      {/* 월/주 네비 */}
      <div className="border-b border-line">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-extrabold text-ink">{yearMonthLabel}</div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrevWeek}
              className="w-8 h-8 rounded-lg border border-line bg-surface text-sm text-ink-2 hover:bg-soft transition"
              aria-label="이전주"
            >
              ‹
            </button>
            <span className="text-xs font-semibold text-ink-2 px-2">{weekRangeLabel}</span>
            <button
              type="button"
              onClick={goNextWeek}
              className="w-8 h-8 rounded-lg border border-line bg-surface text-sm text-ink-2 hover:bg-soft transition"
              aria-label="다음주"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* 주간 헤더 */}
      <div className="px-3 pt-2 pb-1 border-b border-line bg-surface">
        <div className="grid grid-cols-[36px_repeat(7,1fr)] gap-0">
          <div />
          {weekDays.map((wd, i) => (
            <div key={i} className="text-center py-1.5">
              <div className={`text-[10px] ${wd.isToday ? "text-primary" : "text-ink-3"}`}>{wd.dowKor}</div>
              <div
                className={`mx-auto mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  wd.isToday ? "bg-primary text-white" : "text-ink"
                }`}
              >
                {wd.day}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 타임테이블 */}
      <div className="px-3">
        <div className="grid grid-cols-[36px_repeat(7,1fr)] gap-0">
          {HOURS.map((h) => (
            <RowGroup
              key={h}
              hour={h}
              weekDays={weekDays}
              slotByDayHour={slotByDayHour}
              onCellClick={onCellClick}
              pendingKey={pendingKey}
            />
          ))}
        </div>

        <p className="mt-3 text-[11px] text-ink-3 px-1">
          시간 칸을 탭하면 레슨 받기·닫기 / 레슨 잡기 / 시간 블록 옵션이 표시됩니다.
        </p>

        {/* 범례 */}
        <div className="mt-3 mb-6 flex flex-wrap gap-x-3 gap-y-1.5 p-3 bg-soft rounded-xl">
          <LegendItem color="bg-emerald-100 border-emerald-200" label="레슨 확정" />
          <LegendItem color="bg-amber-100 border-amber-200" label="대기 신청" />
          <LegendItem color="bg-violet-100 border-violet-200" label="레슨 예정" />
          <LegendItem color="bg-orange-100 border-orange-200" label="변경 요청" />
          <LegendItem color="bg-blue-100 border-blue-200" label="완료" />
          <LegendItem color="bg-primary/10 border-primary/30" label="레슨 받는 시간" />
          <LegendItem color="bg-surface border-line" label="안 받는 시간" />
        </div>
      </div>

      <AlertModal
        open={alert.open}
        onClose={() => setAlert((a) => ({ ...a, open: false }))}
        variant="error"
        title={alert.title}
        description={alert.description}
      />

      {sheet && (
        <EmptySlotSheet
          open={sheet.open}
          onClose={closeSheet}
          timeLabel={(() => {
            const f = formatKstDate(sheet.date);
            const hh = String(sheet.hour).padStart(2, "0");
            return `${f.m}월 ${f.day}일 ${DOW_KOR[f.dow]}요일 · ${hh}:00`;
          })()}
          hasSlot={(slotByDayHour.get(`${sheet.dayOfWeek}-${sheet.hour}`)?.length ?? 0) > 0}
          pending={pendingKey === `${sheet.dayOfWeek}-${sheet.hour}`}
          onToggleAvailability={runToggleAvailability}
        />
      )}
    </div>
  );
}

function RowGroup({
  hour,
  weekDays,
  slotByDayHour,
  onCellClick,
  pendingKey,
}: {
  hour: number;
  weekDays: { date: Date; isToday: boolean }[];
  slotByDayHour: Map<string, ScheduleSlot[]>;
  onCellClick: (dayOfWeek: number, hour: number, date: Date) => void;
  pendingKey: string | null;
}) {
  const hourLabel = `${String(hour).padStart(2, "0")}:00`;
  return (
    <>
      <div className="text-[10px] text-ink-3 text-right pr-1.5 pt-1 border-t border-line">
        {hourLabel}
      </div>
      {weekDays.map((wd, i) => {
        const dow = wd.date.getUTCDay();
        const key = `${dow}-${hour}`;
        const slots = slotByDayHour.get(key) ?? [];
        const hasSlot = slots.length > 0;
        const isPending = pendingKey === key;
        return (
          <button
            type="button"
            key={i}
            onClick={() => onCellClick(dow, hour, wd.date)}
            disabled={isPending}
            className={`h-9 border-t border-line border-l border-line/60 transition active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:relative ${
              hasSlot
                ? "bg-primary/15 hover:bg-primary/25"
                : "bg-surface hover:bg-soft"
            } ${isPending ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
            aria-label={`${hourLabel} ${hasSlot ? "레슨 받는 시간" : "안 받는 시간"} 옵션`}
          />
        );
      })}
    </>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block w-2.5 h-2.5 rounded-sm border ${color}`} />
      <span className="text-[10px] text-ink-3">{label}</span>
    </div>
  );
}

export function ScheduleManageEmptyHint() {
  return (
    <Link
      href="/onboarding/coach/schedule"
      className="mx-3 mt-3 mb-1 flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-3 transition active:scale-[0.99]"
    >
      <div className="min-w-0">
        <div className="text-xs font-semibold text-ink">레슨 받을 시간을 등록하세요</div>
        <div className="mt-0.5 text-[11px] text-ink-3">
          요일별로 한 번 등록하면 매주 같은 시간에 자동 반영됩니다.
        </div>
      </div>
      <span className="text-ink-3 flex-none">›</span>
    </Link>
  );
}
