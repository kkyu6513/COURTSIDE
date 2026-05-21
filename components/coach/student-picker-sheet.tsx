"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { maskPhone } from "@/lib/masking";

export type StudentOption = {
  id: string;
  name: string;
  phone: string | null;
};

const MINUTES = [0, 10, 20, 30, 40, 50];
const DURATIONS = [20, 30, 40, 50, 60, 90];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06 ~ 22

export type BookedLesson = {
  startMin: number; // 자정 기준 분
  endMin: number;
  studentName: string;
};

function hmLabel(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** [start, start+dur)가 겹치는 첫 booked lesson 반환 (없으면 null) */
function findConflict(
  startMin: number,
  durationMin: number,
  booked: BookedLesson[],
): BookedLesson | null {
  const endMin = startMin + durationMin;
  for (const b of booked) {
    if (startMin < b.endMin && endMin > b.startMin) return b;
  }
  return null;
}

type Props = {
  open: boolean;
  onClose: () => void;
  baseTimeLabel: string;
  hour: number;
  hourSelectable?: boolean;
  /** 그 날짜에 이미 잡힌 레슨 (분 단위 구간 + 학생명) */
  bookedLessons?: BookedLesson[];
  students: StudentOption[];
  pendingStudentId: string | null;
  onPick: (studentId: string, hour: number, minute: number, durationMinutes: number) => void;
};

export function StudentPickerSheet({
  open,
  onClose,
  baseTimeLabel,
  hour: initialHour,
  hourSelectable = false,
  bookedLessons = [],
  students,
  pendingStudentId,
  onPick,
}: Props) {
  const [step, setStep] = useState<"time" | "student">("time");
  const [search, setSearch] = useState("");
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(0);
  const [duration, setDuration] = useState(60);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("time");
      setSearch("");
      setHour(initialHour);
      setMinute(0);
      setDuration(60);
      setConflictMsg(null);
    }
  }, [open, initialHour]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const startMin = hour * 60 + minute;
  const totalEndMin = startMin + duration;
  const endHh = String(Math.floor(totalEndMin / 60)).padStart(2, "0");
  const endMm = String(totalEndMin % 60).padStart(2, "0");

  // 현재 선택한 시작 시각 + 길이가 겹치는지
  const selectedConflict = findConflict(startMin, duration, bookedLessons);

  const q = search.trim();
  const filtered = useMemo(
    () =>
      q
        ? students.filter(
            (s) => s.name.includes(q) || (s.phone ?? "").includes(q.replace(/[^\d]/g, "")),
          )
        : students,
    [q, students],
  );

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="courtside-backdrop-anim fixed inset-0 z-[10000]"
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(15, 23, 42, 0.4)" }}
        onClick={onClose}
      />
      <div
        className="absolute left-0 right-0 bottom-0 bg-surface rounded-t-3xl shadow-2xl flex flex-col max-h-[88vh]"
        style={{ animation: "courtside-sheet-up 0.25s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-3 pb-2 flex-none">
          <div className="w-10 h-1 rounded-full bg-line mx-auto mb-4" />
          <div className="flex items-center gap-2">
            <div className="text-base font-extrabold text-ink">
              {step === "time" ? "1. 레슨 시간" : "2. 수강생 선택"}
            </div>
            <span className="text-[11px] text-ink-3 font-medium">{step === "time" ? "1 / 2" : "2 / 2"}</span>
          </div>
          <div className="mt-1 text-xs text-ink-3">{baseTimeLabel}</div>
        </div>

        {/* STEP 1: 시간 선택 */}
        {step === "time" && (
          <>
            <div className="flex-1 overflow-y-auto px-5 pb-2">
              {/* 레슨 시작 시간 — 시 + 분 통합 */}
              <div className="pt-2">
                <div className="text-[11px] font-semibold text-ink-2 mb-1.5">레슨 시작 시간</div>
                <div className="rounded-xl border border-line bg-soft/50 p-2.5 space-y-1.5">
                  {hourSelectable && (
                    <div className="grid grid-cols-6 gap-1.5">
                      {HOURS.map((h) => {
                        const active = h === hour;
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => {
                              setHour(h);
                              setConflictMsg(null);
                            }}
                            className={`h-9 rounded-lg text-xs font-bold transition active:scale-[0.97] ${
                              active
                                ? "bg-primary text-white shadow-sm"
                                : "bg-surface text-ink-2 hover:bg-line border border-line"
                            }`}
                          >
                            {String(h).padStart(2, "0")}시
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="grid grid-cols-6 gap-1.5">
                    {MINUTES.map((m) => {
                      const active = m === minute;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setMinute(m);
                            setConflictMsg(null);
                          }}
                          className={`h-9 rounded-lg text-xs font-bold transition active:scale-[0.97] ${
                            active
                              ? "bg-primary text-white shadow-sm"
                              : "bg-surface text-ink-2 hover:bg-line border border-line"
                          }`}
                        >
                          :{String(m).padStart(2, "0")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 레슨 길이 — 각 길이가 시작 시각 기준 가능한지 판정 */}
              <div className="pt-3">
                <div className="text-[11px] font-semibold text-ink-2 mb-1.5">
                  레슨 길이 <span className="font-normal text-ink-3">({hh}:{mm} 시작 기준)</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {DURATIONS.map((d) => {
                    const conflict = findConflict(startMin, d, bookedLessons);
                    const blocked = !!conflict;
                    const active = d === duration && !blocked;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          if (blocked && conflict) {
                            setConflictMsg(
                              `${conflict.studentName} 수강생이 ${hmLabel(conflict.startMin)}~${hmLabel(conflict.endMin)}에 레슨이 있어 ${d}분 수업은 잡을 수 없어요.`,
                            );
                          } else {
                            setDuration(d);
                            setConflictMsg(null);
                          }
                        }}
                        className={`h-11 rounded-lg text-xs font-bold transition active:scale-[0.97] flex flex-col items-center justify-center leading-tight ${
                          blocked
                            ? "bg-line/60 text-ink-3"
                            : active
                              ? "bg-primary text-white shadow-sm"
                              : "bg-soft text-ink-2 hover:bg-line"
                        }`}
                      >
                        <span>{d}분 수업</span>
                        <span className={`text-[9px] font-medium mt-0.5 ${blocked ? "text-red-400" : active ? "text-white/80" : "text-ink-3"}`}>
                          {blocked ? "레슨 불가" : "가능"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-ink-3">
                  선택:&nbsp;
                  <span className="font-semibold text-ink">{hh}:{mm}</span>
                  &nbsp;~&nbsp;
                  <span className="font-semibold text-ink">{endHh}:{endMm}</span>
                  &nbsp;({duration}분)
                </p>
                {conflictMsg && (
                  <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[11px] text-red-600 leading-relaxed">
                    {conflictMsg}
                  </div>
                )}
                {!conflictMsg && selectedConflict && (
                  <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[11px] text-red-600 leading-relaxed">
                    이 시간은 {selectedConflict.studentName} 수강생 레슨({hmLabel(selectedConflict.startMin)}~{hmLabel(selectedConflict.endMin)})과 겹쳐요. 다른 시간/길이를 선택해주세요.
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 pb-6 pt-3 border-t border-line flex-none flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => setStep("student")}
                disabled={!!selectedConflict}
                className="flex-1 h-12 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          </>
        )}

        {/* STEP 2: 학생 선택 */}
        {step === "student" && (
          <>
            <div className="px-5 pt-1 pb-2 flex-none">
              <div className="rounded-lg bg-soft px-3 py-2 text-xs text-ink-2">
                <span className="font-semibold text-ink">{hh}:{mm} ~ {endHh}:{endMm}</span>
                &nbsp;({duration}분) 레슨을 받을 수강생을 선택하세요
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름 또는 전화번호로 검색"
                className="mt-2 w-full h-11 rounded-xl bg-soft px-3.5 text-sm text-ink placeholder:text-ink-3 outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4">
              {filtered.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-ink-2">
                    {students.length === 0 ? "등록된 수강생이 없어요" : "검색 결과가 없어요"}
                  </p>
                </div>
              ) : (
                <ul className="space-y-1.5 mt-1">
                  {filtered.map((s) => {
                    const isPending = pendingStudentId === s.id;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => onPick(s.id, hour, minute, duration)}
                          disabled={!!pendingStudentId}
                          className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-soft transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm flex-none">
                            {s.name.slice(0, 1)}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm font-bold text-ink">{s.name}</div>
                            <div className="mt-0.5 text-[11px] text-ink-3">
                              {s.phone ? maskPhone(s.phone) : "전화번호 없음"}
                            </div>
                          </div>
                          {isPending && (
                            <svg className="animate-spin h-4 w-4 text-ink-3 flex-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                            </svg>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="px-5 pb-6 pt-3 border-t border-line flex-none">
              <button
                type="button"
                onClick={() => setStep("time")}
                disabled={!!pendingStudentId}
                className="w-full h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition disabled:opacity-50"
              >
                ‹ 이전 (시간 다시 선택)
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
