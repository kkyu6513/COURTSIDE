"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertModal } from "@/components/alert-modal";
import { Toast } from "@/components/toast";
import { StudentPickerSheet, type StudentOption } from "@/components/coach/student-picker-sheet";
import { LessonListSheet, type LessonDetail } from "@/components/coach/lesson-list-sheet";
import { bookLesson, bookRecurringLessons } from "@/app/coach/schedule/actions";
import {
  deriveDisplayStatus,
  getStatusBlockAccent,
  getStatusLabel,
} from "@/lib/lesson-status";
import { KST_OFFSET_MS, PAST_GRACE_MS, parseIsoUtc } from "@/lib/kst";

export type LessonRow = {
  id: number;
  studentId: string;
  scheduledAt: string; // ISO
  durationMinutes: number;
  // DB lessons.status — 12종 + 미래 확장 대비 string. 라벨/색은 @/lib/lesson-status 단일 소스.
  status: string;
  paymentStatus?: string | null; // PAID | UNPAID | EXTERNAL | NONE
  lessonFormat?: string | null;  // PRIVATE | GROUP
  roundNumber?: number | null;
  totalRounds?: number | null;
  originalScheduledAt?: string | null;
  splitIndex?: number | null;
  splitTotal?: number | null;
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
const HOUR_HEIGHT_HOUR_MODE_PX = 56;    // 1시간 모드: 1시간 = 56px
const HOUR_HEIGHT_MINUTE10_MODE_PX = 144; // 10분 모드: 1시간 = 144px (10분 = 24px)
const SNAP_MIN = 10;        // 빈 영역 클릭 시 10분 단위로 스냅

type LayoutMode = "day" | "week";
type ZoomMode = "hour" | "minute10";

const STORAGE_KEY_ZOOM = "courtside.weekly.zoom";

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

// 한 그룹 안에서 동시에 보일 수 있는 최대 lane 수.
// 초과 시 visible lanes - 1 + "+N more" 배지로 압축 (#9).
const MAX_VISIBLE_LANES = 3;

type LessonBlock = {
  kind: "lesson";
  lesson: LessonRow;
  startMin: number;        // 클립 후 dayDate 기준 분 (렌더 위치)
  endMin: number;          // 클립 후
  startTimeLabel: string;  // 실제 KST "HH:MM"  (전날 23:30 등 절대 시각)
  endTimeLabel: string;    // 실제 KST "HH:MM"
  clipTop: boolean;        // dayDate 06:00 이전 시작 — 위쪽 잘림 (#1)
  clipBottom: boolean;     // dayDate 24:00 이후 종료 — 아래쪽 잘림 (#2)
  laneIdx: number;
  laneCount: number;
};

type OverflowBlock = {
  kind: "overflow";
  startMin: number;
  endMin: number;
  lessons: LessonRow[];  // 숨겨진 lessons
  laneIdx: number;       // 마지막 lane 위치
  laneCount: number;
};

type AnyBlock = LessonBlock | OverflowBlock;

/**
 * 하루치 레슨을 시간-블록으로 레이아웃.
 * - 가시 범위 [06:00, 24:00] 밖이면 클립 + clipTop/clipBottom 플래그
 * - 시간 겹침 그룹 → greedy 레인 할당 (구글 캘린더 day-view 패턴)
 * - lane 수가 MAX_VISIBLE_LANES 초과 시 첫 N-1 lane 표시 + "+N more" 배지 (#9)
 * - 정렬: 시작 시각 → 종료 시각 → 학생명(가나다) (#10)
 */
function layoutDayBlocks(
  lessons: LessonRow[],
  dayDate: Date,
  studentNameOf: (id: string) => string,
): AnyBlock[] {
  if (lessons.length === 0) return [];

  const dayStartMin = DAY_START_HOUR * 60;
  const dayEndMin = DAY_END_HOUR * 60;
  // dayDate는 KST trick — getTime() = KST midnight + 9h.
  // 실제 UTC ms of KST midnight = dayDate.getTime() - KST_OFFSET_MS
  const dayUtcMidnightMs = dayDate.getTime() - KST_OFFSET_MS;

  const items: {
    lesson: LessonRow;
    startMin: number;
    endMin: number;
    startTimeLabel: string;
    endTimeLabel: string;
    clipTop: boolean;
    clipBottom: boolean;
  }[] = [];
  for (const l of lessons) {
    const lessonStartMs = parseIsoUtc(l.scheduledAt).getTime();
    const lessonEndMs = lessonStartMs + l.durationMinutes * 60 * 1000;
    // dayDate 자정 기준 상대 분 — 전날 시작이면 음수, 다음날 종료면 1440 초과
    const sRel = (lessonStartMs - dayUtcMidnightMs) / 60000;
    const eRel = (lessonEndMs - dayUtcMidnightMs) / 60000;
    const s = Math.max(sRel, dayStartMin);
    const e = Math.min(eRel, dayEndMin);
    if (e <= s) continue;
    // 절대 KST 시각 라벨 — 잘린 위/아래에서도 실제 시작/종료 시각 표시 (#1, #2)
    const startKst = new Date(lessonStartMs + KST_OFFSET_MS);
    const endKst = new Date(lessonEndMs + KST_OFFSET_MS);
    const startTimeLabel = `${String(startKst.getUTCHours()).padStart(2, "0")}:${String(startKst.getUTCMinutes()).padStart(2, "0")}`;
    const endTimeLabel = `${String(endKst.getUTCHours()).padStart(2, "0")}:${String(endKst.getUTCMinutes()).padStart(2, "0")}`;
    items.push({
      lesson: l,
      startMin: s,
      endMin: e,
      startTimeLabel,
      endTimeLabel,
      clipTop: sRel < dayStartMin,
      clipBottom: eRel > dayEndMin,
    });
  }
  items.sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    if (a.endMin !== b.endMin) return a.endMin - b.endMin;
    return studentNameOf(a.lesson.studentId).localeCompare(
      studentNameOf(b.lesson.studentId),
      "ko",
    );
  });

  // 충돌 그룹 추출
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

  // 그룹 내 greedy lane 할당 + 오버플로우 압축
  const out: AnyBlock[] = [];
  for (const group of groups) {
    const laneEnds: number[] = [];
    const assigned: { it: typeof group[0]; laneIdx: number }[] = [];
    for (const it of group) {
      let lane = laneEnds.findIndex((e) => e <= it.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(it.endMin);
      } else {
        laneEnds[lane] = it.endMin;
      }
      assigned.push({ it, laneIdx: lane });
    }
    const totalLanes = laneEnds.length;

    if (totalLanes <= MAX_VISIBLE_LANES) {
      for (const a of assigned) {
        out.push({
          kind: "lesson",
          lesson: a.it.lesson,
          startMin: a.it.startMin,
          endMin: a.it.endMin,
          startTimeLabel: a.it.startTimeLabel,
          endTimeLabel: a.it.endTimeLabel,
          clipTop: a.it.clipTop,
          clipBottom: a.it.clipBottom,
          laneIdx: a.laneIdx,
          laneCount: totalLanes,
        });
      }
    } else {
      const visibleLanes = MAX_VISIBLE_LANES - 1; // 2
      const visible = assigned.filter((a) => a.laneIdx < visibleLanes);
      const overflow = assigned.filter((a) => a.laneIdx >= visibleLanes);
      for (const a of visible) {
        out.push({
          kind: "lesson",
          lesson: a.it.lesson,
          startMin: a.it.startMin,
          endMin: a.it.endMin,
          startTimeLabel: a.it.startTimeLabel,
          endTimeLabel: a.it.endTimeLabel,
          clipTop: a.it.clipTop,
          clipBottom: a.it.clipBottom,
          laneIdx: a.laneIdx,
          laneCount: MAX_VISIBLE_LANES,
        });
      }
      if (overflow.length > 0) {
        const startMin = Math.min(...overflow.map((o) => o.it.startMin));
        const endMin = Math.max(...overflow.map((o) => o.it.endMin));
        out.push({
          kind: "overflow",
          startMin,
          endMin,
          lessons: overflow.map((o) => o.it.lesson),
          laneIdx: visibleLanes, // 마지막 슬롯
          laneCount: MAX_VISIBLE_LANES,
        });
      }
    }
  }
  return out;
}

// ---------- 컴포넌트 ----------

export function WeeklyTimetable({
  lessons: initialLessons = [],
  students: initialStudents = [],
  initialDate,
}: Props) {
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
  // 초기값: localStorage > 디폴트 week (주간 보기)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(LAYOUT_MODE_KEY);
    if (saved === "day" || saved === "week") {
      setLayoutModeState(saved);
    }
    // saved 없으면 week 유지 (보스 지정: 디폴트 = 주간 10분 단위 보기)
  }, []);
  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setLayoutModeState(mode);
    try {
      window.localStorage.setItem(LAYOUT_MODE_KEY, mode);
    } catch {
      /* localStorage 비활성 — 무시 */
    }
  }, []);

  // ----- 줌 모드 (hour / minute10) — 디폴트: minute10 (10분 단위 보기) -----
  const [zoom, setZoomState] = useState<ZoomMode>("minute10");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY_ZOOM);
    if (saved === "hour" || saved === "minute10") setZoomState(saved);
  }, []);
  const setZoom = useCallback((m: ZoomMode) => {
    setZoomState(m);
    try {
      window.localStorage.setItem(STORAGE_KEY_ZOOM, m);
    } catch {
      /* noop */
    }
  }, []);
  const hourHeight = zoom === "minute10" ? HOUR_HEIGHT_MINUTE10_MODE_PX : HOUR_HEIGHT_HOUR_MODE_PX;

  // day 모드 선택된 요일 (0=월 ~ 6=일). initialDate 우선, 없으면 오늘 요일 (#43)
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
      const d = new Date(initialDate + "T00:00:00Z");
      return (d.getUTCDay() + 6) % 7;
    }
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
      const nextWeekStart = startOfWeekMon(parseIsoUtc(sorted[0].scheduledAt));
      setWeekStart(nextWeekStart);
      // 자동 점프 알림 (#22) — 사용자에게 "왜 이번 주가 안 보이는지" 설명
      const nws = formatKstDate(nextWeekStart);
      const nwe = formatKstDate(addDays(nextWeekStart, 6));
      setToast({
        open: true,
        title: "가장 가까운 미래 레슨이 있는 주로 이동했어요",
        description: `${nws.m}/${nws.day} ~ ${nwe.m}/${nwe.day}`,
      });
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
  const [lessonList, setLessonList] = useState<{
    open: boolean;
    hourLabel: string;
    lessons: LessonDetail[];
  } | null>(null);
  const [pendingStudentId, setPendingStudentId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  // 본문 컨테이너 + 현재 시각 라인 ref — "오늘" 클릭 시 scrollIntoView
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const nowLineRef = useRef<HTMLDivElement | null>(null);

  // 진입 시 한 번 — 오늘 컬럼의 현재 시각 라인으로 자동 포커싱 (#initial-focus)
  // 조건: initialDate(URL 강제) 없을 때만, nowLineRef 가 마운트된 직후 즉시 1회.
  const didInitialFocusRef = useRef(false);
  useEffect(() => {
    if (didInitialFocusRef.current) return;
    if (initialDate) {
      // 사용자가 명시적으로 다른 주를 지정했으면 자동 포커스 안 함
      didInitialFocusRef.current = true;
      return;
    }
    if (!nowLineRef.current) return; // 오늘 컬럼이 아직 안 보임 (day 모드에서 다른 요일 선택 등)
    didInitialFocusRef.current = true;
    // 첫 paint 직후 실행 — smooth 가 아니라 즉시(auto) 로 깔끔하게
    requestAnimationFrame(() => {
      nowLineRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
    });
  });

  // 현재 시각 (KST 분) — 1분마다 갱신 (#29)
  const [nowMin, setNowMin] = useState<number | null>(() => {
    const k = new Date(Date.now() + KST_OFFSET_MS);
    return k.getUTCHours() * 60 + k.getUTCMinutes();
  });
  useEffect(() => {
    const tick = () => {
      const k = new Date(Date.now() + KST_OFFSET_MS);
      setNowMin(k.getUTCHours() * 60 + k.getUTCMinutes());
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
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

  const studentMap = useMemo(() => {
    const map = new Map<string, StudentOption>();
    for (const s of students) map.set(s.id, s);
    return map;
  }, [students]);

  // 일별 lesson 인덱스 → 그룹화 + 레인 할당.
  // 자정 가로지름 레슨은 시작일에 클립된 부분, 다음 날에 잔여 부분 동시 렌더 (#2).
  const blocksByDay = useMemo(() => {
    const m = new Map<string, AnyBlock[]>();
    const visibleStartMs = weekStart.getTime() - KST_OFFSET_MS;
    const visibleEndMs = visibleStartMs + 7 * 24 * 60 * 60 * 1000;

    // 자정 가로지름 — 같은 lesson이 두 날짜에 등장하도록 분할 매핑
    const byDay = new Map<string, LessonRow[]>();
    const addToDay = (key: string, l: LessonRow) => {
      const arr = byDay.get(key) ?? [];
      arr.push(l);
      byDay.set(key, arr);
    };
    for (const l of lessons) {
      if (l.status === "CANCELLED") continue;
      const startMs = parseIsoUtc(l.scheduledAt).getTime();
      const endMs = startMs + l.durationMinutes * 60 * 1000;
      if (endMs <= visibleStartMs || startMs >= visibleEndMs) continue;
      const startKst = new Date(startMs + KST_OFFSET_MS);
      const startDayKey = `${startKst.getUTCFullYear()}-${startKst.getUTCMonth() + 1}-${startKst.getUTCDate()}`;
      addToDay(startDayKey, l);
      // 자정 가로지름 — 종료가 다음 날이면 다음 날에도 추가 (#2)
      const endKst = new Date(endMs + KST_OFFSET_MS);
      const endDayKey = `${endKst.getUTCFullYear()}-${endKst.getUTCMonth() + 1}-${endKst.getUTCDate()}`;
      if (startDayKey !== endDayKey) {
        addToDay(endDayKey, l);
      }
    }

    const studentNameOf = (id: string) => studentMap.get(id)?.name ?? "";
    for (const wd of weekDays) {
      const key = `${wd.date.getUTCFullYear()}-${wd.date.getUTCMonth() + 1}-${wd.date.getUTCDate()}`;
      m.set(key, layoutDayBlocks(byDay.get(key) ?? [], wd.date, studentNameOf));
    }
    return m;
  }, [lessons, weekStart, weekDays, studentMap]);

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
    // 시각 피드백 — now-line으로 부드럽게 스크롤 (이미 그 주에 있어도 동작) (#20)
    setTimeout(() => {
      nowLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
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

  // ----- 블록 클릭 → 레슨 상세 페이지 -----
  const onBlockClick = (lesson: LessonRow) => {
    router.push(`/coach/lessons/${lesson.id}`);
  };

  // ----- 오버플로우 배지 클릭 → 리스트 시트 -----
  const onOverflowClick = (date: Date, overflowLessons: LessonRow[]) => {
    const f = formatKstDate(date);
    setLessonList({
      open: true,
      hourLabel: `${f.m}월 ${f.day}일 ${DOW_KOR[f.dow]}요일 · 겹친 레슨`,
      lessons: overflowLessons.map(toLessonDetail),
    });
  };
  const closeLessonList = () => setLessonList((s) => (s ? { ...s, open: false } : null));
  const onPickLessonFromList = (lesson: LessonDetail) => {
    setLessonList(null);
    router.push(`/coach/lessons/${lesson.id}`);
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
    if (cellUtcMs < Date.now() - PAST_GRACE_MS) {
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
  // 레슨 상세/취소/완료/결강/결제확인/복구/메모는 /coach/lessons/[id] 상세 페이지에서 처리.
  const closeStudentPicker = () => setStudentPicker((s) => (s ? { ...s, open: false } : null));

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
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold text-ink truncate">{yearMonthLabel}</div>
            {layoutMode === "day" && selectedDayMeta && (
              <div className="text-[11px] font-semibold text-ink-2 truncate">{dayLabel}</div>
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

            {/* 줌 토글 — 1시간/10분 단위 (디폴트: 10분) */}
            <div className="flex rounded-lg bg-soft p-0.5 mr-1" role="group" aria-label="시간 단위">
              <button
                type="button"
                onClick={() => setZoom("hour")}
                aria-pressed={zoom === "hour"}
                title="1시간 단위 — 한눈에 보기"
                className={`px-2.5 h-8 rounded-md text-[11px] font-semibold transition ${
                  zoom === "hour" ? "bg-surface text-ink shadow-sm" : "text-ink-3"
                }`}
              >
                1시간
              </button>
              <button
                type="button"
                onClick={() => setZoom("minute10")}
                aria-pressed={zoom === "minute10"}
                title="10분 단위 — 정밀 보기 (기본)"
                className={`px-2.5 h-8 rounded-md text-[11px] font-semibold transition ${
                  zoom === "minute10" ? "bg-surface text-ink shadow-sm" : "text-ink-3"
                }`}
              >
                10분
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

      {/* 시간-블록 캘린더 본문 — day 모드는 데스크탑에서 max-w로 중앙 정렬 (#18) */}
      <div
        ref={bodyRef}
        className={`px-3 pt-2 ${layoutMode === "day" ? "mx-auto w-full max-w-[480px]" : ""}`}
      >
        <div
          className={`grid gap-0 ${layoutMode === "day" ? "grid-cols-[44px_1fr]" : "grid-cols-[44px_repeat(7,1fr)]"}`}
          role="grid"
          aria-label={layoutMode === "day" ? `${dayLabel} 일정` : `주간 일정 — ${weekRangeLabel}`}
        >
          <TimeAxis nowMin={nowMin} hourHeight={hourHeight} zoom={zoom} />
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
                onOverflowClick={onOverflowClick}
                isLastColumn={i === visibleColumns.length - 1}
                nowLineRef={wd.isToday ? nowLineRef : undefined}
                nowMin={nowMin}
                hourHeight={hourHeight}
                zoom={zoom}
              />
            );
          })}
        </div>

        {/* 안내 + 범례 */}
        <p className="mt-3 text-[11px] text-ink-3 px-1">
          빈 영역을 탭하면 그 시간에 레슨을 잡을 수 있어요. 레슨 블록을 탭하면 상세보기가 열립니다.
        </p>

        {/* 범례 — 접기 가능 (#35) */}
        <details className="mt-3 mb-6 group">
          <summary className="cursor-pointer text-[11px] font-semibold text-ink-2 px-1 py-1 inline-flex items-center gap-1 hover:text-ink list-none">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform group-open:rotate-90"
              aria-hidden
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            상태별 색상 안내
          </summary>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 p-3 bg-soft rounded-xl">
            <LegendDot color="border-l-amber-500 bg-amber-50" label="레슨 신청" />
            <LegendDot color="border-l-violet-500 bg-violet-50" label="레슨 예정" />
            <LegendDot color="border-l-red-500 bg-red-50" label="진행중" />
            <LegendDot color="border-l-blue-500 bg-blue-50" label="완료 / 변경완료" />
            <LegendDot color="border-l-gray-400 bg-gray-100" label="결강" />
            <LegendDot color="border-l-orange-500 bg-orange-50" label="변경 / 보강 요청" />
            <LegendDot color="border-l-emerald-500 bg-emerald-50" label="보강" />
          </div>
        </details>
      </div>

      {studentPicker && (
        <StudentPickerSheet
          open={studentPicker.open}
          onClose={closeStudentPicker}
          baseTimeLabel={studentPicker.baseTimeLabel}
          hour={studentPicker.hour}
          initialMinute={studentPicker.minute}
          students={students}
          pendingStudentId={pendingStudentId}
          onPick={onPickStudent}
        />
      )}

      {lessonList && (
        <LessonListSheet
          open={lessonList.open}
          onClose={closeLessonList}
          hourLabel={lessonList.hourLabel}
          lessons={lessonList.lessons}
          onPickLesson={onPickLessonFromList}
          onBookNew={() => { /* 오버플로우 시트에서는 + 잡기 미사용 — picker 직행이 빈 영역 클릭으로 가능 */ closeLessonList(); }}
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
function TimeAxis({
  nowMin,
  hourHeight,
  zoom,
}: {
  nowMin: number | null;
  hourHeight: number;
  zoom: ZoomMode;
}) {
  const totalHeight = TOTAL_HOURS * hourHeight;
  const dayStartMin = DAY_START_HOUR * 60;
  const nowTop =
    nowMin != null && nowMin >= dayStartMin && nowMin <= DAY_END_HOUR * 60
      ? ((nowMin - dayStartMin) / 60) * hourHeight
      : null;
  return (
    <div className="relative" style={{ height: totalHeight }} aria-hidden>
      {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
        const hour = DAY_START_HOUR + i;
        const top = i * hourHeight;
        return (
          <div key={`h-${i}`}>
            <div
              className="absolute right-1 text-[10px] text-ink-3 tabular-nums leading-none"
              style={{ top: top - 5 }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
            {/* 10분 모드: 10/20/30/40/50 마이너 라벨 6칸. 1시간 모드: :30 1칸만 */}
            {i < TOTAL_HOURS && zoom === "minute10" && (
              <>
                {[10, 20, 30, 40, 50].map((m) => (
                  <div
                    key={`m-${i}-${m}`}
                    className="absolute right-1 text-[8px] text-ink-3/60 tabular-nums leading-none"
                    style={{ top: top + (m / 60) * hourHeight - 4 }}
                  >
                    :{m}
                  </div>
                ))}
              </>
            )}
            {i < TOTAL_HOURS && zoom === "hour" && (
              <div
                className="absolute right-1 text-[8px] text-ink-3/60 tabular-nums leading-none"
                style={{ top: top + hourHeight / 2 - 4 }}
              >
                :30
              </div>
            )}
          </div>
        );
      })}
      {/* 현재 시각 표식 — 시간축 우측 끝 (#28) */}
      {nowTop != null && (
        <div
          className="absolute -right-0.5 z-30 pointer-events-none"
          style={{ top: nowTop - 5 }}
          aria-hidden
        >
          <div
            className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[6px] border-l-red-500"
          />
        </div>
      )}
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
  onOverflowClick,
  isLastColumn,
  nowLineRef,
  nowMin,
  hourHeight,
  zoom,
}: {
  date: Date;
  isToday: boolean;
  isPast: boolean;
  blocks: AnyBlock[];
  studentMap: Map<string, StudentOption>;
  onEmptyClick: (date: Date, hour: number, minute: number) => void;
  onBlockClick: (lesson: LessonRow) => void;
  onOverflowClick: (date: Date, lessons: LessonRow[]) => void;
  isLastColumn: boolean;
  nowLineRef?: React.RefObject<HTMLDivElement>;
  nowMin: number | null;
  hourHeight: number;
  zoom: ZoomMode;
}) {
  const totalHeight = TOTAL_HOURS * hourHeight;
  const dayStartMin = DAY_START_HOUR * 60;

  const onAreaClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    let hour = 9;   // 키보드 활성화 시 기본값 — 9:00
    let minute = 0;
    // clientY === 0 은 키보드(Enter/Space) 활성화 신호. 그 외엔 클릭 좌표 사용 (#13)
    if (e.clientY > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      const totalMinFromStart = (y / hourHeight) * 60;
      const snapped = Math.floor(totalMinFromStart / SNAP_MIN) * SNAP_MIN;
      hour = DAY_START_HOUR + Math.floor(snapped / 60);
      minute = snapped % 60;
    }
    onEmptyClick(date, hour, minute);
  };

  // 현재 시각 라인 (오늘 컬럼만) — nowMin 1분 단위 갱신으로 정확 (#29)
  let nowLineTop: number | null = null;
  if (isToday && nowMin != null && nowMin >= dayStartMin && nowMin <= DAY_END_HOUR * 60) {
    nowLineTop = ((nowMin - dayStartMin) / 60) * hourHeight;
  }

  return (
    <div
      className={`relative border-l border-line/60 ${isLastColumn ? "border-r" : ""} ${isPast ? "bg-soft/30" : "bg-surface"}`}
      style={{ height: totalHeight }}
      role="gridcell"
      aria-label={`${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 일정 컬럼`}
    >
      {/* hour 그리드 라인 — 매시 정각 진한 선 */}
      {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
        <div
          key={`hour-${i}`}
          className="absolute left-0 right-0 border-t border-line/40 pointer-events-none"
          style={{ top: i * hourHeight }}
        />
      ))}
      {/* 보조 그리드: 10분 모드는 10/20/30/40/50분, 1시간 모드는 30분만 */}
      {zoom === "minute10"
        ? Array.from({ length: TOTAL_HOURS }).map((_, i) => (
            <div key={`m-${i}`}>
              {[10, 20, 30, 40, 50].map((m) => (
                <div
                  key={`m-${i}-${m}`}
                  className={`absolute left-0 right-0 border-t pointer-events-none ${
                    m === 30 ? "border-line/40 border-dashed" : "border-line/20"
                  }`}
                  style={{ top: i * hourHeight + (m / 60) * hourHeight }}
                />
              ))}
            </div>
          ))
        : Array.from({ length: TOTAL_HOURS }, (_, i) => (
            <div
              key={`half-${i}`}
              className="absolute left-0 right-0 border-t border-dashed border-line/40 pointer-events-none"
              style={{ top: i * hourHeight + hourHeight / 2 }}
            />
          ))}

      {/* 빈 영역 클릭 오버레이 — 블록 아래에 깔림 (DOM 순서) */}
      <button
        type="button"
        onClick={onAreaClick}
        aria-label={`${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 — 빈 시간 탭해서 레슨 잡기`}
        className="absolute inset-0 cursor-cell hover:bg-primary/10 active:bg-primary/15 focus:outline-none focus-visible:bg-primary/15"
      />

      {/* 레슨 블록 + 오버플로우 배지 */}
      {blocks.map((b, i) =>
        b.kind === "lesson" ? (
          <LessonBlockView
            key={`l-${b.lesson.id}-${i}`}
            block={b}
            studentMap={studentMap}
            onClick={() => onBlockClick(b.lesson)}
            hourHeight={hourHeight}
          />
        ) : (
          <OverflowBadge
            key={`o-${i}-${b.startMin}`}
            block={b}
            onClick={() => onOverflowClick(date, b.lessons)}
            hourHeight={hourHeight}
          />
        ),
      )}

      {/* 현재 시각 라인 */}
      {nowLineTop != null && (
        <div
          ref={nowLineRef}
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
  hourHeight,
}: {
  block: LessonBlock;
  studentMap: Map<string, StudentOption>;
  onClick: () => void;
  hourHeight: number;
}) {
  const {
    lesson, startMin, endMin, startTimeLabel, endTimeLabel,
    clipTop, clipBottom, laneIdx, laneCount,
  } = block;
  const dayStartMin = DAY_START_HOUR * 60;
  const topPx = ((startMin - dayStartMin) / 60) * hourHeight;
  const heightPx = Math.max(((endMin - startMin) / 60) * hourHeight - 2, 20);
  const leftPct = (laneIdx / laneCount) * 100;
  const widthPct = (1 / laneCount) * 100;

  const student = studentMap.get(lesson.studentId);
  const studentName = student?.name ?? "이름 미입력";
  const displayStatus = deriveDisplayStatus(lesson.status, lesson.scheduledAt, lesson.durationMinutes);
  const accent = getStatusBlockAccent(displayStatus);
  const statusLabel = getStatusLabel(displayStatus);

  // ABSENT는 학생명에 line-through (#7)
  const isAbsent = lesson.status === "ABSENT";
  // 형식 표시 (#5)
  const isGroup = lesson.lessonFormat === "GROUP";
  const formatLabel = isGroup ? "그룹" : null; // 1:1은 생략 (기본값)
  // 회차 (#3)
  const roundLabel =
    lesson.roundNumber != null && lesson.totalRounds != null
      ? `${lesson.roundNumber}/${lesson.totalRounds}회`
      : null;
  // 메모 (#4)
  const notesLabel = lesson.notes && lesson.notes.trim() ? lesson.notes.trim() : null;

  // 사이즈 토큰
  const isVeryShort = heightPx < 30;
  const isShort = heightPx < 48;
  const isMedium = heightPx < 80;
  const isTall = heightPx >= 80;

  // 결제 인디케이터 — UNPAID는 항상 표시 (가장 시급한 정보, #8)
  const paymentDot = (() => {
    if (lesson.paymentStatus === "UNPAID") {
      return <span className="flex-none inline-block w-1.5 h-1.5 rounded-full bg-red-500" aria-label="미결제" title="미결제" />;
    }
    if (lesson.paymentStatus === "PAID") {
      return <span className="flex-none inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" aria-label="결제완료" title="결제완료" />;
    }
    if (lesson.paymentStatus === "EXTERNAL") {
      return <span className="flex-none inline-block w-1.5 h-1.5 rounded-full bg-sky-500" aria-label="외부결제" title="외부결제" />;
    }
    return null;
  })();

  // 접근성 라벨
  const ariaParts = [
    studentName,
    `${startTimeLabel} ~ ${endTimeLabel}`,
    statusLabel.text,
    formatLabel ?? "1:1",
    roundLabel,
    lesson.paymentStatus === "UNPAID" ? "미결제" : lesson.paymentStatus === "PAID" ? "결제완료" : null,
    clipTop ? "지난날부터 진행" : null,
    clipBottom ? "다음날까지 진행" : null,
  ].filter(Boolean).join(" · ");

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
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
      }}
      className={`absolute rounded-md border-l-4 px-1.5 py-0.5 text-left overflow-hidden transition active:scale-[0.99] hover:shadow-md hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 z-[5] cursor-pointer ${accent.bg} ${accent.border}`}
      title={ariaParts}
      aria-label={ariaParts}
    >
      {/* 위쪽 clip 인디케이터 — 전날부터 이어진 레슨 */}
      {clipTop && (
        <div className="absolute top-0 left-0 right-0 px-1 text-[8px] font-bold text-ink-3 bg-soft/80 leading-none py-0.5 truncate" aria-hidden>
          ↑ {startTimeLabel} 시작
        </div>
      )}

      {/* 1행 — 아바타 + 학생명 + 결제 점 */}
      <div className={`flex items-center gap-1 ${clipTop ? "mt-3" : ""}`}>
        {/* 학생 이니셜 아바타 — medium+ + lane 1개일 때만 (좁은 lane에서는 공간 부족) (#30) */}
        {!isVeryShort && !isShort && laneCount === 1 && (
          <span
            className={`flex-none w-4 h-4 rounded-full inline-flex items-center justify-center text-[9px] font-extrabold ${
              isGroup ? "bg-violet-200/70 text-violet-800" : "bg-primary/20 text-primary"
            }`}
            aria-hidden
          >
            {studentName.slice(0, 1)}
          </span>
        )}
        <div
          className={`font-bold truncate flex-1 min-w-0 ${accent.text} ${
            isAbsent ? "line-through" : ""
          } ${isVeryShort ? "text-[10px] leading-none" : "text-[11px] leading-tight"}`}
        >
          {studentName}
        </div>
        {paymentDot}
      </div>

      {/* 2행 — 시각 + 형식 + 회차 (very short는 생략) */}
      {!isVeryShort && (
        <div className="mt-0.5 flex items-center gap-1 text-[9px] text-ink-2 leading-tight truncate">
          <span className="tabular-nums flex-none">{startTimeLabel}~{endTimeLabel}</span>
          {formatLabel && (
            <span className="flex-none text-violet-700 font-semibold">· {formatLabel}</span>
          )}
          {!isShort && roundLabel && (
            <span className="flex-none text-ink-3">· {roundLabel}</span>
          )}
        </div>
      )}

      {/* 3행 — 메모 미리보기 (medium+ + lane 1개) */}
      {!isShort && notesLabel && laneCount === 1 && (
        <div className={`mt-0.5 text-[9px] text-ink-3 leading-tight truncate ${isAbsent ? "line-through" : ""}`}>
          {notesLabel}
        </div>
      )}

      {/* 4행 — 상태 라벨 (tall 이상이면 lane 수 무관하게 표시) (#32) */}
      {isTall && (
        <div className={`mt-0.5 text-[9px] font-semibold ${accent.text} opacity-80 truncate`}>
          {statusLabel.text}
        </div>
      )}

      {/* 아래쪽 clip 인디케이터 — 다음날까지 이어짐 */}
      {clipBottom && (
        <div className="absolute bottom-0 left-0 right-0 px-1 text-[8px] font-bold text-ink-3 bg-soft/80 leading-none py-0.5 truncate" aria-hidden>
          ↓ {endTimeLabel} 종료
        </div>
      )}
    </button>
  );
}

// ---------- 오버플로우 배지 (lane 4+ 시 일부 lessons를 압축) ----------
function OverflowBadge({
  block,
  onClick,
  hourHeight,
}: {
  block: OverflowBlock;
  onClick: () => void;
  hourHeight: number;
}) {
  const { startMin, endMin, lessons, laneIdx, laneCount } = block;
  const dayStartMin = DAY_START_HOUR * 60;
  const topPx = ((startMin - dayStartMin) / 60) * hourHeight;
  const heightPx = Math.max(((endMin - startMin) / 60) * hourHeight - 2, 20);
  const leftPct = (laneIdx / laneCount) * 100;
  const widthPct = (1 / laneCount) * 100;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        position: "absolute",
        top: `${topPx}px`,
        height: `${heightPx}px`,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
      }}
      className="absolute rounded-md border border-dashed border-ink-3/40 bg-ink/5 hover:bg-ink/10 px-1 py-0.5 flex flex-col items-center justify-center transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 z-[5] cursor-pointer"
      title={`+${lessons.length}개 레슨 더 보기`}
      aria-label={`+${lessons.length}개 레슨 — 탭하면 목록 열림`}
    >
      <span className="text-[10px] font-extrabold text-ink leading-none">+{lessons.length}</span>
      <span className="text-[8px] text-ink-3 leading-none mt-0.5">더 보기</span>
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
