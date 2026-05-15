"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertModal } from "@/components/alert-modal";
import { EmptySlotSheet } from "@/components/coach/empty-slot-sheet";
import { StudentPickerSheet, type StudentOption } from "@/components/coach/student-picker-sheet";
import { bookLesson } from "@/app/coach/schedule/actions";

export type LessonRow = {
  id: number;
  studentId: string;
  scheduledAt: string; // ISO
  durationMinutes: number;
  status: "CONFIRMED" | "PENDING" | "UPCOMING" | "CHANGE_REQUEST" | "COMPLETED" | "CANCELLED";
};

type Props = {
  lessons?: LessonRow[];
  students?: StudentOption[];
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
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    dow: d.getUTCDay(),
  };
}

/** lesson.scheduledAt → KST 기준 (year, month, day, hour) 키 생성 */
function lessonCellKey(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${kst.getUTCMonth() + 1}-${kst.getUTCDate()}-${kst.getUTCHours()}`;
}

/** 캘린더 셀 → 클릭 시 그 셀이 가리키는 KST 시각 ISO 반환 */
function cellToIso(date: Date, hour: number): string {
  // date는 이미 startOfWeekMon에서 만든 KST 자정 + i일치
  // 그 날짜의 hour시(KST) → UTC로 변환해서 ISO
  const utc = new Date(date);
  utc.setUTCHours(hour - 9, 0, 0, 0); // KST = UTC+9
  return utc.toISOString();
}

function statusToClass(status: LessonRow["status"]): string {
  switch (status) {
    case "CONFIRMED":
      return "bg-emerald-100 hover:bg-emerald-200";
    case "PENDING":
      return "bg-amber-100 hover:bg-amber-200";
    case "UPCOMING":
      return "bg-violet-100 hover:bg-violet-200";
    case "CHANGE_REQUEST":
      return "bg-orange-100 hover:bg-orange-200";
    case "COMPLETED":
      return "bg-blue-100 hover:bg-blue-200";
    case "CANCELLED":
      return "bg-soft hover:bg-soft cursor-not-allowed line-through";
  }
}

export function WeeklyTimetable({ lessons = [], students = [] }: Props) {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMon(new Date()));
  const [sheet, setSheet] = useState<{
    open: boolean;
    dayOfWeek: number;
    hour: number;
    date: Date;
  } | null>(null);
  const [studentPicker, setStudentPicker] = useState<{
    open: boolean;
    iso: string;
    timeLabel: string;
  } | null>(null);
  const [pendingStudentId, setPendingStudentId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [alert, setAlert] = useState<{ open: boolean; variant: "error" | "success"; title: string; description?: string }>({
    open: false,
    variant: "success",
    title: "",
  });

  const weekDays = useMemo(() => {
    const days: { date: Date; m: number; day: number; dowKor: string; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const f = formatKstDate(d);
      days.push({
        date: d,
        m: f.m,
        day: f.day,
        dowKor: DOW_KOR[(weekStart.getUTCDay() + i) % 7],
        isToday: false,
      });
    }
    const nowKst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    days.forEach((wd) => {
      if (
        wd.date.getUTCFullYear() === nowKst.getUTCFullYear() &&
        wd.date.getUTCMonth() === nowKst.getUTCMonth() &&
        wd.date.getUTCDate() === nowKst.getUTCDate()
      ) {
        wd.isToday = true;
      }
    });
    return days;
  }, [weekStart]);

  const lessonByCell = useMemo(() => {
    const m = new Map<string, LessonRow>();
    for (const l of lessons) {
      m.set(lessonCellKey(l.scheduledAt), l);
    }
    return m;
  }, [lessons]);

  const weekStartLabel = formatKstDate(weekStart);
  const weekEnd = addDays(weekStart, 6);
  const weekEndLabel = formatKstDate(weekEnd);
  const yearMonthLabel = `${weekStart.getUTCFullYear()}년 ${weekStartLabel.m}월`;
  const weekRangeLabel = `${weekStartLabel.m}/${weekStartLabel.day} ~ ${weekEndLabel.m}/${weekEndLabel.day}`;

  const goPrevWeek = () => setWeekStart((d) => addDays(d, -7));
  const goNextWeek = () => setWeekStart((d) => addDays(d, 7));

  const onCellClick = (dayOfWeek: number, hour: number, date: Date) => {
    setSheet({ open: true, dayOfWeek, hour, date });
  };

  const closeSheet = () => setSheet((s) => (s ? { ...s, open: false } : null));

  const onBookLessonAction = () => {
    if (!sheet) return;
    const f = formatKstDate(sheet.date);
    const hh = String(sheet.hour).padStart(2, "0");
    const timeLabel = `${f.m}월 ${f.day}일 ${DOW_KOR[f.dow]}요일 · ${hh}:00`;
    const iso = cellToIso(sheet.date, sheet.hour);
    closeSheet();
    setStudentPicker({ open: true, iso, timeLabel });
  };

  const closeStudentPicker = () =>
    setStudentPicker((s) => (s ? { ...s, open: false } : null));

  const onPickStudent = (studentId: string) => {
    if (!studentPicker) return;
    setPendingStudentId(studentId);
    startTransition(async () => {
      const res = await bookLesson(studentId, studentPicker.iso, 60);
      setPendingStudentId(null);
      if (!res.ok) {
        setAlert({
          open: true,
          variant: "error",
          title: "레슨 등록 실패",
          description: res.error,
        });
        return;
      }
      setStudentPicker(null);
      setAlert({
        open: true,
        variant: "success",
        title: "레슨이 등록되었어요",
        description: `${studentPicker.timeLabel}에 레슨이 잡혔습니다.`,
      });
      router.refresh();
    });
  };

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
              lessonByCell={lessonByCell}
              onCellClick={onCellClick}
            />
          ))}
        </div>

        <p className="mt-3 text-[11px] text-ink-3 px-1">
          빈 시간을 탭하면 그 시간에 레슨을 잡거나 일정을 차단할 수 있어요.
        </p>

        {/* 범례 */}
        <div className="mt-3 mb-6 flex flex-wrap gap-x-3 gap-y-1.5 p-3 bg-soft rounded-xl">
          <LegendItem color="bg-emerald-100 border-emerald-200" label="레슨 확정" />
          <LegendItem color="bg-amber-100 border-amber-200" label="대기 신청" />
          <LegendItem color="bg-violet-100 border-violet-200" label="레슨 예정" />
          <LegendItem color="bg-orange-100 border-orange-200" label="변경 요청" />
          <LegendItem color="bg-blue-100 border-blue-200" label="완료" />
          <LegendItem color="bg-soft border-line" label="취소" />
          <LegendItem color="bg-surface border-line" label="빈 시간" />
        </div>
      </div>

      {sheet && (
        <EmptySlotSheet
          open={sheet.open}
          onClose={closeSheet}
          timeLabel={(() => {
            const f = formatKstDate(sheet.date);
            const hh = String(sheet.hour).padStart(2, "0");
            return `${f.m}월 ${f.day}일 ${DOW_KOR[f.dow]}요일 · ${hh}:00`;
          })()}
          onBookLesson={onBookLessonAction}
        />
      )}

      {studentPicker && (
        <StudentPickerSheet
          open={studentPicker.open}
          onClose={closeStudentPicker}
          timeLabel={studentPicker.timeLabel}
          students={students}
          pendingStudentId={pendingStudentId}
          onPick={onPickStudent}
        />
      )}

      <AlertModal
        open={alert.open}
        onClose={() => setAlert((a) => ({ ...a, open: false }))}
        variant={alert.variant}
        title={alert.title}
        description={alert.description}
      />
    </div>
  );
}

function RowGroup({
  hour,
  weekDays,
  lessonByCell,
  onCellClick,
}: {
  hour: number;
  weekDays: { date: Date; isToday: boolean }[];
  lessonByCell: Map<string, LessonRow>;
  onCellClick: (dayOfWeek: number, hour: number, date: Date) => void;
}) {
  const hourLabel = `${String(hour).padStart(2, "0")}:00`;
  return (
    <>
      <div className="text-[10px] text-ink-3 text-right pr-1.5 pt-1 border-t border-line">
        {hourLabel}
      </div>
      {weekDays.map((wd, i) => {
        const dow = wd.date.getUTCDay();
        const f = formatKstDate(wd.date);
        const key = `${f.y}-${f.m}-${f.day}-${hour}`;
        const lesson = lessonByCell.get(key);
        const hasLesson = !!lesson;
        return (
          <button
            type="button"
            key={i}
            onClick={() => onCellClick(dow, hour, wd.date)}
            className={`h-9 border-t border-line border-l border-line/60 transition active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:relative cursor-pointer ${
              hasLesson ? statusToClass(lesson!.status) : "bg-surface hover:bg-soft"
            }`}
            aria-label={`${hourLabel} ${hasLesson ? "레슨 있음" : "빈 시간"} 옵션`}
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
