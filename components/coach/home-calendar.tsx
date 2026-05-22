"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AlertModal } from "@/components/alert-modal";
import { StudentPickerSheet, type StudentOption } from "@/components/coach/student-picker-sheet";
import { bookLesson } from "@/app/coach/schedule/actions";

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

// status → 카드 스타일 매핑 (프로토타입 7-0 기준 12종)
type StatusStyle = {
  badgeText: string;
  badgeBg: string;
  badgeColor: string;
  cardBg: string;
  cardBorder: string;
  cardExtra?: string;
  timeColor?: string;
  noteColor?: string;
  faded?: boolean;
  strike?: boolean;
};

const STATUS_STYLES: Record<string, StatusStyle> = {
  PENDING: {
    badgeText: "⏳ 레슨 신청",
    badgeBg: "bg-amber-100",
    badgeColor: "text-amber-800",
    cardBg: "bg-amber-50",
    cardBorder: "border-amber-200",
    cardExtra: "border-[1.5px]",
    timeColor: "text-amber-800",
    noteColor: "text-amber-800",
  },
  CONFIRMED: {
    badgeText: "레슨 예정",
    badgeBg: "bg-purple-100",
    badgeColor: "text-purple-700",
    cardBg: "bg-surface",
    cardBorder: "border-line",
  },
  IN_PROGRESS: {
    badgeText: "🎾 진행중",
    badgeBg: "bg-red-100",
    badgeColor: "text-red-500 animate-pulse",
    cardBg: "bg-surface",
    cardBorder: "border-line",
    timeColor: "text-orange-500",
  },
  COMPLETED: {
    badgeText: "레슨완료",
    badgeBg: "bg-blue-100",
    badgeColor: "text-blue-800",
    cardBg: "bg-surface",
    cardBorder: "border-line",
    faded: true,
  },
  ABSENT: {
    badgeText: "❌ 결강",
    badgeBg: "bg-gray-100",
    badgeColor: "text-gray-500",
    cardBg: "bg-soft",
    cardBorder: "border-line",
    faded: true,
    strike: true,
  },
  RESCHEDULE_REQUESTED: {
    badgeText: "🔄 변경 요청",
    badgeBg: "bg-orange-50",
    badgeColor: "text-orange-600",
    cardBg: "bg-surface",
    cardBorder: "border-line",
    timeColor: "text-orange-600",
  },
  RESCHEDULE_COMPLETED: {
    badgeText: "✅ 변경완료",
    badgeBg: "bg-blue-100",
    badgeColor: "text-blue-800",
    cardBg: "bg-blue-50",
    cardBorder: "border-blue-200",
    cardExtra: "border-[1.5px]",
    timeColor: "text-blue-800",
  },
  MAKEUP_PENDING: {
    badgeText: "🔄 보강 일정 선택중",
    badgeBg: "bg-emerald-100",
    badgeColor: "text-emerald-800",
    cardBg: "bg-teal-50",
    cardBorder: "border-emerald-500 border-dashed",
    cardExtra: "border-[1.5px]",
    timeColor: "text-emerald-600",
  },
  MAKEUP_CONFIRMED: {
    badgeText: "✅ 보강확정",
    badgeBg: "bg-emerald-100",
    badgeColor: "text-emerald-800",
    cardBg: "bg-teal-50",
    cardBorder: "border-emerald-500",
    cardExtra: "border-[1.5px]",
    timeColor: "text-emerald-800",
  },
  MAKEUP_REQUESTED: {
    badgeText: "🙋 보강 요청",
    badgeBg: "bg-orange-50",
    badgeColor: "text-orange-600",
    cardBg: "bg-orange-50",
    cardBorder: "border-orange-300",
    cardExtra: "border-[1.5px]",
    timeColor: "text-orange-600",
  },
  MERGE: {
    badgeText: "🔗 통합 회차",
    badgeBg: "bg-violet-100",
    badgeColor: "text-violet-800",
    cardBg: "bg-violet-50",
    cardBorder: "border-violet-300",
    cardExtra: "border-[1.5px]",
    timeColor: "text-violet-800",
    noteColor: "text-violet-800",
  },
  SPLIT: {
    badgeText: "✂ 분할 회차",
    badgeBg: "bg-violet-100",
    badgeColor: "text-violet-800",
    cardBg: "bg-violet-50",
    cardBorder: "border-violet-300",
    cardExtra: "border-[1.5px]",
    timeColor: "text-violet-800",
    noteColor: "text-violet-800",
  },
};

const FALLBACK_STYLE: StatusStyle = {
  badgeText: "레슨",
  badgeBg: "bg-gray-100",
  badgeColor: "text-gray-600",
  cardBg: "bg-surface",
  cardBorder: "border-line",
};

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
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMon(focusDate(testMode)));
  const [selectedKey, setSelectedKey] = useState<string>(() => dayKeyOf(startOfWeekMon(focusDate(testMode))));
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingStudentId, setPendingStudentId] = useState<string | null>(null);
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

  // 선택 날짜의 lesson 목록 (상태 우선순위 → 시간순)
  const selectedLessons = useMemo(() => {
    return lessons
      .filter((l) => {
        const p = kstParts(parseIsoUtc(l.scheduledAt));
        return `${p.y}-${p.m}-${p.day}` === selectedKey;
      })
      .sort((a, b) => {
        const sa = STATUS_SORT_ORDER[deriveDisplayStatus(a)] ?? 99;
        const sb = STATUS_SORT_ORDER[deriveDisplayStatus(b)] ?? 99;
        if (sa !== sb) return sa - sb;
        return parseIsoUtc(a.scheduledAt).getTime() - parseIsoUtc(b.scheduledAt).getTime();
      });
  }, [lessons, selectedKey]);

  // 전체 로드된 레슨 중 신청(PENDING) 건수 — 요약 배너용
  const pendingCount = useMemo(
    () => lessons.filter((l) => l.status === "PENDING").length,
    [lessons],
  );

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

  const weekRangeLabel = `${weekDays[0].date.getUTCMonth() + 1}/${weekDays[0].dayNum} ~ ${weekDays[6].date.getUTCMonth() + 1}/${weekDays[6].dayNum}`;

  const openPicker = () => {
    if (!selectedDate) return;
    setPickerOpen(true);
  };

  const onPickStudent = (studentId: string, hour: number, minute: number, durationMinutes: number) => {
    if (!selectedDate) return;
    const iso = cellToIso(selectedDate, hour, minute);
    setPendingStudentId(studentId);
    startTransition(async () => {
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
        title: "레슨이 등록되었어요",
        description: `${selectedLabel} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}에 레슨이 잡혔습니다.`,
      });
      reload();
    });
  };

  return (
    <div>
      {/* 주간 네비 */}
      <div className="mt-5 flex items-center justify-between">
        <div className="text-sm font-bold text-ink">{selectedLabel || "날짜 선택"}</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrevWeek}
            className="w-7 h-7 rounded-lg border border-line bg-surface text-sm text-ink-2 hover:bg-soft transition"
            aria-label="이전주"
          >
            ‹
          </button>
          <span className="text-[11px] font-semibold text-ink-3 px-1">{weekRangeLabel}</span>
          <button
            type="button"
            onClick={goNextWeek}
            className="w-7 h-7 rounded-lg border border-line bg-surface text-sm text-ink-2 hover:bg-soft transition"
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
              className={`flex-1 text-center py-2 rounded-xl transition active:scale-[0.97] ${
                isSelected
                  ? "bg-primary text-white shadow-[0_4px_12px_rgba(45,212,191,0.35)]"
                  : "bg-soft hover:bg-line"
              }`}
            >
              <div className={`text-[10px] ${isSelected ? "text-white/85" : "text-ink-3"}`}>
                {d.dowKor}
              </div>
              <div
                className={`text-sm font-semibold mt-0.5 ${
                  isSelected ? "text-white" : isToday ? "text-primary" : "text-ink"
                }`}
              >
                {d.dayNum}
              </div>
              <div className="flex justify-center mt-1 h-1.5">
                {cnt > 0 && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-primary"}`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 신청(PENDING) 요약 배너 */}
      {!isLoading && pendingCount > 0 && (
        <div className="mt-5 rounded-2xl border-[1.5px] border-amber-200 bg-amber-50 p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-none">
            <span className="text-base">⏳</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-amber-900">
              새로운 레슨 신청이 <span className="text-amber-600">{pendingCount}</span>건 있어요
            </div>
            <p className="mt-0.5 text-[11px] text-amber-800/80">
              신청을 검토하고 수락 또는 거절해주세요.
            </p>
          </div>
        </div>
      )}

      {/* 선택 날짜 레슨 목록 */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-ink">
            {selectedLabel} 레슨
            {selectedLessons.length > 0 && (
              <span className="ml-1.5 text-xs text-ink-3 font-medium">{selectedLessons.length}건</span>
            )}
          </h2>
          <button
            type="button"
            onClick={openPicker}
            className="text-xs font-semibold text-primary px-2.5 py-1 rounded-md hover:bg-primary/10 transition"
          >
            + 레슨 잡기
          </button>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <span className="text-sm text-ink-3">불러오는 중…</span>
          </div>
        ) : selectedLessons.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="text-sm text-ink-2">이 날짜에 예정된 레슨이 없어요</p>
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
                  onClick={openPicker}
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
  const sp = kstParts(parseIsoUtc(lesson.scheduledAt));
  const timeText = lesson.status === "PENDING" ? `신청 ${sp.hh}:${sp.mm}` : `${sp.hh}:${sp.mm}`;

  const oldTime = lesson.originalScheduledAt
    ? (() => {
        const o = kstParts(parseIsoUtc(lesson.originalScheduledAt!));
        return `${o.hh}:${o.mm}`;
      })()
    : null;

  const formatLabel = lesson.lessonFormat === "GROUP" ? "그룹" : "1:1";

  // 회차 노트 — notes 우선, 없으면 N/M회
  let roundNote = "";
  if (lesson.notes) {
    roundNote = lesson.notes;
  } else if (lesson.roundNumber != null && lesson.totalRounds != null) {
    roundNote = `${lesson.roundNumber}/${lesson.totalRounds}회`;
  }

  // 통합/분할 태그
  let durationTag: string | null = null;
  if (lesson.status === "MERGE") {
    durationTag = `${lesson.durationMinutes}분`;
  } else if (lesson.status === "SPLIT" && lesson.splitIndex && lesson.splitTotal) {
    durationTag = `${lesson.durationMinutes}분 · ${lesson.splitIndex}/${lesson.splitTotal}`;
  }

  // 결제 노트
  let paymentNote: "미결제" | "외부결제" | null = null;
  if (lesson.paymentStatus === "UNPAID") paymentNote = "미결제";
  else if (lesson.paymentStatus === "EXTERNAL") paymentNote = "외부결제";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border ${style.cardBg} ${style.cardBorder} ${style.cardExtra ?? ""} px-4 py-3 flex items-center justify-between gap-3 text-left transition active:scale-[0.99] ${style.faded ? "opacity-70" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div
          className={`text-sm font-bold ${style.timeColor ?? "text-ink"} ${style.strike ? "line-through" : ""}`}
        >
          {timeText}
          {oldTime && (
            <span className="ml-1 text-[11px] font-normal text-ink-3 line-through">
              {oldTime}
            </span>
          )}
          {durationTag && (
            <span className="ml-1 inline-block text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-md">
              {durationTag}
            </span>
          )}
        </div>
        <div
          className={`mt-0.5 text-xs text-ink-2 ${style.strike ? "line-through text-ink-3" : ""}`}
        >
          {studentName} · {formatLabel}
          {roundNote && (
            <>
              {" · "}
              <span className={`font-semibold ${style.noteColor ?? "text-blue-600"}`}>
                {roundNote}
              </span>
            </>
          )}
          {paymentNote && (
            <>
              {" · "}
              <span
                className={`font-semibold ${paymentNote === "미결제" ? "text-red-500" : "text-blue-500"}`}
              >
                {paymentNote}
              </span>
            </>
          )}
        </div>
      </div>
      <span
        className={`flex-none rounded-lg px-2 py-1 text-[11px] font-semibold ${style.badgeBg} ${style.badgeColor}`}
      >
        {style.badgeText}
      </span>
    </button>
  );
}
