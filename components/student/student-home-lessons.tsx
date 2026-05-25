"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LessonRow = {
  id: number;
  coachId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  paymentStatus: string;
  lessonFormat: string;
  roundNumber: number | null;
  totalRounds: number | null;
  originalScheduledAt: string | null;
};

const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];

function parseIsoUtc(s: string): Date {
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + "Z");
}

function kstParts(d: Date) {
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return {
    y: k.getUTCFullYear(),
    m: k.getUTCMonth() + 1,
    day: k.getUTCDate(),
    dow: k.getUTCDay(),
    hh: String(k.getUTCHours()).padStart(2, "0"),
    mm: String(k.getUTCMinutes()).padStart(2, "0"),
  };
}

type StatusStyle = { label: string; color: string; faded?: boolean; strike?: boolean };

const STATUS_STYLES: Record<string, StatusStyle> = {
  PENDING: { label: "대기 중", color: "text-amber-600" },
  CONFIRMED: { label: "레슨 예정", color: "text-accent-purple" },
  IN_PROGRESS: { label: "진행 중", color: "text-accent-coral" },
  COMPLETED: { label: "완료", color: "text-blue-600", faded: true },
  ABSENT: { label: "결강", color: "text-ink-3", faded: true, strike: true },
  RESCHEDULE_REQUESTED: { label: "변경 요청", color: "text-orange-600" },
  RESCHEDULE_COMPLETED: { label: "변경 완료", color: "text-blue-600" },
  MAKEUP_PENDING: { label: "보강 일정 선택중", color: "text-amber-600" },
  MAKEUP_CONFIRMED: { label: "보강 확정", color: "text-accent-purple" },
  MAKEUP_REQUESTED: { label: "보강 요청", color: "text-amber-600" },
};

function deriveDisplay(lesson: LessonRow): string {
  if (lesson.status === "CONFIRMED") {
    const start = parseIsoUtc(lesson.scheduledAt).getTime();
    const end = start + lesson.durationMinutes * 60 * 1000;
    const now = Date.now();
    if (now >= start && now < end) return "IN_PROGRESS";
  }
  return lesson.status;
}

export function StudentHomeLessons() {
  const [lessons, setLessons] = useState<LessonRow[] | null>(null);
  const [coachNames, setCoachNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/student/lessons", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.error || `HTTP ${r.status}`);
        }
        return r.json() as Promise<{ lessons: LessonRow[]; coachNames: Record<string, string> }>;
      })
      .then((data) => {
        if (!active) return;
        setLessons(data.lessons ?? []);
        setCoachNames(data.coachNames ?? {});
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, []);

  if (lessons == null) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 flex items-center justify-center gap-2.5">
        <svg className="animate-spin h-4 w-4 text-primary flex-none" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
        </svg>
        <span className="text-sm text-ink-3">레슨 정보를 불러오고 있어요…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-sm text-red-500">레슨 정보를 불러오지 못했어요</p>
        <p className="mt-1 text-xs text-ink-3">{error}</p>
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <div className="text-3xl">📅</div>
        <p className="mt-2 text-sm text-ink-2">아직 예정된 레슨이 없어요</p>
        <p className="mt-1 text-xs text-ink-3">코치가 레슨을 등록하면 여기에 표시돼요</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {lessons.map((l) => {
        const display = deriveDisplay(l);
        const style = STATUS_STYLES[display] ?? { label: "레슨", color: "text-ink-2" };
        const p = kstParts(parseIsoUtc(l.scheduledAt));
        const dateLabel = `${p.m}/${p.day} (${DOW_KOR[p.dow]})`;
        const timeLabel = `${p.hh}:${p.mm}`;
        const format = l.lessonFormat === "GROUP" ? "그룹" : "1:1";

        return (
          <li key={l.id}>
            <Link
              href={`/lessons/${l.id}`}
              className={`block w-full rounded-xl border border-line bg-surface px-4 py-3 transition active:scale-[0.99] ${style.faded ? "opacity-60" : ""}`}
            >
              <div className={`text-xs font-semibold ${style.color}`}>{style.label}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`flex-none text-sm font-bold text-ink ${style.strike ? "line-through" : ""}`}>
                  {dateLabel} {timeLabel}
                </span>
                <span className={`min-w-0 truncate text-xs text-ink-2 ${style.strike ? "line-through text-ink-3" : ""}`}>
                  {coachNames[l.coachId] ?? "코치"} · {format}
                  {l.roundNumber != null && l.totalRounds != null && (
                    <> · {l.roundNumber}/{l.totalRounds}회</>
                  )}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
