"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertModal } from "@/components/alert-modal";
import { EmptySlotSheet } from "@/components/coach/empty-slot-sheet";
import { StudentPickerSheet, type StudentOption } from "@/components/coach/student-picker-sheet";
import { LessonDetailSheet, type LessonDetail } from "@/components/coach/lesson-detail-sheet";
import { LessonListSheet } from "@/components/coach/lesson-list-sheet";
import { bookLesson, cancelLesson } from "@/app/coach/schedule/actions";

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

/** Supabase가 timezone 없는 timestamp("...T23:00:00") 반환 가능 — UTC로 강제 해석 */
function parseIsoUtc(s: string): Date {
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + "Z");
}

/** lesson.scheduledAt → KST 기준 (year, month, day, hour) 키 생성 */
function lessonCellKey(iso: string): string {
  const d = parseIsoUtc(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${kst.getUTCMonth() + 1}-${kst.getUTCDate()}-${kst.getUTCHours()}`;
}

/** 캘린더 셀 → 클릭 시 그 셀이 가리키는 KST 시각 ISO 반환 (분 옵션) */
function cellToIso(date: Date, hour: number, minute: number = 0): string {
  const utc = new Date(date);
  utc.setUTCHours(hour - 9, minute, 0, 0); // KST = UTC+9
  return utc.toISOString();
}

/** hour 셀이 60분 안에 lessons로 가득 차 있는지 (분 점유 union 60 이상) */
function isHourFull(lessons: LessonRow[]): boolean {
  if (lessons.length === 0) return false;
  const intervals: Array<[number, number]> = [];
  for (const l of lessons) {
    if (l.status === "CANCELLED") continue;
    const kst = new Date(parseIsoUtc(l.scheduledAt).getTime() + 9 * 60 * 60 * 1000);
    const startMin = kst.getUTCMinutes();
    const endMin = startMin + l.durationMinutes;
    intervals.push([Math.max(0, startMin), Math.min(60, endMin)]);
  }
  if (intervals.length === 0) return false;
  intervals.sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let lastEnd = 0;
  for (const [s, e] of intervals) {
    if (e <= lastEnd) continue;
    covered += e - Math.max(s, lastEnd);
    lastEnd = e;
  }
  return covered >= 60;
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

export function WeeklyTimetable({ lessons: initialLessons = [], students: initialStudents = [] }: Props) {
  const router = useRouter();

  // 클라이언트 fetch — 항상 fresh. 서버 RSC 캐시 layer 무관.
  const [lessons, setLessons] = useState<LessonRow[]>(initialLessons);
  const [students, setStudents] = useState<StudentOption[]>(initialStudents);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/coach/lessons", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setLoadError(body.error || `HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { lessons: LessonRow[]; students: StudentOption[] };
      setLessons(data.lessons ?? []);
      setStudents(data.students ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMon(new Date()));
  const [sheet, setSheet] = useState<{
    open: boolean;
    dayOfWeek: number;
    hour: number;
    date: Date;
  } | null>(null);
  const [studentPicker, setStudentPicker] = useState<{
    open: boolean;
    date: Date;
    hour: number;
    baseTimeLabel: string;
  } | null>(null);
  const [lessonDetail, setLessonDetail] = useState<{ open: boolean; lesson: LessonDetail } | null>(null);
  const [lessonList, setLessonList] = useState<{
    open: boolean;
    hourLabel: string;
    lessons: LessonDetail[];
    date: Date;
    hour: number;
  } | null>(null);
  const [pendingStudentId, setPendingStudentId] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState(false);
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
    const m = new Map<string, LessonRow[]>();
    for (const l of lessons) {
      const key = lessonCellKey(l.scheduledAt);
      const arr = m.get(key) ?? [];
      arr.push(l);
      m.set(key, arr);
    }
    // 시간 오름차순 정렬
    for (const arr of m.values()) {
      arr.sort((a, b) => parseIsoUtc(a.scheduledAt).getTime() - parseIsoUtc(b.scheduledAt).getTime());
    }
    return m;
  }, [lessons]);

  const studentMap = useMemo(() => {
    const m = new Map<string, StudentOption>();
    for (const s of students) m.set(s.id, s);
    return m;
  }, [students]);

  const weekStartLabel = formatKstDate(weekStart);
  const weekEnd = addDays(weekStart, 6);
  const weekEndLabel = formatKstDate(weekEnd);
  const yearMonthLabel = `${weekStart.getUTCFullYear()}년 ${weekStartLabel.m}월`;
  const weekRangeLabel = `${weekStartLabel.m}/${weekStartLabel.day} ~ ${weekEndLabel.m}/${weekEndLabel.day}`;

  // 이번 주 lessons 카운트 (전체 카운트는 lessons.length)
  const weekStartMs = weekStart.getTime() - 9 * 60 * 60 * 1000; // KST → UTC
  const weekEndMs = addDays(weekStart, 7).getTime() - 9 * 60 * 60 * 1000;
  const thisWeekCount = lessons.filter((l) => {
    const ts = parseIsoUtc(l.scheduledAt).getTime();
    return ts >= weekStartMs && ts < weekEndMs;
  }).length;

  // 다른 주에 lessons가 있을 때 가장 가까운 주로 점프
  const jumpToNearestLesson = () => {
    if (lessons.length === 0) return;
    const sorted = [...lessons].sort((a, b) => {
      const ad = Math.abs(parseIsoUtc(a.scheduledAt).getTime() - weekStart.getTime());
      const bd = Math.abs(parseIsoUtc(b.scheduledAt).getTime() - weekStart.getTime());
      return ad - bd;
    });
    setWeekStart(startOfWeekMon(parseIsoUtc(sorted[0].scheduledAt)));
  };

  const goPrevWeek = () => setWeekStart((d) => addDays(d, -7));
  const goNextWeek = () => setWeekStart((d) => addDays(d, 7));

  const toLessonDetail = (l: LessonRow): LessonDetail => {
    const student = studentMap.get(l.studentId);
    return {
      id: l.id,
      studentName: student?.name ?? "이름 미입력",
      studentPhone: student?.phone ?? null,
      scheduledAt: l.scheduledAt,
      durationMinutes: l.durationMinutes,
      status: l.status,
    };
  };

  const onCellClick = (dayOfWeek: number, hour: number, date: Date) => {
    const f = formatKstDate(date);
    const arr = lessonByCell.get(`${f.y}-${f.m}-${f.day}-${hour}`) ?? [];

    if (arr.length === 0) {
      setSheet({ open: true, dayOfWeek, hour, date });
      return;
    }

    if (arr.length === 1) {
      setLessonDetail({ open: true, lesson: toLessonDetail(arr[0]) });
      return;
    }

    // 2개 이상 — 리스트 시트
    const hh = String(hour).padStart(2, "0");
    setLessonList({
      open: true,
      hourLabel: `${f.m}월 ${f.day}일 ${DOW_KOR[f.dow]}요일 · ${hh}시`,
      lessons: arr.map(toLessonDetail),
      date,
      hour,
    });
  };

  const closeLessonList = () => setLessonList((s) => (s ? { ...s, open: false } : null));

  const onPickLessonFromList = (lesson: LessonDetail) => {
    setLessonList(null);
    setLessonDetail({ open: true, lesson });
  };

  const onBookNewFromList = () => {
    if (!lessonList) return;
    const f = formatKstDate(lessonList.date);
    const hh = String(lessonList.hour).padStart(2, "0");
    const baseTimeLabel = `${f.m}월 ${f.day}일 ${DOW_KOR[f.dow]}요일 · ${hh}시`;
    setLessonList(null);
    setStudentPicker({ open: true, date: lessonList.date, hour: lessonList.hour, baseTimeLabel });
  };

  const closeLessonDetail = () => setLessonDetail((s) => (s ? { ...s, open: false } : null));

  const onCancelLesson = () => {
    if (!lessonDetail) return;
    const lessonId = lessonDetail.lesson.id;
    setPendingCancel(true);
    startTransition(async () => {
      const res = await cancelLesson(lessonId);
      setPendingCancel(false);
      if (!res.ok) {
        setAlert({
          open: true,
          variant: "error",
          title: "레슨 취소 실패",
          description: res.error,
        });
        return;
      }
      setLessonDetail(null);
      setAlert({
        open: true,
        variant: "success",
        title: "레슨이 취소되었어요",
        description: "수강생에게 안내가 전달돼요. (알림톡은 곧 적용 예정)",
      });
      reload();
    });
  };

  const closeSheet = () => setSheet((s) => (s ? { ...s, open: false } : null));

  const onBookLessonAction = () => {
    if (!sheet) return;
    const f = formatKstDate(sheet.date);
    const hh = String(sheet.hour).padStart(2, "0");
    const baseTimeLabel = `${f.m}월 ${f.day}일 ${DOW_KOR[f.dow]}요일 · ${hh}시`;
    closeSheet();
    setStudentPicker({ open: true, date: sheet.date, hour: sheet.hour, baseTimeLabel });
  };

  const closeStudentPicker = () =>
    setStudentPicker((s) => (s ? { ...s, open: false } : null));

  const onPickStudent = (studentId: string, minute: number, durationMinutes: number) => {
    if (!studentPicker) return;
    const iso = cellToIso(studentPicker.date, studentPicker.hour, minute);
    const hh = String(studentPicker.hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    const totalEnd = studentPicker.hour * 60 + minute + durationMinutes;
    const endHh = String(Math.floor(totalEnd / 60)).padStart(2, "0");
    const endMm = String(totalEnd % 60).padStart(2, "0");
    const baseDate = studentPicker.baseTimeLabel.replace(/ · .*$/, "");
    const fullTimeLabel = `${baseDate} · ${hh}:${mm} ~ ${endHh}:${endMm} (${durationMinutes}분)`;
    setPendingStudentId(studentId);
    startTransition(async () => {
      const res = await bookLesson(studentId, iso, durationMinutes);
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
        description: `${fullTimeLabel}에 레슨이 잡혔습니다.`,
      });
      reload();
    });
  };

  return (
    <div className="flex flex-col">
      {/* 로딩 / 결과 상태 배너 */}
      {isLoading ? (
        <div className="px-4 py-3 border-b border-line bg-primary/5 flex items-center gap-2.5">
          <svg className="animate-spin h-4 w-4 text-primary flex-none" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
          </svg>
          <span className="text-xs font-semibold text-ink-2">수강 정보를 불러오고 있어요…</span>
        </div>
      ) : loadError ? (
        <div className="px-4 py-3 border-b border-line bg-red-50 flex items-center justify-between gap-2">
          <span className="text-xs text-red-600 font-medium truncate">{loadError}</span>
          <button
            type="button"
            onClick={reload}
            className="flex-none rounded-md border border-red-200 bg-white text-[11px] font-semibold text-red-600 px-2.5 py-1 hover:bg-red-50"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <div className="px-4 py-2 border-b border-line bg-emerald-50/60 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-emerald-700">
            이번 주 {thisWeekCount}건 · 전체 {lessons.length}건 등록
          </span>
          {thisWeekCount === 0 && lessons.length > 0 && (
            <button
              type="button"
              onClick={jumpToNearestLesson}
              className="flex-none rounded-md bg-emerald-600 text-white text-[10px] font-semibold px-2 py-1 hover:bg-emerald-700 transition"
            >
              가장 가까운 주로 이동
            </button>
          )}
        </div>
      )}

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
          baseTimeLabel={studentPicker.baseTimeLabel}
          hour={studentPicker.hour}
          students={students}
          pendingStudentId={pendingStudentId}
          onPick={onPickStudent}
        />
      )}

      {lessonDetail && (
        <LessonDetailSheet
          open={lessonDetail.open}
          onClose={closeLessonDetail}
          lesson={lessonDetail.lesson}
          pendingCancel={pendingCancel}
          onCancel={onCancelLesson}
        />
      )}

      {lessonList && (
        <LessonListSheet
          open={lessonList.open}
          onClose={closeLessonList}
          hourLabel={lessonList.hourLabel}
          lessons={lessonList.lessons}
          onPickLesson={onPickLessonFromList}
          onBookNew={onBookNewFromList}
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
  lessonByCell: Map<string, LessonRow[]>;
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
        const arr = lessonByCell.get(key) ?? [];
        const count = arr.length;
        const first = arr[0];
        const full = count >= 1 && isHourFull(arr);
        return (
          <button
            type="button"
            key={i}
            onClick={() => onCellClick(dow, hour, wd.date)}
            className={`relative h-9 border-t border-line border-l border-line/60 transition active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:relative cursor-pointer ${
              count > 0 ? statusToClass(first.status) : "bg-surface hover:bg-soft"
            }`}
            aria-label={`${hourLabel} ${count > 0 ? `레슨 ${count}개${full ? " (가득 참)" : ""}` : "빈 시간"} 옵션`}
          >
            {count >= 1 && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-white text-[9px] font-bold leading-none tracking-tight ${full ? "bg-red-500" : "bg-ink"}`}>
                  {full ? "FULL" : count}
                </span>
              </span>
            )}
          </button>
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
