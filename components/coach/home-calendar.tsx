"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type LessonRow = {
  id: number;
  studentId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
};

type StudentOption = { id: string; name: string; phone: string | null };

const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];

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

function statusBadge(status: string): { text: string; cls: string } {
  switch (status) {
    case "CONFIRMED":
      return { text: "확정", cls: "bg-emerald-50 text-emerald-600" };
    case "PENDING":
      return { text: "대기", cls: "bg-amber-50 text-amber-600" };
    case "COMPLETED":
      return { text: "완료", cls: "bg-blue-50 text-blue-600" };
    case "CANCELLED":
      return { text: "취소", cls: "bg-soft text-ink-3" };
    default:
      return { text: status, cls: "bg-soft text-ink-3" };
  }
}

export function CoachHomeCalendar() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMon(new Date()));
  const [selectedKey, setSelectedKey] = useState<string>(() => dayKeyOf(startOfWeekMon(new Date())));
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 오늘 키 (KST)
  const todayKey = useMemo(() => {
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return `${nowKst.getUTCFullYear()}-${nowKst.getUTCMonth() + 1}-${nowKst.getUTCDate()}`;
  }, []);

  // 첫 진입: 오늘 선택
  useEffect(() => {
    setSelectedKey(todayKey);
  }, [todayKey]);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/coach/lessons", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { lessons: LessonRow[]; students: StudentOption[] };
        setLessons(data.lessons ?? []);
        setStudents(data.students ?? []);
      }
    } catch {
      // 무시 — 빈 상태로 표시
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  // 선택 날짜의 lesson 목록 (시간순)
  const selectedLessons = useMemo(() => {
    return lessons
      .filter((l) => {
        const p = kstParts(parseIsoUtc(l.scheduledAt));
        return `${p.y}-${p.m}-${p.day}` === selectedKey;
      })
      .sort((a, b) => parseIsoUtc(a.scheduledAt).getTime() - parseIsoUtc(b.scheduledAt).getTime());
  }, [lessons, selectedKey]);

  const selectedDate = useMemo(() => {
    const wd = weekDays.find((d) => d.key === selectedKey);
    return wd?.date ?? null;
  }, [weekDays, selectedKey]);

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

  const goBook = () => {
    if (!selectedDate) return;
    const iso = `${selectedDate.getUTCFullYear()}-${String(selectedDate.getUTCMonth() + 1).padStart(2, "0")}-${String(selectedDate.getUTCDate()).padStart(2, "0")}`;
    router.push(`/coach/schedule?date=${iso}`);
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
            onClick={goBook}
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
              onClick={goBook}
              className="mt-3 inline-flex items-center rounded-lg bg-primary text-white text-xs font-semibold px-3.5 py-2 hover:opacity-90 transition"
            >
              이 날짜에 레슨 잡기
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {selectedLessons.map((l) => {
              const sp = kstParts(parseIsoUtc(l.scheduledAt));
              const endKst = kstParts(
                new Date(parseIsoUtc(l.scheduledAt).getTime() + l.durationMinutes * 60 * 1000),
              );
              const student = studentMap.get(l.studentId);
              const badge = statusBadge(l.status);
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={goBook}
                    className="w-full flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left hover:bg-soft transition active:scale-[0.99]"
                  >
                    <div className="w-14 flex-none text-center">
                      <div className="text-sm font-bold text-ink">{sp.hh}:{sp.mm}</div>
                      <div className="text-[10px] text-ink-3">
                        ~{endKst.hh}:{endKst.mm}
                      </div>
                    </div>
                    <div className="w-px h-9 bg-line flex-none" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-ink truncate">
                        {student?.name ?? "이름 미입력"}
                      </div>
                      <div className="mt-0.5 text-[11px] text-ink-3">{l.durationMinutes}분</div>
                    </div>
                    <span className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
