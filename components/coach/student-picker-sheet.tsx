"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { maskPhone } from "@/lib/masking";

export type StudentOption = {
  id: string;
  name: string;
  phone: string | null;
};

const DURATIONS = [20, 30, 40, 50, 60, 90];

const DAY_START_MIN = 6 * 60; // 06:00
const DAY_END_MIN = 23 * 60; // 23:00 (레슨 종료 한계)

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
  /** 선택된 날짜의 KST 00:00에 해당하는 UTC ms — 슬롯 과거 여부 판정용 */
  dayStartUtcMs?: number;
  students: StudentOption[];
  pendingStudentId: string | null;
  onPick: (studentId: string, hour: number, minute: number, durationMinutes: number) => void;
};

export function StudentPickerSheet({
  open,
  onClose,
  baseTimeLabel,
  hour: initialHour,
  bookedLessons = [],
  dayStartUtcMs,
  students,
  pendingStudentId,
  onPick,
}: Props) {
  const [step, setStep] = useState<"time" | "student">("time");
  const [search, setSearch] = useState("");
  const [duration, setDuration] = useState(60);
  const [selectedStartMin, setSelectedStartMin] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setStep("time");
      setSearch("");
      setDuration(60);
      setSelectedStartMin(null);
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

  const startMin = selectedStartMin;
  const endMin = startMin !== null ? startMin + duration : null;
  const selectedConflict =
    startMin !== null ? findConflict(startMin, duration, bookedLessons) : null;
  const selectedIsPast =
    startMin !== null &&
    dayStartUtcMs != null &&
    dayStartUtcMs + startMin * 60000 < Date.now();
  const canProceed = startMin !== null && !selectedConflict && !selectedIsPast;

  // 레슨 길이 단위로 머지된 시간 슬롯 (06:00부터 길이 간격)
  const slots = useMemo(() => {
    const list: Array<{ startMin: number; label: string }> = [];
    for (let s = DAY_START_MIN; s + duration <= DAY_END_MIN; s += duration) {
      list.push({ startMin: s, label: hmLabel(s) });
    }
    return list;
  }, [duration]);

  const onSelectDuration = (d: number) => {
    setDuration(d);
    setSelectedStartMin(null); // 길이 바뀌면 슬롯 그리드가 달라지므로 선택 초기화
  };

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
        className="absolute left-0 right-0 bottom-0 bg-surface rounded-t-3xl shadow-2xl flex flex-col h-[88vh]"
        style={{ animation: "courtside-sheet-up 0.25s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-3 pb-2 flex-none">
          <div className="w-10 h-1 rounded-full bg-line mx-auto mb-4" />
          <div className="flex items-center gap-2">
            <div className="text-base font-extrabold text-ink">
              {step === "time" ? "1. 레슨 시간" : "2. 수강생 선택"}
            </div>
            <span className="text-[11px] text-ink-3 font-medium">
              {step === "time" ? "1 / 2" : "2 / 2"}
            </span>
          </div>
          <div className="mt-1 text-xs text-ink-3">{baseTimeLabel}</div>
        </div>

        {/* STEP 1: 시간 선택 */}
        {step === "time" && (
          <>
            {/* 레슨 길이 (상단 고정) */}
            <div className="px-5 pt-1 pb-2 flex-none">
              <div className="text-[11px] font-semibold text-ink-2 mb-1.5">레슨 길이</div>
              <div className="grid grid-cols-6 gap-1.5">
                {DURATIONS.map((d) => {
                  const active = d === duration;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onSelectDuration(d)}
                      className={`h-9 rounded-lg text-xs font-bold transition active:scale-[0.97] ${
                        active ? "bg-primary text-white shadow-sm" : "bg-soft text-ink-2 hover:bg-line"
                      }`}
                    >
                      {d}분
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 시간 슬롯 리스트 (스크롤) */}
            <div className="px-3 pb-1 flex-none">
              <div className="text-[11px] font-semibold text-ink-2 px-2">
                시작 시간 선택 — 비어있는 시간을 탭하세요
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-2">
              <ul className="space-y-1">
                {slots.map((slot) => {
                  const isPast =
                    dayStartUtcMs != null &&
                    dayStartUtcMs + slot.startMin * 60000 < Date.now();
                  const conflict = isPast
                    ? null
                    : findConflict(slot.startMin, duration, bookedLessons);
                  const blocked = isPast || !!conflict;
                  const selected = slot.startMin === selectedStartMin;
                  const slotEnd = slot.startMin + duration;
                  return (
                    <li key={slot.startMin}>
                      <button
                        type="button"
                        onClick={() => !blocked && setSelectedStartMin(slot.startMin)}
                        disabled={blocked}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition text-left ${
                          blocked
                            ? "bg-soft border-line cursor-not-allowed"
                            : selected
                              ? "bg-primary/10 border-primary"
                              : "bg-surface border-line active:scale-[0.99]"
                        }`}
                      >
                        <div
                          className={`w-12 flex-none text-sm font-bold ${
                            blocked ? "text-ink-3" : selected ? "text-primary" : "text-ink"
                          }`}
                        >
                          {slot.label}
                        </div>
                        <div className="flex-1 min-w-0">
                          {isPast ? (
                            <div className="text-xs text-ink-3">
                              <span className="font-semibold text-red-400">레슨 불가</span>
                              {" — "}이미 지난 시간이에요
                            </div>
                          ) : conflict ? (
                            <div className="text-xs text-ink-3">
                              <span className="font-semibold text-red-400">레슨 불가</span>
                              {" — "}
                              <span className="font-semibold text-ink-2">{conflict.studentName}</span> 레슨 ({hmLabel(conflict.startMin)}~{hmLabel(conflict.endMin)})
                            </div>
                          ) : (
                            <div className="text-xs text-ink-2">
                              ~{hmLabel(slotEnd)} 까지 · {duration}분 레슨 가능
                            </div>
                          )}
                        </div>
                        {blocked ? (
                          <span className="flex-none text-[10px] font-semibold text-red-400">
                            {isPast ? "지난 시간" : "잡힘"}
                          </span>
                        ) : selected ? (
                          <span className="flex-none w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                              <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3-3a1 1 0 111.4-1.4l2.3 2.3 6.3-6.3a1 1 0 011.4 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        ) : (
                          <span className="flex-none text-[10px] font-semibold text-primary">선택</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="px-5 pb-6 pt-3 border-t border-line flex-none">
              {startMin !== null && endMin !== null && (
                <p className="mb-2 text-xs text-ink-2 text-center">
                  선택:{" "}
                  <span className="font-bold text-ink">
                    {hmLabel(startMin)} ~ {hmLabel(endMin)}
                  </span>{" "}
                  ({duration}분)
                </p>
              )}
              <div className="flex gap-2">
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
                  disabled={!canProceed}
                  className="flex-1 h-12 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음
                </button>
              </div>
            </div>
          </>
        )}

        {/* STEP 2: 학생 선택 */}
        {step === "student" && startMin !== null && endMin !== null && (
          <>
            <div className="px-5 pt-1 pb-2 flex-none">
              <div className="rounded-lg bg-soft px-3 py-2 text-xs text-ink-2">
                <span className="font-semibold text-ink">
                  {hmLabel(startMin)} ~ {hmLabel(endMin)}
                </span>{" "}
                ({duration}분) 레슨을 받을 수강생을 선택하세요
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
                          onClick={() =>
                            onPick(
                              s.id,
                              Math.floor(startMin / 60),
                              startMin % 60,
                              duration,
                            )
                          }
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
