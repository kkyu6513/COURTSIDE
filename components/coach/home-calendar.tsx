"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertModal } from "@/components/alert-modal";
import { StudentPickerSheet, type StudentOption } from "@/components/coach/student-picker-sheet";
import { bookLesson, bookRecurringLessons } from "@/app/coach/schedule/actions";
import { maskName } from "@/lib/masking";

type LessonRow = {
  id: number;
  studentId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  paymentStatus: string;
  lessonFormat: string;
  roundNumber: number | null;
  totalRounds: number | null;
  originalScheduledAt: string | null;
  splitIndex: number | null;
  splitTotal: number | null;
  notes: string | null;
};

const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];

// status → 표시 스타일 (디자인 가이드 — 중립 카드 / 상태는 텍스트 라벨로만 구분)
type StatusStyle = {
  label: string;
  color: string;
  faded?: boolean;
  strike?: boolean;
};

const STATUS_STYLES: Record<string, StatusStyle> = {
  PENDING: { label: "레슨 신청", color: "text-amber-600" },
  CONFIRMED: { label: "레슨 예정", color: "text-ink-2" },
  IN_PROGRESS: { label: "진행 중", color: "text-primary-600" },
  COMPLETED: { label: "레슨 완료", color: "text-ink-3", faded: true },
  ABSENT: { label: "결강", color: "text-ink-3", faded: true, strike: true },
  RESCHEDULE_REQUESTED: { label: "변경 요청", color: "text-amber-600" },
  RESCHEDULE_COMPLETED: { label: "변경 완료", color: "text-ink-3" },
  MAKEUP_PENDING: { label: "보강 일정 선택중", color: "text-amber-600" },
  MAKEUP_CONFIRMED: { label: "보강 확정", color: "text-ink-2" },
  MAKEUP_REQUESTED: { label: "보강 요청", color: "text-amber-600" },
  MERGE: { label: "통합 회차", color: "text-ink-2" },
  SPLIT: { label: "분할 회차", color: "text-ink-2" },
};

const FALLBACK_STYLE: StatusStyle = { label: "레슨", color: "text-ink-3" };

// 정렬 우선순위: 신청 > 진행중 > 보강요청 > 변경요청 > 보강일정 > 보강확정 > 변경완료 > 예정 > 완료 > 결강
const STATUS_SORT_ORDER: Record<string, number> = {
  PENDING: 0,
  IN_PROGRESS: 1,
  MAKEUP_REQUESTED: 2,
  RESCHEDULE_REQUESTED: 3,
  MAKEUP_PENDING: 4,
  MAKEUP_CONFIRMED: 5,
  RESCHEDULE_COMPLETED: 6,
  CONFIRMED: 7,
  MERGE: 7,
  SPLIT: 7,
  COMPLETED: 8,
  ABSENT: 9,
};

/** KST 날짜 + hour/minute → UTC ISO */
function cellToIso(kstTrickDate: Date, hour: number, minute: number): string {
  const utc = new Date(kstTrickDate);
  utc.setUTCHours(hour - 9, minute, 0, 0);
  return utc.toISOString();
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
  const n = new Date(d);
  n.setUTCDate(n.getUTCDate() + days);
  return n;
}

function parseIsoUtc(s: string): Date {
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + "Z");
}

function kstParts(d: Date) {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return {
    y: kst.getUTCFullYear(),
    m: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
    dow: kst.getUTCDay(),
    hh: String(kst.getUTCHours()).padStart(2, "0"),
    mm: String(kst.getUTCMinutes()).padStart(2, "0"),
  };
}

/** Date 객체(KST 자정 trick)의 일자 키 */
function dayKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

/**
 * DB status + 현재 시각으로 표시용 상태 도출.
 * CONFIRMED(레슨 예정) 레슨이 실제 진행 시간대(시작~종료)에 들어오면 IN_PROGRESS(진행중)로 표시.
 * 그 외에는 DB status를 그대로 사용.
 */
function deriveDisplayStatus(lesson: LessonRow): string {
  if (lesson.status === "CONFIRMED") {
    const start = parseIsoUtc(lesson.scheduledAt).getTime();
    const end = start + lesson.durationMinutes * 60 * 1000;
    const now = Date.now();
    if (now >= start && now < end) return "IN_PROGRESS";
  }
  return lesson.status;
}

/** 테스트 모드 기준 날짜 — 어제 */
function focusDate(testMode: boolean): Date {
  return testMode ? new Date(Date.now() - 24 * 60 * 60 * 1000) : new Date();
}

/** 어제(KST) 날짜의 hour:minute → UTC ISO */
function yesterdayIsoAt(hour: number, minute: number): string {
  const kst = new Date(Date.now() - 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000);
  kst.setUTCHours(hour, minute, 0, 0);
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

/** 테스트 모드 — 어제 날짜에 12종 상태 레슨 하드코딩 (DB 미사용) */
function buildTestData(): { lessons: LessonRow[]; studentNames: Record<string, string> } {
  const names = [
    "박민호", "김영희", "이민호", "최영수", "강민서", "박지수",
    "한지원", "정다은", "김태호", "이수진", "한지우", "최준혁",
  ];
  const studentNames: Record<string, string> = {};
  names.forEach((n, i) => {
    studentNames[`t${i + 1}`] = n;
  });

  const mk = (
    over: Partial<LessonRow> & {
      id: number;
      studentId: string;
      scheduledAt: string;
      status: string;
    },
  ): LessonRow => ({
    durationMinutes: 60,
    paymentStatus: "PAID",
    lessonFormat: "PRIVATE",
    roundNumber: null,
    totalRounds: null,
    originalScheduledAt: null,
    splitIndex: null,
    splitTotal: null,
    notes: null,
    ...over,
  });

  const lessons: LessonRow[] = [
    mk({ id: 1, studentId: "t1", scheduledAt: yesterdayIsoAt(9, 0), status: "PENDING", paymentStatus: "NONE", notes: "정규 1:1 · 화·목 09:00 희망" }),
    mk({ id: 2, studentId: "t2", scheduledAt: yesterdayIsoAt(10, 0), status: "CONFIRMED", paymentStatus: "UNPAID", roundNumber: 4, totalRounds: 8 }),
    mk({ id: 3, studentId: "t3", scheduledAt: yesterdayIsoAt(11, 0), status: "IN_PROGRESS", roundNumber: 6, totalRounds: 8 }),
    mk({ id: 4, studentId: "t4", scheduledAt: yesterdayIsoAt(12, 0), status: "COMPLETED", paymentStatus: "EXTERNAL", roundNumber: 5, totalRounds: 8 }),
    mk({ id: 5, studentId: "t5", scheduledAt: yesterdayIsoAt(13, 0), status: "ABSENT", lessonFormat: "GROUP", roundNumber: 3, totalRounds: 8 }),
    mk({ id: 6, studentId: "t6", scheduledAt: yesterdayIsoAt(14, 0), status: "RESCHEDULE_REQUESTED", roundNumber: 3, totalRounds: 8 }),
    mk({ id: 7, studentId: "t7", scheduledAt: yesterdayIsoAt(15, 0), status: "RESCHEDULE_COMPLETED", roundNumber: 5, totalRounds: 8, originalScheduledAt: yesterdayIsoAt(10, 0) }),
    mk({ id: 8, studentId: "t8", scheduledAt: yesterdayIsoAt(16, 0), status: "MAKEUP_PENDING", paymentStatus: "NONE", lessonFormat: "GROUP", notes: "보강" }),
    mk({ id: 9, studentId: "t9", scheduledAt: yesterdayIsoAt(16, 30), status: "MAKEUP_CONFIRMED", paymentStatus: "NONE", notes: "보강" }),
    mk({ id: 10, studentId: "t10", scheduledAt: yesterdayIsoAt(17, 0), status: "MAKEUP_REQUESTED", paymentStatus: "NONE", notes: "보강 요청" }),
    mk({ id: 11, studentId: "t11", scheduledAt: yesterdayIsoAt(18, 0), durationMinutes: 40, status: "MERGE", notes: "통합 (원 회차 2건)" }),
    mk({ id: 12, studentId: "t12", scheduledAt: yesterdayIsoAt(19, 0), durationMinutes: 20, status: "SPLIT", splitIndex: 1, splitTotal: 2, notes: "분할 (그룹 2건 중 1)" }),
  ];
  return { lessons, studentNames };
}

export function CoachHomeCalendar({ testMode = false }: { testMode?: boolean }) {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMon(focusDate(testMode)));
  const [selectedKey, setSelectedKey] = useState<string>(() => dayKeyOf(startOfWeekMon(focusDate(testMode))));
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingStudentId, setPendingStudentId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"status" | "time">("status");
  const [, startTransition] = useTransition();
  const [alert, setAlert] = useState<{
    open: boolean;
    variant: "success" | "error";
    title: string;
    description?: string;
  }>({ open: false, variant: "success", title: "" });

  // 오늘 키 (KST) — 캘린더 isToday 강조용
  const todayKey = useMemo(() => {
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return `${nowKst.getUTCFullYear()}-${nowKst.getUTCMonth() + 1}-${nowKst.getUTCDate()}`;
  }, []);

  // 첫 진입 시 선택할 날짜 — 일반: 오늘 / 테스트: 어제
  const focusKey = useMemo(() => {
    const kst = new Date(focusDate(testMode).getTime() + 9 * 60 * 60 * 1000);
    return `${kst.getUTCFullYear()}-${kst.getUTCMonth() + 1}-${kst.getUTCDate()}`;
  }, [testMode]);

  useEffect(() => {
    setSelectedKey(focusKey);
  }, [focusKey]);

  const reload = useCallback(async () => {
    // 테스트 모드 — DB 미사용, 어제 날짜 12종 하드코딩
    if (testMode) {
      const { lessons: testLessons, studentNames: testNames } = buildTestData();
      setLessons(testLessons);
      setStudentNames(testNames);
      setStudents([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/coach/lessons", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as {
          lessons: LessonRow[];
          students: StudentOption[];
          studentNames?: Record<string, string>;
        };
        setLessons(data.lessons ?? []);
        setStudents(data.students ?? []);
        setStudentNames(data.studentNames ?? {});
      }
    } catch {
      // 무시 — 빈 상태로 표시
    } finally {
      setIsLoading(false);
    }
  }, [testMode]);

  useEffect(() => {
    reload();
  }, [reload]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      return {
        date: d,
        key: dayKeyOf(d),
        dowKor: DOW_KOR[d.getUTCDay()],
        dayNum: d.getUTCDate(),
      };
    });
  }, [weekStart]);

  const studentMap = useMemo(() => {
    const m = new Map<string, StudentOption>();
    for (const s of students) m.set(s.id, s);
    return m;
  }, [students]);

  // 일자별 lesson 수
  const countByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lessons) {
      const k = `${kstParts(parseIsoUtc(l.scheduledAt)).y}-${kstParts(parseIsoUtc(l.scheduledAt)).m}-${kstParts(parseIsoUtc(l.scheduledAt)).day}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [lessons]);

  // 선택 날짜의 lesson 목록 (sortMode: "status" — 상태 우선순위 → 시간순 / "time" — 시간순)
  const selectedLessons = useMemo(() => {
    const filtered = lessons.filter((l) => {
      const p = kstParts(parseIsoUtc(l.scheduledAt));
      return `${p.y}-${p.m}-${p.day}` === selectedKey;
    });
    if (sortMode === "time") {
      return filtered.sort(
        (a, b) => parseIsoUtc(a.scheduledAt).getTime() - parseIsoUtc(b.scheduledAt).getTime(),
      );
    }
    return filtered.sort((a, b) => {
      const sa = STATUS_SORT_ORDER[deriveDisplayStatus(a)] ?? 99;
      const sb = STATUS_SORT_ORDER[deriveDisplayStatus(b)] ?? 99;
      if (sa !== sb) return sa - sb;
      return parseIsoUtc(a.scheduledAt).getTime() - parseIsoUtc(b.scheduledAt).getTime();
    });
  }, [lessons, selectedKey, sortMode]);

  const selectedDate = useMemo(() => {
    const wd = weekDays.find((d) => d.key === selectedKey);
    return wd?.date ?? null;
  }, [weekDays, selectedKey]);

  // 선택 날짜에 이미 잡힌 레슨 — 분 단위 구간 + 학생명 (길이 칩 판정용)
  const bookedLessons = useMemo(() => {
    return selectedLessons
      .filter((l) => l.status !== "CANCELLED")
      .map((l) => {
        const startKst = new Date(parseIsoUtc(l.scheduledAt).getTime() + 9 * 60 * 60 * 1000);
        const startMin = startKst.getUTCHours() * 60 + startKst.getUTCMinutes();
        return {
          startMin,
          endMin: startMin + l.durationMinutes,
          studentName: studentMap.get(l.studentId)?.name ?? "수강생",
        };
      });
  }, [selectedLessons, studentMap]);

  const selectedLabel = useMemo(() => {
    if (!selectedDate) return "";
    const p = kstParts(new Date(selectedDate.getTime() - 9 * 60 * 60 * 1000));
    // selectedDate는 KST trick raw — getUTC* 그대로가 KST 표현
    const m = selectedDate.getUTCMonth() + 1;
    const day = selectedDate.getUTCDate();
    const dow = DOW_KOR[selectedDate.getUTCDay()];
    void p;
    return `${m}월 ${day}일 (${dow})`;
  }, [selectedDate]);

  const goPrevWeek = () => setWeekStart((d) => addDays(d, -7));
  const goNextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToday = () => {
    const today = startOfWeekMon(focusDate(testMode));
    setWeekStart(today);
    setSelectedKey(todayKey);
  };

  // 이번 주에 오늘이 포함되어 있는지 (오늘로 이동 버튼 노출 여부)
  const isOnTodayWeek = useMemo(
    () => weekDays.some((d) => d.key === todayKey),
    [weekDays, todayKey],
  );

  const weekRangeLabel = `${weekDays[0].date.getUTCMonth() + 1}/${weekDays[0].dayNum} ~ ${weekDays[6].date.getUTCMonth() + 1}/${weekDays[6].dayNum}`;

  const openPicker = () => {
    if (!selectedDate) return;
    setPickerOpen(true);
  };

  const openLessonDetail = (l: LessonRow) => {
    router.push(`/coach/lessons/${l.id}`);
  };

  const onPickStudent = (
    studentId: string,
    hour: number,
    minute: number,
    durationMinutes: number,
    weekCount: number = 1,
  ) => {
    if (!selectedDate) return;
    const iso = cellToIso(selectedDate, hour, minute);
    const timeLabel = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    setPendingStudentId(studentId);
    startTransition(async () => {
      if (weekCount <= 1) {
        const res = await bookLesson(studentId, iso, durationMinutes);
        setPendingStudentId(null);
        if (!res.ok) {
          setAlert({ open: true, variant: "error", title: "레슨 등록 실패", description: res.error });
          return;
        }
        setPickerOpen(false);
        setAlert({
          open: true,
          variant: "success",
          title: `${selectedLabel} ${timeLabel} 레슨 등록 완료`,
        });
      } else {
        const res = await bookRecurringLessons(studentId, iso, durationMinutes, weekCount);
        setPendingStudentId(null);
        if (!res.ok) {
          setAlert({ open: true, variant: "error", title: "정기 등록 실패", description: res.error });
          return;
        }
        setPickerOpen(false);
        const skippedNote =
          res.skippedWeeks.length > 0
            ? `\n\n건너뛴 회차: ${res.skippedWeeks
                .map((s) => `${s.week}주차 (${s.reason})`)
                .join(", ")}`
            : "";
        setAlert({
          open: true,
          variant: "success",
          title: `${weekCount}주 정기 등록 — ${res.bookedCount}회 완료`,
          description: `${selectedLabel} ${timeLabel}부터 매주 같은 요일·시간으로 등록됐어요.${skippedNote}`,
        });
      }
      reload();
    });
  };

  return (
    <div>
      {/* 주간 네비 — 주 범위 + 이전/다음 + "오늘" */}
      <div className="mt-5 flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-ink truncate">{weekRangeLabel}</div>
        <div className="flex items-center gap-1 flex-none">
          {!isOnTodayWeek && (
            <button
              type="button"
              onClick={goToday}
              className="h-9 px-3 rounded-lg border border-line bg-surface text-[11px] font-semibold text-ink-2 active:scale-[0.97] transition"
            >
              오늘
            </button>
          )}
          <button
            type="button"
            onClick={goPrevWeek}
            className="w-9 h-9 rounded-lg border border-line bg-surface text-base text-ink-2 active:scale-[0.97] transition"
            aria-label="이전주"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goNextWeek}
            className="w-9 h-9 rounded-lg border border-line bg-surface text-base text-ink-2 active:scale-[0.97] transition"
            aria-label="다음주"
          >
            ›
          </button>
        </div>
      </div>

      {/* 주간 미니 캘린더 */}
      <div className="mt-2 flex gap-1.5">
        {weekDays.map((d) => {
          const isSelected = d.key === selectedKey;
          const isToday = d.key === todayKey;
          const cnt = countByDay.get(d.key) ?? 0;
          return (
            <button
              type="button"
              key={d.key}
              onClick={() => setSelectedKey(d.key)}
              className={`relative flex-1 text-center py-2 rounded-xl transition active:scale-[0.97] ${
                isSelected
                  ? "bg-primary text-white shadow-[0_4px_12px_rgba(45,212,191,0.35)]"
                  : isToday
                    ? "bg-primary/10 border border-primary/40"
                    : "bg-soft"
              }`}
              aria-label={`${d.dayNum}일 ${d.dowKor}요일${isToday ? " 오늘" : ""}${cnt > 0 ? ` 레슨 ${cnt}건` : ""}`}
            >
              <div
                className={`text-[10px] ${
                  isSelected ? "text-white/85" : isToday ? "text-primary font-semibold" : "text-ink-3"
                }`}
              >
                {d.dowKor}
              </div>
              <div
                className={`text-sm font-semibold mt-0.5 ${
                  isSelected ? "text-white" : isToday ? "text-primary" : "text-ink"
                }`}
              >
                {d.dayNum}
              </div>
              <div className="flex justify-center mt-1 h-3 items-center">
                {cnt > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[16px] h-[14px] px-1 rounded-full text-[9px] font-bold leading-none ${
                      isSelected ? "bg-white text-primary" : "bg-primary text-white"
                    }`}
                  >
                    {cnt}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 선택 날짜 레슨 목록 */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-ink">
            {selectedLabel} 레슨
            {selectedLessons.length > 0 && (
              <span className="ml-1.5 text-xs font-semibold text-ink-2">
                {selectedLessons.length}건
              </span>
            )}
            {!isOnTodayWeek && (
              <span className="ml-1.5 text-[10px] font-semibold text-amber-600 align-middle">
                · 이번 주 아님
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={openPicker}
            className="text-xs font-semibold text-primary px-2.5 py-1 rounded-md hover:bg-primary/10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            + 레슨 잡기
          </button>
        </div>

        {/* 정렬 토글 — 레슨이 2건 이상일 때만 노출 */}
        {!isLoading && selectedLessons.length >= 2 && (
          <div className="mb-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSortMode("status")}
              className={`text-[11px] font-semibold px-2 py-1 rounded-md transition ${
                sortMode === "status"
                  ? "bg-primary/10 text-primary"
                  : "text-ink-3 hover:bg-soft"
              }`}
              aria-pressed={sortMode === "status"}
            >
              상태순
            </button>
            <button
              type="button"
              onClick={() => setSortMode("time")}
              className={`text-[11px] font-semibold px-2 py-1 rounded-md transition ${
                sortMode === "time"
                  ? "bg-primary/10 text-primary"
                  : "text-ink-3 hover:bg-soft"
              }`}
              aria-pressed={sortMode === "time"}
            >
              시간순
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl border border-line bg-surface p-8 flex items-center justify-center gap-2.5">
            <svg className="animate-spin h-4 w-4 text-primary flex-none" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
            </svg>
            <span className="text-sm text-ink-3">레슨 정보를 불러오고 있어요…</span>
          </div>
        ) : selectedLessons.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="text-sm font-semibold text-ink">이 날짜에 예정된 레슨이 없어요</p>
            <p className="mt-1 text-[11px] text-ink-3">
              위 버튼으로 빈 시간대에 새 레슨을 잡거나, 다른 날짜를 선택해 보세요.
            </p>
            <button
              type="button"
              onClick={openPicker}
              className="mt-3 inline-flex items-center rounded-lg bg-primary text-white text-xs font-semibold px-3.5 py-2 hover:opacity-90 transition"
            >
              이 날짜에 레슨 잡기
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {selectedLessons.map((l) => (
              <li key={l.id}>
                <LessonCard
                  lesson={l}
                  studentName={
                    studentNames[l.studentId] ??
                    studentMap.get(l.studentId)?.name ??
                    "이름 미입력"
                  }
                  onClick={() => openLessonDetail(l)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {pickerOpen && selectedDate && (
        <StudentPickerSheet
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          baseTimeLabel={selectedLabel}
          hour={9}
          hourSelectable
          bookedLessons={bookedLessons}
          dayStartUtcMs={selectedDate.getTime() - 9 * 60 * 60 * 1000}
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

function LessonCard({
  lesson,
  studentName,
  onClick,
}: {
  lesson: LessonRow;
  studentName: string;
  onClick: () => void;
}) {
  const displayStatus = deriveDisplayStatus(lesson);
  const style = STATUS_STYLES[displayStatus] ?? FALLBACK_STYLE;

  // 시작 ~ 종료 (KST) — "10:00 ~ 11:00"
  const start = parseIsoUtc(lesson.scheduledAt);
  const end = new Date(start.getTime() + lesson.durationMinutes * 60 * 1000);
  const sp = kstParts(start);
  const ep = kstParts(end);
  const timeRangeText = `${sp.hh}:${sp.mm} ~ ${ep.hh}:${ep.mm}`;

  const oldTime = lesson.originalScheduledAt
    ? (() => {
        const o = kstParts(parseIsoUtc(lesson.originalScheduledAt!));
        return `${o.hh}:${o.mm}`;
      })()
    : null;

  const isGroup = lesson.lessonFormat === "GROUP";
  const formatLabel = isGroup ? "그룹" : "1:1";

  const roundLabel =
    lesson.roundNumber != null && lesson.totalRounds != null
      ? `${lesson.roundNumber}/${lesson.totalRounds}회`
      : null;
  const notesLabel = lesson.notes && lesson.notes.trim() ? lesson.notes.trim() : null;

  let durationTag: string | null = null;
  if (lesson.status === "MERGE") {
    durationTag = `${lesson.durationMinutes}분`;
  } else if (lesson.status === "SPLIT" && lesson.splitIndex && lesson.splitTotal) {
    durationTag = `${lesson.durationMinutes}분 · ${lesson.splitIndex}/${lesson.splitTotal}`;
  }

  let paymentNote: { text: string; tone: "danger" | "muted" | "ok" } | null = null;
  if (lesson.paymentStatus === "UNPAID") paymentNote = { text: "미결제", tone: "danger" };
  else if (lesson.paymentStatus === "EXTERNAL") paymentNote = { text: "외부결제", tone: "muted" };
  else if (lesson.paymentStatus === "PAID") paymentNote = { text: "결제완료", tone: "ok" };

  // faded 카드는 텍스트만 살짝 흐리게 — 카드 자체는 클릭 가능 상태로 유지 (보기 차단 X)
  const fadedTextClass = style.faded ? "text-ink-3" : "";

  // 이니셜 (학생명 첫 글자) — 동일 이름 학생 변별 + 시각 앵커
  const initial = studentName ? studentName.slice(0, 1) : "·";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-left transition active:scale-[0.99] hover:bg-soft/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/40"
    >
      <div className="flex items-start gap-3">
        {/* 학생 이니셜 아바타 — 그룹은 violet 톤으로 구분 */}
        <div
          className={`flex-none w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
            isGroup ? "bg-violet-100 text-violet-700" : "bg-primary/15 text-primary"
          } ${style.faded ? "opacity-60" : ""}`}
          aria-hidden
        >
          {initial}
        </div>

        <div className="min-w-0 flex-1">
          {/* 1행 — 시간 (시각 정보가 핵심: text-base) + 수강생 */}
          <div className="flex items-baseline gap-2">
            <span
              className={`flex-none text-base font-bold tabular-nums ${style.strike ? "line-through text-ink-3" : "text-ink"} ${fadedTextClass}`}
            >
              {timeRangeText}
            </span>
            {oldTime && (
              <span className="flex-none text-[11px] text-ink-3" aria-label={`이전 시각 ${oldTime}`}>
                <span className="line-through">{oldTime}</span>
                <span className="mx-0.5">→</span>
              </span>
            )}
            {durationTag && (
              <span className="flex-none text-[10px] font-semibold text-ink-2 bg-soft px-1.5 py-0.5 rounded">
                {durationTag}
              </span>
            )}
            <span
              className={`min-w-0 truncate text-xs ${style.strike ? "line-through text-ink-3" : "text-ink-2"} ${fadedTextClass}`}
            >
              {studentName}{" "}
              <span className={isGroup ? "text-violet-700 font-semibold" : ""}>· {formatLabel}</span>
            </span>
          </div>

          {/* 2행 — 상태 + 회차 + 결제 */}
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-semibold ${style.color}`}>{style.label}</span>
            {roundLabel && <span className="text-[11px] text-ink-3">· {roundLabel}</span>}
            {paymentNote && (
              <span
                className={`text-[11px] ${
                  paymentNote.tone === "danger"
                    ? "font-semibold text-red-500"
                    : paymentNote.tone === "ok"
                      ? "text-emerald-600"
                      : "text-ink-3"
                }`}
              >
                · {paymentNote.text}
              </span>
            )}
          </div>

          {/* 메모 — 최대 2줄까지 표시 (#31) */}
          {notesLabel && (
            <div
              className={`mt-1 text-[11px] text-ink-3 line-clamp-2 break-words ${style.strike ? "line-through" : ""}`}
            >
              {notesLabel}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
