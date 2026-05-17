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

type ViewMode = "hour" | "minute";

type TimeSlot = { hour: number; minute: number; label: string; showLabel: boolean };

function buildTimeSlots(mode: ViewMode): TimeSlot[] {
  const list: TimeSlot[] = [];
  if (mode === "hour") {
    for (const h of HOURS) {
      list.push({ hour: h, minute: 0, label: `${String(h).padStart(2, "0")}:00`, showLabel: true });
    }
  } else {
    for (const h of HOURS) {
      for (let m = 0; m < 60; m += 10) {
        list.push({
          hour: h,
          minute: m,
          label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
          showLabel: true,
        });
      }
    }
  }
  return list;
}

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

/** hour 셀이 60분 안에 lessons로 가득 차 있는지 — 각 lesson의 그 hour 안 점유 분 union */
function isHourFull(lessons: LessonRow[], hour: number): boolean {
  if (lessons.length === 0) return false;
  const hourStartMin = hour * 60;
  const hourEndMin = hour * 60 + 60;
  const intervals: Array<[number, number]> = [];
  for (const l of lessons) {
    if (l.status === "CANCELLED") continue;
    const startKst = new Date(parseIsoUtc(l.scheduledAt).getTime() + 9 * 60 * 60 * 1000);
    const lessonStart = startKst.getUTCHours() * 60 + startKst.getUTCMinutes();
    const lessonEnd = lessonStart + l.durationMinutes;
    const oStart = Math.max(lessonStart, hourStartMin);
    const oEnd = Math.min(lessonEnd, hourEndMin);
    if (oStart < oEnd) {
      intervals.push([oStart - hourStartMin, oEnd - hourStartMin]);
    }
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
  const [viewMode, setViewMode] = useState<ViewMode>("hour");
  const timeSlots = useMemo(() => buildTimeSlots(viewMode), [viewMode]);
  const slotStepMin = viewMode === "hour" ? 60 : 10;
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
    const days: { date: Date; m: number; day: number; dowKor: string; isToday: boolean; isPast: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const f = formatKstDate(d);
      days.push({
        date: d,
        m: f.m,
        day: f.day,
        dowKor: DOW_KOR[(weekStart.getUTCDay() + i) % 7],
        isToday: false,
        isPast: false,
      });
    }
    const nowKst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    const todayKey = nowKst.getUTCFullYear() * 10000 + nowKst.getUTCMonth() * 100 + nowKst.getUTCDate();
    days.forEach((wd) => {
      const wdKey = wd.date.getUTCFullYear() * 10000 + wd.date.getUTCMonth() * 100 + wd.date.getUTCDate();
      if (wdKey === todayKey) wd.isToday = true;
      if (wdKey < todayKey) wd.isPast = true;
    });
    return days;
  }, [weekStart]);

  const lessonByCell = useMemo(() => {
    const m = new Map<string, LessonRow[]>();
    for (const l of lessons) {
      const start = parseIsoUtc(l.scheduledAt);
      const end = new Date(start.getTime() + l.durationMinutes * 60 * 1000);
      const startKst = new Date(start.getTime() + 9 * 60 * 60 * 1000);
      const endKst = new Date(end.getTime() + 9 * 60 * 60 * 1000);
      // 시작 슬롯(step 단위로 내림)부터 종료 시각 직전까지 매핑
      const cursor = new Date(startKst);
      const curMin = cursor.getUTCMinutes();
      cursor.setUTCMinutes(Math.floor(curMin / slotStepMin) * slotStepMin, 0, 0);
      while (cursor.getTime() < endKst.getTime()) {
        const key = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth() + 1}-${cursor.getUTCDate()}-${cursor.getUTCHours()}-${cursor.getUTCMinutes()}`;
        const arr = m.get(key) ?? [];
        arr.push(l);
        m.set(key, arr);
        cursor.setTime(cursor.getTime() + slotStepMin * 60 * 1000);
      }
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => parseIsoUtc(a.scheduledAt).getTime() - parseIsoUtc(b.scheduledAt).getTime());
    }
    return m;
  }, [lessons, slotStepMin]);

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

  const onCellClick = (dayOfWeek: number, hour: number, date: Date, minute: number = 0) => {
    const f = formatKstDate(date);
    const arr = lessonByCell.get(`${f.y}-${f.m}-${f.day}-${hour}-${minute}`) ?? [];

    // 과거 날짜의 빈 셀은 등록 불가
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayKey = nowKst.getUTCFullYear() * 10000 + nowKst.getUTCMonth() * 100 + nowKst.getUTCDate();
    const cellKey = date.getUTCFullYear() * 10000 + date.getUTCMonth() * 100 + date.getUTCDate();
    const isPast = cellKey < todayKey;

    if (arr.length === 0) {
      if (isPast) {
        setAlert({
          open: true,
          variant: "error",
          title: "과거 날짜에는 잡을 수 없어요",
          description: "오늘 이전 날짜에는 새 레슨을 잡을 수 없습니다. 오늘 또는 이후 날짜를 선택해주세요.",
        });
        return;
      }
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
        <div className="flex items-center justify-between px-4 py-3 gap-2">
          <div className="text-sm font-extrabold text-ink truncate">{yearMonthLabel}</div>
          <div className="flex items-center gap-1 flex-none">
            {/* 보기 모드 토글 */}
            <div className="flex rounded-lg bg-soft p-0.5 mr-1">
              <button
                type="button"
                onClick={() => setViewMode("hour")}
                className={`px-2 h-7 rounded-md text-[11px] font-semibold transition ${
                  viewMode === "hour" ? "bg-surface text-ink shadow-sm" : "text-ink-3"
                }`}
              >
                1시간
              </button>
              <button
                type="button"
                onClick={() => setViewMode("minute")}
                className={`px-2 h-7 rounded-md text-[11px] font-semibold transition ${
                  viewMode === "minute" ? "bg-surface text-ink shadow-sm" : "text-ink-3"
                }`}
              >
                10분
              </button>
            </div>
            <button
              type="button"
              onClick={goPrevWeek}
              className="w-8 h-8 rounded-lg border border-line bg-surface text-sm text-ink-2 hover:bg-soft transition"
              aria-label="이전주"
            >
              ‹
            </button>
            <span className="text-xs font-semibold text-ink-2 px-1">{weekRangeLabel}</span>
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
        <div className="grid grid-cols-[44px_repeat(7,1fr)] gap-0">
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
        <div className="grid grid-cols-[44px_repeat(7,1fr)] gap-0">
          {timeSlots.map((slot) => (
            <SlotRow
              key={`${slot.hour}-${slot.minute}`}
              slot={slot}
              weekDays={weekDays}
              lessonByCell={lessonByCell}
              studentMap={studentMap}
              onCellClick={onCellClick}
              viewMode={viewMode}
              slotStepMin={slotStepMin}
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

function SlotRow({
  slot,
  weekDays,
  lessonByCell,
  studentMap,
  onCellClick,
  viewMode,
}: {
  slot: TimeSlot;
  weekDays: { date: Date; isToday: boolean; isPast: boolean }[];
  lessonByCell: Map<string, LessonRow[]>;
  studentMap: Map<string, StudentOption>;
  onCellClick: (dayOfWeek: number, hour: number, date: Date, minute: number) => void;
  viewMode: ViewMode;
  slotStepMin?: number;
}) {
  const isHourMode = viewMode === "hour";
  const rowHeight = isHourMode ? "h-9" : "h-5";
  // 10분 모드에서 매 시각 단위 행만 강한 보더로 구분
  const isHourBoundary = slot.minute === 0;
  const topBorder = isHourMode
    ? "border-t border-line"
    : isHourBoundary
      ? "border-t border-line"
      : "border-t border-line/30";
  const labelFontClass = isHourMode ? "text-[10px]" : isHourBoundary ? "text-[10px] font-semibold text-ink-2" : "text-[9px]";
  return (
    <>
      <div className={`${labelFontClass} text-right pr-1.5 ${isHourMode ? "pt-1" : "pt-0 leading-tight"} ${topBorder} ${!isHourMode && !isHourBoundary ? "text-ink-3" : ""}`}>
        {slot.label}
      </div>
      {weekDays.map((wd, i) => {
        const dow = wd.date.getUTCDay();
        const f = formatKstDate(wd.date);
        const key = `${f.y}-${f.m}-${f.day}-${slot.hour}-${slot.minute}`;
        const arr = lessonByCell.get(key) ?? [];
        const count = arr.length;
        const first = arr[0];
        const full = isHourMode && count >= 1 && isHourFull(arr, slot.hour);
        const pastEmpty = wd.isPast && count === 0;
        // 10분 모드: 이 슬롯에서 시작하는 lesson만 학생 이름 표시
        const startingLesson = !isHourMode
          ? arr.find((l) => {
              const startKst = new Date(parseIsoUtc(l.scheduledAt).getTime() + 9 * 60 * 60 * 1000);
              return startKst.getUTCHours() === slot.hour && startKst.getUTCMinutes() === slot.minute;
            })
          : undefined;
        const startingStudent = startingLesson ? studentMap.get(startingLesson.studentId) : undefined;
        return (
          <button
            type="button"
            key={i}
            onClick={() => onCellClick(dow, slot.hour, wd.date, slot.minute)}
            className={`relative ${rowHeight} ${topBorder} border-l border-line/60 transition active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:relative overflow-hidden ${
              pastEmpty
                ? "bg-soft/60 cursor-not-allowed"
                : count > 0
                  ? `${statusToClass(first.status)} cursor-pointer ${wd.isPast ? "opacity-70" : ""}`
                  : "bg-surface hover:bg-soft cursor-pointer"
            }`}
            aria-label={`${slot.label} ${pastEmpty ? "지난 날짜 빈 시간" : count > 0 ? `레슨 ${count}개${full ? " (가득 참)" : ""}` : "빈 시간"} 옵션`}
          >
            {isHourMode && count >= 1 && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-white text-[9px] font-bold leading-none tracking-tight ${full ? "bg-red-500" : "bg-ink"}`}>
                  {full ? "FULL" : count}
                </span>
              </span>
            )}
            {!isHourMode && startingStudent && (
              <span className="absolute inset-0 flex items-center justify-start pl-1 pointer-events-none">
                <span className="text-[9px] font-bold text-ink truncate leading-none">
                  {startingStudent.name}
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
