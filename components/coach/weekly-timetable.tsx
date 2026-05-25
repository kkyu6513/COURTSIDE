"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertModal } from "@/components/alert-modal";
import { Toast } from "@/components/toast";
import { EmptySlotSheet } from "@/components/coach/empty-slot-sheet";
import { StudentPickerSheet, type StudentOption } from "@/components/coach/student-picker-sheet";
import { LessonDetailSheet, type LessonDetail } from "@/components/coach/lesson-detail-sheet";
import { LessonListSheet } from "@/components/coach/lesson-list-sheet";
import { bookLesson, cancelLesson, restoreLesson, updateLessonNotes } from "@/app/coach/schedule/actions";
import { deriveDisplayStatus, getStatusCellClass } from "@/lib/lesson-status";

export type LessonRow = {
  id: number;
  studentId: string;
  scheduledAt: string; // ISO
  durationMinutes: number;
  // DB lessons.status — 12종 + 미래 확장에 대비해 string 으로 받음.
  // 라벨/색 매핑은 @/lib/lesson-status 에서 단일 소스로 관리.
  status: string;
  notes?: string | null;
};

type Props = {
  lessons?: LessonRow[];
  students?: StudentOption[];
  initialDate?: string; // "YYYY-MM-DD" — 진입 시 이 날짜가 속한 주 표시
};

const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06 ~ 23 (23시 슬롯에서 60분 잡으면 24:00 종료)

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

// statusToClass 는 @/lib/lesson-status 의 getStatusCellClass + deriveDisplayStatus 로 대체.
// CONFIRMED 가 진행 시간대면 IN_PROGRESS 색(빨강 pulse)으로 표시 — 코치 홈과 동일 규칙.

export function WeeklyTimetable({
  lessons: initialLessons = [],
  students: initialStudents = [],
  initialDate,
}: Props) {
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

  const [weekStart, setWeekStart] = useState<Date>(() => {
    // initialDate("YYYY-MM-DD")가 있으면 그 날짜가 속한 주, 없으면 이번 주
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
      return startOfWeekMon(new Date(initialDate + "T00:00:00Z"));
    }
    return startOfWeekMon(new Date());
  });
  // initialDate가 지정되면 자동 점프 비활성 (사용자가 명시적으로 그 주를 원함)
  const didAutoJumpRef = useRef(!!initialDate);

  // 최초 lessons load 후, 이번 주에 미래 lesson이 없고 다른 미래 주에 있으면 그 주로 자동 이동
  useEffect(() => {
    if (didAutoJumpRef.current) return;
    if (isLoading) return;
    if (lessons.length === 0) {
      didAutoJumpRef.current = true;
      return;
    }
    const nowMs = Date.now();
    const futureLessons = lessons.filter((l) => parseIsoUtc(l.scheduledAt).getTime() >= nowMs);
    if (futureLessons.length === 0) {
      didAutoJumpRef.current = true;
      return; // 미래 lesson 없으면 이번 주 default 유지
    }
    const wStartMs = weekStart.getTime() - 9 * 60 * 60 * 1000;
    const wEndMs = wStartMs + 7 * 24 * 60 * 60 * 1000;
    const inCurWeek = futureLessons.some((l) => {
      const ts = parseIsoUtc(l.scheduledAt).getTime();
      return ts >= wStartMs && ts < wEndMs;
    });
    didAutoJumpRef.current = true;
    if (!inCurWeek) {
      // 가장 가까운 미래 lesson의 주로
      const sorted = [...futureLessons].sort(
        (a, b) => parseIsoUtc(a.scheduledAt).getTime() - parseIsoUtc(b.scheduledAt).getTime(),
      );
      setWeekStart(startOfWeekMon(parseIsoUtc(sorted[0].scheduledAt)));
    }
  }, [isLoading, lessons, weekStart]);

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
  const [pendingNotes, setPendingNotes] = useState(false);
  const [pendingRestore, setPendingRestore] = useState(false);
  const [, startTransition] = useTransition();
  // 에러/경고 — 사용자 확인이 필요한 풀모달
  const [alert, setAlert] = useState<{ open: boolean; variant: "error"; title: string; description?: string }>({
    open: false,
    variant: "error",
    title: "",
  });
  // 성공 알림 — 흐름을 끊지 않는 toast(자동 닫힘)
  const [toast, setToast] = useState<{ open: boolean; title: string; description?: string }>({
    open: false,
    title: "",
  });
  const showSuccess = (title: string, description?: string) =>
    setToast({ open: true, title, description });
  const showError = (title: string, description?: string) =>
    setAlert({ open: true, variant: "error", title, description });

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

  // 가시 주 범위 — KST 기준 weekStart(월 00:00) ~ +7일.
  // weekStart 는 이미 KST 자정으로 정규화돼 있어 그대로 비교(ms 단위 +9h 보정 후).
  const visibleStartMs = weekStart.getTime() - 9 * 60 * 60 * 1000;
  const visibleEndMs = visibleStartMs + 7 * 24 * 60 * 60 * 1000;

  const lessonByCell = useMemo(() => {
    const m = new Map<string, LessonRow[]>();
    for (const l of lessons) {
      // 취소된 레슨은 셀 점유를 해제 — 동일 시간 새 레슨 등록 가능해야 함
      if (l.status === "CANCELLED") continue;
      const start = parseIsoUtc(l.scheduledAt);
      const end = new Date(start.getTime() + l.durationMinutes * 60 * 1000);
      // 가시 주 밖 레슨은 셀 매핑 스킵 — 큰 코치(수백 lesson) 시 매 주 이동마다 무거워지는 것 방지.
      // 가시 주에 걸치는 케이스(자정 가로지름 등)도 포함하기 위해 start<end_window && end>start_window 로 판정.
      if (end.getTime() <= visibleStartMs || start.getTime() >= visibleEndMs) continue;
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
  }, [lessons, slotStepMin, visibleStartMs, visibleEndMs]);

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
    const nowMs = Date.now();
    const future = lessons.filter((l) => parseIsoUtc(l.scheduledAt).getTime() >= nowMs);
    const target = future.length > 0 ? future : lessons;
    const sorted = [...target].sort((a, b) => {
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
      notes: l.notes ?? null,
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
        showError(
          "과거 날짜에는 잡을 수 없어요",
          "오늘 이전 날짜에는 새 레슨을 잡을 수 없습니다. 오늘 또는 이후 날짜를 선택해주세요.",
        );
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

  const onSaveLessonNotes = (notes: string) => {
    if (!lessonDetail) return;
    const lessonId = lessonDetail.lesson.id;
    setPendingNotes(true);
    startTransition(async () => {
      const res = await updateLessonNotes(lessonId, notes);
      setPendingNotes(false);
      if (!res.ok) {
        showError("메모 저장 실패", res.error);
        return;
      }
      // 로컬 lessonDetail 즉시 갱신 (시트 안 textarea 동기화)
      setLessonDetail((s) => (s ? { ...s, lesson: { ...s.lesson, notes: notes.trim() || null } } : s));
      showSuccess("메모가 저장되었어요");
      reload();
    });
  };

  const onCancelLesson = () => {
    if (!lessonDetail) return;
    const lessonId = lessonDetail.lesson.id;
    setPendingCancel(true);
    startTransition(async () => {
      const res = await cancelLesson(lessonId);
      setPendingCancel(false);
      if (!res.ok) {
        showError("레슨 취소 실패", res.error);
        return;
      }
      setLessonDetail(null);
      showSuccess("레슨이 취소되었어요", "수강생 알림 발송은 다음 업데이트에 추가될 예정이에요.");
      reload();
    });
  };

  const onRestoreLesson = () => {
    if (!lessonDetail) return;
    const lessonId = lessonDetail.lesson.id;
    setPendingRestore(true);
    startTransition(async () => {
      const res = await restoreLesson(lessonId);
      setPendingRestore(false);
      if (!res.ok) {
        showError("레슨 복구 실패", res.error);
        return;
      }
      setLessonDetail(null);
      showSuccess("레슨이 복구되었어요");
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

  const onPickStudent = (studentId: string, hour: number, minute: number, durationMinutes: number) => {
    if (!studentPicker) return;
    const iso = cellToIso(studentPicker.date, hour, minute);
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    const totalEnd = hour * 60 + minute + durationMinutes;
    const endHh = String(Math.floor(totalEnd / 60)).padStart(2, "0");
    const endMm = String(totalEnd % 60).padStart(2, "0");
    const baseDate = studentPicker.baseTimeLabel.replace(/ · .*$/, "");
    const fullTimeLabel = `${baseDate} · ${hh}:${mm} ~ ${endHh}:${endMm} (${durationMinutes}분)`;
    setPendingStudentId(studentId);
    startTransition(async () => {
      const res = await bookLesson(studentId, iso, durationMinutes);
      setPendingStudentId(null);
      if (!res.ok) {
        showError("레슨 등록 실패", res.error);
        return;
      }
      setStudentPicker(null);
      showSuccess("레슨이 등록되었어요", `${fullTimeLabel}에 레슨이 잡혔습니다.`);
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
        <div className="px-4 py-3 border-b border-line bg-red-50">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-red-500 flex-none mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-red-700">일정을 불러올 수 없어요</div>
              <div className="mt-0.5 text-[11px] text-red-600/90 leading-relaxed truncate">
                {loadError} · 표시된 일정은 최신이 아닐 수 있어요
              </div>
            </div>
            <button
              type="button"
              onClick={reload}
              className="flex-none rounded-md border border-red-200 bg-white text-[11px] font-semibold text-red-600 px-2.5 py-1 hover:bg-red-50"
            >
              다시 시도
            </button>
          </div>
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
            {/* 보기 모드 토글 — 1시간 단위(간단)와 10분 단위(정밀) 선택 */}
            <div
              className="flex rounded-lg bg-soft p-0.5 mr-1"
              role="group"
              aria-label="보기 단위"
            >
              <button
                type="button"
                onClick={() => setViewMode("hour")}
                aria-pressed={viewMode === "hour"}
                title="1시간 단위 — 한눈에 보기"
                className={`px-2.5 h-8 rounded-md text-[11px] font-semibold transition ${
                  viewMode === "hour" ? "bg-surface text-ink shadow-sm" : "text-ink-3"
                }`}
              >
                1시간
              </button>
              <button
                type="button"
                onClick={() => setViewMode("minute")}
                aria-pressed={viewMode === "minute"}
                title="10분 단위 — 정밀 보기 (학생 이름 표시)"
                className={`px-2.5 h-8 rounded-md text-[11px] font-semibold transition ${
                  viewMode === "minute" ? "bg-surface text-ink shadow-sm" : "text-ink-3"
                }`}
              >
                10분
              </button>
            </div>
            <button
              type="button"
              onClick={goPrevWeek}
              className="w-10 h-10 rounded-lg border border-line bg-surface text-base text-ink-2 hover:bg-soft transition active:scale-[0.96]"
              aria-label="이전 주"
            >
              ‹
            </button>
            <span className="text-xs font-semibold text-ink-2 px-1">{weekRangeLabel}</span>
            <button
              type="button"
              onClick={goNextWeek}
              className="w-10 h-10 rounded-lg border border-line bg-surface text-base text-ink-2 hover:bg-soft transition active:scale-[0.96]"
              aria-label="다음 주"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* 주간 헤더 */}
      <div className="px-3 pt-2 pb-1 border-b border-line bg-surface sticky top-0 z-10 backdrop-blur">
        <div className="grid grid-cols-[44px_repeat(7,1fr)] gap-0">
          <div />
          {weekDays.map((wd, i) => (
            <div key={i} className="text-center py-1.5 relative">
              {wd.isToday && (
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[8px] font-extrabold text-primary tracking-wider">
                  TODAY
                </div>
              )}
              <div className={`text-[10px] ${wd.isToday ? "font-bold text-primary" : "text-ink-3"}`}>
                {wd.dowKor}
              </div>
              <div
                className={`mx-auto mt-0.5 flex items-center justify-center text-xs font-semibold ${
                  wd.isToday
                    ? "w-7 h-7 rounded-full bg-primary text-white shadow-[0_3px_8px_rgba(45,212,191,0.45)] font-extrabold"
                    : "w-6 h-6 rounded-full text-ink"
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
        <div
          className="grid grid-cols-[44px_repeat(7,1fr)] gap-0"
          role="grid"
          aria-label={`주간 레슨 일정 — ${weekRangeLabel}`}
          aria-rowcount={timeSlots.length}
          aria-colcount={7}
        >
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

        {/* 범례 — lib/lesson-status STATUS_CELL_CLASS 와 동일 컬러로 정렬 */}
        <div className="mt-3 mb-6 flex flex-wrap gap-x-3 gap-y-1.5 p-3 bg-soft rounded-xl">
          <LegendItem color="bg-amber-100 border-amber-200" label="레슨 신청" />
          <LegendItem color="bg-violet-100 border-violet-200" label="레슨 예정" />
          <LegendItem color="bg-red-100 border-red-200" label="진행중" />
          <LegendItem color="bg-blue-100 border-blue-200" label="완료 / 변경완료" />
          <LegendItem color="bg-gray-100 border-line" label="결강" />
          <LegendItem color="bg-orange-100 border-orange-200" label="변경 / 보강 요청" />
          <LegendItem color="bg-emerald-100 border-emerald-200" label="보강" />
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
          pendingNotes={pendingNotes}
          pendingRestore={pendingRestore}
          onCancel={onCancelLesson}
          onSaveNotes={onSaveLessonNotes}
          onRestore={onRestoreLesson}
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

      <Toast
        open={toast.open}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        variant="success"
        title={toast.title}
        description={toast.description}
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
      <div
        role="rowheader"
        aria-label={`${slot.label}`}
        className={`${labelFontClass} text-right pr-1.5 ${isHourMode ? "pt-1" : "pt-0 leading-tight"} ${topBorder} ${!isHourMode && !isHourBoundary ? "text-ink-3" : ""}`}
      >
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
        // 10분 모드 continuation: 이 셀이 lesson 시작이 아니고 점유중이면 위 보더 제거 → 시각적 병합
        const isContinuation = !isHourMode && count > 0 && !startingLesson;
        const cellTopBorder = isContinuation ? "" : topBorder;
        return (
          <button
            type="button"
            key={i}
            role="gridcell"
            onClick={() => onCellClick(dow, slot.hour, wd.date, slot.minute)}
            className={`relative ${rowHeight} ${cellTopBorder} border-l border-line/60 transition active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:relative overflow-hidden ${
              pastEmpty
                ? "bg-soft/60 cursor-not-allowed"
                : count > 0
                  ? `${getStatusCellClass(deriveDisplayStatus(first.status, first.scheduledAt, first.durationMinutes))} cursor-pointer ${wd.isPast ? "opacity-70" : ""}`
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
