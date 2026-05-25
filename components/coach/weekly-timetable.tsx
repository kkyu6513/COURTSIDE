"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertModal } from "@/components/alert-modal";
import { Toast } from "@/components/toast";
import { StudentPickerSheet, type StudentOption } from "@/components/coach/student-picker-sheet";
import { LessonDetailSheet, type LessonDetail } from "@/components/coach/lesson-detail-sheet";
import {
  bookLesson,
  bookRecurringLessons,
  cancelLesson,
  markLessonAbsent,
  markLessonCompleted,
  markLessonPaid,
  restoreLesson,
  updateLessonNotes,
} from "@/app/coach/schedule/actions";
import {
  deriveDisplayStatus,
  getStatusBlockAccent,
  getStatusLabel,
} from "@/lib/lesson-status";
import { KST_OFFSET_MS, parseIsoUtc } from "@/lib/kst";

export type LessonRow = {
  id: number;
  studentId: string;
  scheduledAt: string; // ISO
  durationMinutes: number;
  // DB lessons.status — 12종 + 미래 확장 대비 string. 라벨/색은 @/lib/lesson-status 단일 소스.
  status: string;
  paymentStatus?: string | null; // PAID | UNPAID | EXTERNAL | NONE
  notes?: string | null;
};

type Props = {
  lessons?: LessonRow[];
  students?: StudentOption[];
  initialDate?: string; // "YYYY-MM-DD" — 진입 시 이 날짜가 속한 주 표시
};

const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_START_HOUR = 6;   // 06:00
const DAY_END_HOUR = 24;    // 24:00 (자정 종료 레슨 허용)
const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR; // 18
const HOUR_HEIGHT_PX = 56;  // 1시간 블록 = 56px (60분 레슨이 56px 박스로 표현됨)
const SNAP_MIN = 10;        // 빈 영역 클릭 시 10분 단위로 스냅

type LayoutMode = "day" | "week";

// ---------- 유틸 ----------

// SSR initialLessons vs fetch 결과 동일성 비교 — 동일하면 setState skip(깜빡임 방지)
function sameLessonList(a: LessonRow[], b: LessonRow[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.status !== y.status ||
      x.scheduledAt !== y.scheduledAt ||
      x.durationMinutes !== y.durationMinutes ||
      (x.paymentStatus ?? null) !== (y.paymentStatus ?? null) ||
      (x.notes ?? null) !== (y.notes ?? null)
    ) return false;
  }
  return true;
}
function sameStudentList(a: StudentOption[], b: StudentOption[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].name !== b[i].name || a[i].phone !== b[i].phone) return false;
  }
  return true;
}

function startOfWeekMon(d: Date): Date {
  const kst = new Date(d.getTime() + KST_OFFSET_MS);
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

/** KST 날짜 + hour/minute → 실제 UTC ISO (cellToIso에서 -9h 보정) */
function cellToIso(date: Date, hour: number, minute: number = 0): string {
  const utc = new Date(date);
  utc.setUTCHours(hour - 9, minute, 0, 0);
  return utc.toISOString();
}

/** "16:00 ~ 17:30" 같은 KST 시간 라벨 */
function hmRange(startMin: number, endMin: number): string {
  const hh1 = String(Math.floor(startMin / 60)).padStart(2, "0");
  const mm1 = String(startMin % 60).padStart(2, "0");
  const hh2 = String(Math.floor(endMin / 60)).padStart(2, "0");
  const mm2 = String(endMin % 60).padStart(2, "0");
  return `${hh1}:${mm1}~${hh2}:${mm2}`;
}

// ---------- 블록 레이아웃 ----------

type LessonBlock = {
  lesson: LessonRow;
  startMin: number;   // KST 자정 기준 분
  endMin: number;     // 가시 범위로 클립된 값
  laneIdx: number;    // 0-indexed (충돌 그룹 내 컬럼 인덱스)
  laneCount: number;  // 충돌 그룹 내 전체 컬럼 수
};

/**
 * 하루치 레슨을 시간-블록으로 레이아웃.
 * - CANCELLED 제외
 * - 가시 범위 [06:00, 24:00] 밖이면 클립
 * - 시간이 겹치는 그룹을 만들고 그룹 내에서 greedy 레인 할당
 *   (구글 캘린더 day-view 와 동일 알고리즘)
 */
function layoutDayBlocks(lessons: LessonRow[]): LessonBlock[] {
  if (lessons.length === 0) return [];

  const dayStartMin = DAY_START_HOUR * 60;
  const dayEndMin = DAY_END_HOUR * 60;

  const items: { lesson: LessonRow; startMin: number; endMin: number }[] = [];
  for (const l of lessons) {
    if (l.status === "CANCELLED") continue;
    const startKst = new Date(parseIsoUtc(l.scheduledAt).getTime() + KST_OFFSET_MS);
    const sRaw = startKst.getUTCHours() * 60 + startKst.getUTCMinutes();
    const eRaw = sRaw + l.durationMinutes;
    // 가시 범위 클립
    const s = Math.max(sRaw, dayStartMin);
    const e = Math.min(eRaw, dayEndMin);
    if (e <= s) continue; // 가시 범위 밖
    items.push({ lesson: l, startMin: s, endMin: e });
  }
  items.sort((a, b) => (a.startMin === b.startMin ? a.endMin - b.endMin : a.startMin - b.startMin));

  // 연결된 충돌 그룹 추출
  const groups: typeof items[] = [];
  let cur: typeof items = [];
  let curEnd = -Infinity;
  for (const it of items) {
    if (it.startMin >= curEnd && cur.length > 0) {
      groups.push(cur);
      cur = [];
      curEnd = -Infinity;
    }
    cur.push(it);
    curEnd = Math.max(curEnd, it.endMin);
  }
  if (cur.length > 0) groups.push(cur);

  // 그룹 내 greedy 레인 할당
  const blocks: LessonBlock[] = [];
  for (const group of groups) {
    const laneEnds: number[] = [];
    const tmp: { lesson: LessonRow; startMin: number; endMin: number; laneIdx: number }[] = [];
    for (const it of group) {
      let lane = laneEnds.findIndex((e) => e <= it.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(it.endMin);
      } else {
        laneEnds[lane] = it.endMin;
      }
      tmp.push({ ...it, laneIdx: lane });
    }
    const laneCount = laneEnds.length;
    for (const t of tmp) {
      blocks.push({
        lesson: t.lesson,
        startMin: t.startMin,
        endMin: t.endMin,
        laneIdx: t.laneIdx,
        laneCount,
      });
    }
  }
  return blocks;
}

// ---------- 컴포넌트 ----------

export function WeeklyTimetable({
  lessons: initialLessons = [],
  students: initialStudents = [],
  initialDate,
}: Props) {
  const router = useRouter();

  // SSR initialLessons 있으면 즉시 표시, mount 후 silent refresh로 갱신
  const hasSSRData = initialLessons.length > 0 || initialStudents.length > 0;
  const [lessons, setLessons] = useState<LessonRow[]>(initialLessons);
  const [students, setStudents] = useState<StudentOption[]>(initialStudents);
  const [isLoading, setIsLoading] = useState(!hasSSRData);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/coach/lessons", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setLoadError(body.error || `HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { lessons: LessonRow[]; students: StudentOption[] };
      const newLessons = data.lessons ?? [];
      const newStudents = data.students ?? [];
      setLessons((prev) => (sameLessonList(prev, newLessons) ? prev : newLessons));
      setStudents((prev) => (sameStudentList(prev, newStudents) ? prev : newStudents));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload(hasSSRData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [weekStart, setWeekStart] = useState<Date>(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
      return startOfWeekMon(new Date(initialDate + "T00:00:00Z"));
    }
    return startOfWeekMon(new Date());
  });
  const didAutoJumpRef = useRef(!!initialDate);

  // ----- 레이아웃 모드(day/week) + selectedDayIdx -----
  const LAYOUT_MODE_KEY = "courtside.coach.schedule.layoutMode";
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>("week");
  // 초기값: localStorage > 모바일이면 day / 데스크탑이면 week
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(LAYOUT_MODE_KEY);
    if (saved === "day" || saved === "week") {
      setLayoutModeState(saved);
    } else {
      setLayoutModeState(window.innerWidth < 768 ? "day" : "week");
    }
  }, []);
  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setLayoutModeState(mode);
    try {
      window.localStorage.setItem(LAYOUT_MODE_KEY, mode);
    } catch {
      /* localStorage 비활성 — 무시 */
    }
  }, []);

  // day 모드에서 선택된 요일 (0=월 ~ 6=일). 초기값: 오늘이 속한 인덱스.
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(() => {
    const nowKst = new Date(Date.now() + KST_OFFSET_MS);
    return (nowKst.getUTCDay() + 6) % 7;
  });

  // 미래 lesson 자동 점프 — 이번 주 비고 + 다른 미래 주에 lesson 있으면 그 주로 이동
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
      return;
    }
    const wStartMs = weekStart.getTime() - KST_OFFSET_MS;
    const wEndMs = wStartMs + 7 * 24 * 60 * 60 * 1000;
    const inCurWeek = futureLessons.some((l) => {
      const ts = parseIsoUtc(l.scheduledAt).getTime();
      return ts >= wStartMs && ts < wEndMs;
    });
    didAutoJumpRef.current = true;
    if (!inCurWeek) {
      const sorted = [...futureLessons].sort(
        (a, b) => parseIsoUtc(a.scheduledAt).getTime() - parseIsoUtc(b.scheduledAt).getTime(),
      );
      setWeekStart(startOfWeekMon(parseIsoUtc(sorted[0].scheduledAt)));
    }
  }, [isLoading, lessons, weekStart]);

  // ----- 시트/상태 -----
  const [studentPicker, setStudentPicker] = useState<{
    open: boolean;
    date: Date;
    hour: number;
    minute: number;
    baseTimeLabel: string;
  } | null>(null);
  const [lessonDetail, setLessonDetail] = useState<{ open: boolean; lesson: LessonDetail } | null>(null);
  const [pendingStudentId, setPendingStudentId] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState(false);
  const [pendingNotes, setPendingNotes] = useState(false);
  const [pendingRestore, setPendingRestore] = useState(false);
  const [pendingComplete, setPendingComplete] = useState(false);
  const [pendingAbsent, setPendingAbsent] = useState(false);
  const [pendingPaid, setPendingPaid] = useState(false);
  const [, startTransition] = useTransition();
  const [alert, setAlert] = useState<{ open: boolean; variant: "error"; title: string; description?: string }>({
    open: false, variant: "error", title: "",
  });
  const [toast, setToast] = useState<{ open: boolean; title: string; description?: string }>({
    open: false, title: "",
  });
  const showSuccess = (title: string, description?: string) => setToast({ open: true, title, description });
  const showError = (title: string, description?: string) =>
    setAlert({ open: true, variant: "error", title, description });

  // ----- 주간 일자 메타 -----
  const weekDays = useMemo(() => {
    const nowKst = new Date(Date.now() + KST_OFFSET_MS);
    const todayKey = nowKst.getUTCFullYear() * 10000 + nowKst.getUTCMonth() * 100 + nowKst.getUTCDate();
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      const f = formatKstDate(d);
      const wdKey = f.y * 10000 + (f.m - 1) * 100 + f.day;
      return {
        date: d,
        m: f.m,
        day: f.day,
        dowKor: DOW_KOR[(weekStart.getUTCDay() + i) % 7],
        isToday: wdKey === todayKey,
        isPast: wdKey < todayKey,
      };
    });
  }, [weekStart]);

  // 일별 lesson 인덱스 → 그룹화 + 레인 할당
  const blocksByDay = useMemo(() => {
    const m = new Map<string, LessonBlock[]>();
    const visibleStartMs = weekStart.getTime() - KST_OFFSET_MS;
    const visibleEndMs = visibleStartMs + 7 * 24 * 60 * 60 * 1000;

    // weekday 별로 lessons 분류
    const byDay = new Map<string, LessonRow[]>();
    for (const l of lessons) {
      if (l.status === "CANCELLED") continue;
      const startMs = parseIsoUtc(l.scheduledAt).getTime();
      const endMs = startMs + l.durationMinutes * 60 * 1000;
      // 주 범위 밖 스킵 (자정 가로지름 케이스도 포함하기 위해 start<end_window && end>start_window)
      if (endMs <= visibleStartMs || startMs >= visibleEndMs) continue;
      const startKst = new Date(startMs + KST_OFFSET_MS);
      const dayKey = `${startKst.getUTCFullYear()}-${startKst.getUTCMonth() + 1}-${startKst.getUTCDate()}`;
      const arr = byDay.get(dayKey) ?? [];
      arr.push(l);
      byDay.set(dayKey, arr);
    }

    for (const wd of weekDays) {
      const key = `${wd.date.getUTCFullYear()}-${wd.date.getUTCMonth() + 1}-${wd.date.getUTCDate()}`;
      m.set(key, layoutDayBlocks(byDay.get(key) ?? []));
    }
    return m;
  }, [lessons, weekStart, weekDays]);

  const studentMap = useMemo(() => {
    const map = new Map<string, StudentOption>();
    for (const s of students) map.set(s.id, s);
    return map;
  }, [students]);

  // ----- 헤더 라벨 -----
  const weekStartLabel = formatKstDate(weekStart);
  const weekEnd = addDays(weekStart, 6);
  const weekEndLabel = formatKstDate(weekEnd);
  const yearMonthLabel = `${weekStart.getUTCFullYear()}년 ${weekStartLabel.m}월`;
  const weekRangeLabel = `${weekStartLabel.m}/${weekStartLabel.day} ~ ${weekEndLabel.m}/${weekEndLabel.day}`;
  const selectedDayMeta = weekDays[selectedDayIdx];
  const dayLabel = selectedDayMeta
    ? `${selectedDayMeta.m}월 ${selectedDayMeta.day}일 (${selectedDayMeta.dowKor})`
    : "";

  // 이번 주 lessons 카운트
  const weekStartMs = weekStart.getTime() - KST_OFFSET_MS;
  const weekEndMs = addDays(weekStart, 7).getTime() - KST_OFFSET_MS;
  const thisWeekCount = lessons.filter((l) => {
    const ts = parseIsoUtc(l.scheduledAt).getTime();
    return ts >= weekStartMs && ts < weekEndMs;
  }).length;
  const nowMs = Date.now();
  const hasFutureLesson = lessons.some((l) => parseIsoUtc(l.scheduledAt).getTime() >= nowMs);

  const jumpToNearestLesson = () => {
    if (lessons.length === 0) return;
    const future = lessons.filter((l) => parseIsoUtc(l.scheduledAt).getTime() >= Date.now());
    const target = future.length > 0 ? future : lessons;
    const sorted = [...target].sort((a, b) => {
      const ad = Math.abs(parseIsoUtc(a.scheduledAt).getTime() - weekStart.getTime());
      const bd = Math.abs(parseIsoUtc(b.scheduledAt).getTime() - weekStart.getTime());
      return ad - bd;
    });
    setWeekStart(startOfWeekMon(parseIsoUtc(sorted[0].scheduledAt)));
  };

  // ----- 네비 -----
  const goPrev = () => {
    if (layoutMode === "day") {
      if (selectedDayIdx > 0) {
        setSelectedDayIdx(selectedDayIdx - 1);
      } else {
        setWeekStart((d) => addDays(d, -7));
        setSelectedDayIdx(6);
      }
    } else {
      setWeekStart((d) => addDays(d, -7));
    }
  };
  const goNext = () => {
    if (layoutMode === "day") {
      if (selectedDayIdx < 6) {
        setSelectedDayIdx(selectedDayIdx + 1);
      } else {
        setWeekStart((d) => addDays(d, 7));
        setSelectedDayIdx(0);
      }
    } else {
      setWeekStart((d) => addDays(d, 7));
    }
  };
  const goToday = () => {
    setWeekStart(startOfWeekMon(new Date()));
    const nowKst = new Date(Date.now() + KST_OFFSET_MS);
    setSelectedDayIdx((nowKst.getUTCDay() + 6) % 7);
  };

  // ----- 변환 -----
  const toLessonDetail = (l: LessonRow): LessonDetail => {
    const student = studentMap.get(l.studentId);
    return {
      id: l.id,
      studentName: student?.name ?? "이름 미입력",
      studentPhone: student?.phone ?? null,
      scheduledAt: l.scheduledAt,
      durationMinutes: l.durationMinutes,
      status: l.status,
      paymentStatus: l.paymentStatus ?? null,
      notes: l.notes ?? null,
    };
  };

  // ----- 블록 클릭 → 디테일 시트 -----
  const onBlockClick = (lesson: LessonRow) => {
    setLessonDetail({ open: true, lesson: toLessonDetail(lesson) });
  };

  // ----- 빈 영역 클릭 → 학생 피커 직행 -----
  const onEmptyClick = (date: Date, hour: number, minute: number) => {
    // 과거 시각 거부 (서버 5분 유예와 동일)
    const cellUtcMs = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hour - 9,
      minute,
    );
    if (cellUtcMs < Date.now() - 5 * 60 * 1000) {
      const nowKst = new Date(Date.now() + KST_OFFSET_MS);
      const nowHh = String(nowKst.getUTCHours()).padStart(2, "0");
      const nowMm = String(nowKst.getUTCMinutes()).padStart(2, "0");
      showError(
        "이미 지난 시각이에요",
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} 슬롯은 현재(${nowHh}:${nowMm}) 기준 이미 지났어요.`,
      );
      return;
    }
    const f = formatKstDate(date);
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    const baseTimeLabel = `${f.m}월 ${f.day}일 ${DOW_KOR[f.dow]}요일 · ${hh}:${mm}`;
    setStudentPicker({ open: true, date, hour, minute, baseTimeLabel });
  };

  // ----- 시트 핸들러 -----
  const closeLessonDetail = () => setLessonDetail((s) => (s ? { ...s, open: false } : null));
  const closeStudentPicker = () => setStudentPicker((s) => (s ? { ...s, open: false } : null));

  const onSaveLessonNotes = (notes: string) => {
    if (!lessonDetail) return;
    const lessonId = lessonDetail.lesson.id;
    setPendingNotes(true);
    startTransition(async () => {
      const res = await updateLessonNotes(lessonId, notes);
      setPendingNotes(false);
      if (!res.ok) { showError("메모 저장 실패", res.error); return; }
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
      if (!res.ok) { showError("레슨 취소 실패", res.error); return; }
      setLessonDetail(null);
      showSuccess("레슨이 취소되었어요");
      reload();
    });
  };

  const onCompleteLesson = () => {
    if (!lessonDetail) return;
    const lessonId = lessonDetail.lesson.id;
    setPendingComplete(true);
    startTransition(async () => {
      const res = await markLessonCompleted(lessonId);
      setPendingComplete(false);
      if (!res.ok) { showError("레슨 완료 처리 실패", res.error); return; }
      setLessonDetail(null);
      showSuccess("레슨을 완료 처리했어요");
      reload();
    });
  };

  const onAbsentLesson = () => {
    if (!lessonDetail) return;
    const lessonId = lessonDetail.lesson.id;
    setPendingAbsent(true);
    startTransition(async () => {
      const res = await markLessonAbsent(lessonId);
      setPendingAbsent(false);
      if (!res.ok) { showError("결강 처리 실패", res.error); return; }
      setLessonDetail(null);
      showSuccess("결강으로 처리했어요");
      reload();
    });
  };

  const onMarkPaid = () => {
    if (!lessonDetail) return;
    const lessonId = lessonDetail.lesson.id;
    setPendingPaid(true);
    startTransition(async () => {
      const res = await markLessonPaid(lessonId);
      setPendingPaid(false);
      if (!res.ok) { showError("결제 확인 실패", res.error); return; }
      setLessonDetail((s) => (s ? { ...s, lesson: { ...s.lesson, paymentStatus: "PAID" } } : s));
      showSuccess("결제 완료로 처리했어요");
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
      if (!res.ok) { showError("레슨 복구 실패", res.error); return; }
      setLessonDetail(null);
      showSuccess("레슨이 복구되었어요");
      reload();
    });
  };

  const onPickStudent = (
    studentId: string,
    hour: number,
    minute: number,
    durationMinutes: number,
    weekCount: number = 1,
  ) => {
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
      if (weekCount > 1) {
        const res = await bookRecurringLessons(studentId, iso, durationMinutes, weekCount);
        setPendingStudentId(null);
        if (!res.ok) { showError("정기 레슨 등록 실패", res.error); return; }
        setStudentPicker(null);
        const skipMsg = res.skippedWeeks.length > 0
          ? ` (${res.skippedWeeks.length}주 건너뜀: ${res.skippedWeeks.map((s) => `${s.week}주차`).join(", ")})`
          : "";
        showSuccess(
          `${res.bookedCount}건의 정기 레슨이 등록되었어요`,
          `${weekCount}주 중 ${res.bookedCount}건 성공${skipMsg}`,
        );
        reload();
      } else {
        const res = await bookLesson(studentId, iso, durationMinutes);
        setPendingStudentId(null);
        if (!res.ok) { showError("레슨 등록 실패", res.error); return; }
        setStudentPicker(null);
        showSuccess("레슨이 등록되었어요", `${fullTimeLabel}에 레슨이 잡혔습니다.`);
        reload();
      }
    });
  };

  // ----- 현재 표시할 컬럼 결정 -----
  const visibleColumns = layoutMode === "day"
    ? selectedDayMeta ? [selectedDayMeta] : []
    : weekDays;

  // 본문 클릭 가능 여부 — pendingStudentId 있으면 차단 (시트가 떠 있으니)
  const router_ = router; // 사용 가능성 보존 (재 export)
  void router_;

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
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-red-700">일정을 불러올 수 없어요</div>
              <div className="mt-0.5 text-[11px] text-red-600/90 leading-relaxed truncate">
                {loadError} · 표시된 일정은 최신이 아닐 수 있어요
              </div>
            </div>
            <button
              type="button"
              onClick={() => reload()}
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
          <div className="flex-none flex items-center gap-1.5">
            {thisWeekCount === 0 && hasFutureLesson && (
              <button
                type="button"
                onClick={jumpToNearestLesson}
                className="rounded-md bg-emerald-600 text-white text-[10px] font-semibold px-2 py-1 hover:bg-emerald-700 transition"
              >
                가장 가까운 주로 이동
              </button>
            )}
            <button
              type="button"
              onClick={() => reload()}
              aria-label="새로고침"
              className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 월/주 네비 */}
      <div className="border-b border-line">
        <div className="flex items-center justify-between px-4 py-3 gap-2">
          <div className="text-sm font-extrabold text-ink truncate">
            {yearMonthLabel}
            {layoutMode === "day" && selectedDayMeta && (
              <span className="ml-2 text-xs font-semibold text-ink-2">· {dayLabel}</span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-none">
            {/* 레이아웃 모드 토글 — 1일/주 */}
            <div className="flex rounded-lg bg-soft p-0.5 mr-1" role="group" aria-label="보기 단위">
              <button
                type="button"
                onClick={() => setLayoutMode("day")}
                aria-pressed={layoutMode === "day"}
                title="1일 보기 — 한 날짜에 집중"
                className={`px-2.5 h-8 rounded-md text-[11px] font-semibold transition ${
                  layoutMode === "day" ? "bg-surface text-ink shadow-sm" : "text-ink-3"
                }`}
              >
                1일
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode("week")}
                aria-pressed={layoutMode === "week"}
                title="주간 보기 — 7일 한눈에"
                className={`px-2.5 h-8 rounded-md text-[11px] font-semibold transition ${
                  layoutMode === "week" ? "bg-surface text-ink shadow-sm" : "text-ink-3"
                }`}
              >
                주
              </button>
            </div>
            <button
              type="button"
              onClick={goPrev}
              className="w-10 h-10 rounded-lg border border-line bg-surface text-base text-ink-2 hover:bg-soft transition active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={layoutMode === "day" ? "이전 날짜" : `이전 주 (현재 ${weekRangeLabel})`}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goToday}
              className="text-[11px] font-semibold text-ink-2 px-2 h-10 rounded-lg border border-line bg-surface hover:bg-soft transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="오늘로 이동"
              title="오늘로 이동"
            >
              오늘
            </button>
            <button
              type="button"
              onClick={goNext}
              className="w-10 h-10 rounded-lg border border-line bg-surface text-base text-ink-2 hover:bg-soft transition active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={layoutMode === "day" ? "다음 날짜" : `다음 주 (현재 ${weekRangeLabel})`}
            >
              ›
            </button>
          </div>
        </div>
        {layoutMode === "week" && (
          <div className="px-4 pb-2 text-[11px] text-ink-3">{weekRangeLabel}</div>
        )}
      </div>

      {/* 주간 헤더 — week 모드만 + day 모드에서는 요일 스트립으로 빠른 점프 */}
      <div className="px-3 pt-2 pb-1 border-b border-line bg-surface sticky top-0 z-10 backdrop-blur">
        {layoutMode === "week" ? (
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
        ) : (
          <div className="grid grid-cols-7 gap-1 pb-1">
            {weekDays.map((wd, i) => {
              const isSelected = i === selectedDayIdx;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDayIdx(i)}
                  className={`relative flex-1 py-1.5 rounded-lg text-center transition active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    isSelected
                      ? "bg-primary text-white shadow-[0_3px_8px_rgba(45,212,191,0.35)]"
                      : wd.isToday
                        ? "bg-primary/10 text-primary border border-primary/40"
                        : "bg-soft text-ink"
                  }`}
                  aria-pressed={isSelected}
                  aria-label={`${wd.m}월 ${wd.day}일 ${wd.dowKor}요일${wd.isToday ? " 오늘" : ""}${isSelected ? " (선택됨)" : ""}`}
                >
                  <div className={`text-[10px] ${isSelected ? "text-white/85" : wd.isToday ? "text-primary" : "text-ink-3"}`}>
                    {wd.dowKor}
                  </div>
                  <div className={`text-xs font-bold mt-0.5 ${isSelected ? "text-white" : wd.isToday ? "text-primary" : "text-ink"}`}>
                    {wd.day}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 시간-블록 캘린더 본문 */}
      <div className="px-3 pt-2">
        <div
          className={`grid gap-0 ${layoutMode === "day" ? "grid-cols-[44px_1fr]" : "grid-cols-[44px_repeat(7,1fr)]"}`}
          role="grid"
          aria-label={layoutMode === "day" ? `${dayLabel} 일정` : `주간 일정 — ${weekRangeLabel}`}
        >
          <TimeAxis />
          {visibleColumns.map((wd, i) => {
            const key = `${wd.date.getUTCFullYear()}-${wd.date.getUTCMonth() + 1}-${wd.date.getUTCDate()}`;
            const blocks = blocksByDay.get(key) ?? [];
            return (
              <DayColumn
                key={i}
                date={wd.date}
                isToday={wd.isToday}
                isPast={wd.isPast}
                blocks={blocks}
                studentMap={studentMap}
                onEmptyClick={onEmptyClick}
                onBlockClick={onBlockClick}
                isLastColumn={i === visibleColumns.length - 1}
              />
            );
          })}
        </div>

        {/* 안내 + 범례 */}
        <p className="mt-3 text-[11px] text-ink-3 px-1">
          빈 영역을 탭하면 그 시간에 레슨을 잡을 수 있어요. 레슨 블록을 탭하면 상세보기가 열립니다.
        </p>

        <div className="mt-3 mb-6 flex flex-wrap gap-x-3 gap-y-1.5 p-3 bg-soft rounded-xl">
          <LegendDot color="border-l-amber-500 bg-amber-50" label="레슨 신청" />
          <LegendDot color="border-l-violet-500 bg-violet-50" label="레슨 예정" />
          <LegendDot color="border-l-red-500 bg-red-50" label="진행중" />
          <LegendDot color="border-l-blue-500 bg-blue-50" label="완료 / 변경완료" />
          <LegendDot color="border-l-gray-400 bg-gray-100" label="결강" />
          <LegendDot color="border-l-orange-500 bg-orange-50" label="변경 / 보강 요청" />
          <LegendDot color="border-l-emerald-500 bg-emerald-50" label="보강" />
        </div>
      </div>

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
          pendingComplete={pendingComplete}
          pendingAbsent={pendingAbsent}
          pendingPaid={pendingPaid}
          onCancel={onCancelLesson}
          onSaveNotes={onSaveLessonNotes}
          onRestore={onRestoreLesson}
          onComplete={onCompleteLesson}
          onAbsent={onAbsentLesson}
          onMarkPaid={onMarkPaid}
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

// ---------- 좌측 시간 축 ----------
function TimeAxis() {
  const totalHeight = TOTAL_HOURS * HOUR_HEIGHT_PX;
  return (
    <div className="relative" style={{ height: totalHeight }} aria-hidden>
      {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
        const hour = DAY_START_HOUR + i;
        const top = i * HOUR_HEIGHT_PX;
        return (
          <div
            key={i}
            className="absolute right-1 text-[10px] text-ink-3 tabular-nums"
            style={{ top: top - 6 }}
          >
            {String(hour).padStart(2, "0")}:00
          </div>
        );
      })}
    </div>
  );
}

// ---------- 하루 컬럼 ----------
function DayColumn({
  date,
  isToday,
  isPast,
  blocks,
  studentMap,
  onEmptyClick,
  onBlockClick,
  isLastColumn,
}: {
  date: Date;
  isToday: boolean;
  isPast: boolean;
  blocks: LessonBlock[];
  studentMap: Map<string, StudentOption>;
  onEmptyClick: (date: Date, hour: number, minute: number) => void;
  onBlockClick: (lesson: LessonRow) => void;
  isLastColumn: boolean;
}) {
  const totalHeight = TOTAL_HOURS * HOUR_HEIGHT_PX;
  const dayStartMin = DAY_START_HOUR * 60;

  const onAreaClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const totalMinFromStart = (y / HOUR_HEIGHT_PX) * 60;
    // 10분 단위 스냅
    const snapped = Math.floor(totalMinFromStart / SNAP_MIN) * SNAP_MIN;
    const hour = DAY_START_HOUR + Math.floor(snapped / 60);
    const minute = snapped % 60;
    onEmptyClick(date, hour, minute);
  };

  // 현재 시각 라인 (오늘 컬럼만)
  let nowLineTop: number | null = null;
  if (isToday) {
    const nowKst = new Date(Date.now() + KST_OFFSET_MS);
    const nowMin = nowKst.getUTCHours() * 60 + nowKst.getUTCMinutes();
    if (nowMin >= dayStartMin && nowMin <= DAY_END_HOUR * 60) {
      nowLineTop = ((nowMin - dayStartMin) / 60) * HOUR_HEIGHT_PX;
    }
  }

  return (
    <div
      className={`relative border-l border-line/60 ${isLastColumn ? "border-r" : ""} ${isPast ? "bg-soft/30" : "bg-surface"}`}
      style={{ height: totalHeight }}
      role="gridcell"
      aria-label={`${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 일정 컬럼`}
    >
      {/* hour 그리드 라인 — 매시 정각 진한 선 + 30분 흐린 선 */}
      {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
        <div
          key={`hour-${i}`}
          className="absolute left-0 right-0 border-t border-line/40 pointer-events-none"
          style={{ top: i * HOUR_HEIGHT_PX }}
        />
      ))}
      {Array.from({ length: TOTAL_HOURS }, (_, i) => (
        <div
          key={`half-${i}`}
          className="absolute left-0 right-0 border-t border-line/15 pointer-events-none"
          style={{ top: i * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX / 2 }}
        />
      ))}

      {/* 빈 영역 클릭 오버레이 — 블록 아래에 깔림 (DOM 순서) */}
      <button
        type="button"
        onClick={onAreaClick}
        aria-label={`${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 — 빈 시간 탭해서 레슨 잡기`}
        className="absolute inset-0 cursor-cell hover:bg-primary/[0.04] focus:outline-none focus-visible:bg-primary/[0.06]"
      />

      {/* 레슨 블록 */}
      {blocks.map((b) => (
        <LessonBlockView
          key={b.lesson.id}
          block={b}
          studentMap={studentMap}
          onClick={() => onBlockClick(b.lesson)}
        />
      ))}

      {/* 현재 시각 라인 */}
      {nowLineTop != null && (
        <div
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{ top: nowLineTop }}
          aria-hidden
        >
          <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-red-500 shadow" />
          <div className="h-[2px] bg-red-500" />
        </div>
      )}
    </div>
  );
}

// ---------- 레슨 블록 ----------
function LessonBlockView({
  block,
  studentMap,
  onClick,
}: {
  block: LessonBlock;
  studentMap: Map<string, StudentOption>;
  onClick: () => void;
}) {
  const { lesson, startMin, endMin, laneIdx, laneCount } = block;
  const dayStartMin = DAY_START_HOUR * 60;
  const topPx = ((startMin - dayStartMin) / 60) * HOUR_HEIGHT_PX;
  const heightPx = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT_PX - 2, 20);
  const leftPct = (laneIdx / laneCount) * 100;
  const widthPct = (1 / laneCount) * 100;

  const student = studentMap.get(lesson.studentId);
  const studentName = student?.name ?? "이름 미입력";
  const displayStatus = deriveDisplayStatus(lesson.status, lesson.scheduledAt, lesson.durationMinutes);
  const accent = getStatusBlockAccent(displayStatus);
  const statusLabel = getStatusLabel(displayStatus);

  // 짧은 블록(30분 미만)은 한 줄만 표시
  const isVeryShort = heightPx < 30;
  const isShort = heightPx < 48;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        position: "absolute",
        top: `${topPx}px`,
        height: `${heightPx}px`,
        left: `calc(${leftPct}% + 1px)`,
        width: `calc(${widthPct}% - 2px)`,
      }}
      className={`absolute rounded-md border-l-4 px-1.5 py-0.5 text-left overflow-hidden transition active:scale-[0.99] hover:shadow-md hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 z-[5] ${accent.bg} ${accent.border}`}
      title={`${studentName} · ${hmRange(startMin, endMin)} · ${statusLabel.text}`}
      aria-label={`${studentName} ${hmRange(startMin, endMin)} ${statusLabel.text}`}
    >
      <div
        className={`font-bold truncate ${accent.text} ${
          isVeryShort ? "text-[10px] leading-none" : "text-[11px] leading-tight"
        }`}
      >
        {studentName}
      </div>
      {!isVeryShort && (
        <div className="mt-0.5 flex items-center gap-1 text-[9px] text-ink-2 leading-tight">
          <span className="tabular-nums truncate">{hmRange(startMin, endMin)}</span>
          {!isShort && lesson.paymentStatus === "UNPAID" && (
            <span className="text-red-500 font-semibold flex-none">· 미결제</span>
          )}
          {!isShort && lesson.paymentStatus === "PAID" && (
            <span className="text-emerald-600 flex-none">· 결제</span>
          )}
        </div>
      )}
      {/* 60분 이상 + lane이 1개면 상태 라벨도 한 줄 더 표시 */}
      {heightPx >= 60 && laneCount === 1 && (
        <div className={`mt-0.5 text-[9px] font-semibold ${accent.text} opacity-80 truncate`}>
          {statusLabel.text}
        </div>
      )}
    </button>
  );
}

// ---------- 범례 ----------
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded-sm border-l-4 ${color}`} />
      <span className="text-[10px] text-ink-3">{label}</span>
    </div>
  );
}
