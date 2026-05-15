"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { maskPhone } from "@/lib/masking";

export type StudentOption = {
  id: string;
  name: string;
  phone: string | null;
};

const MINUTES = [0, 10, 20, 30, 40, 50];

type Props = {
  open: boolean;
  onClose: () => void;
  baseTimeLabel: string;
  hour: number;
  students: StudentOption[];
  pendingStudentId: string | null;
  onPick: (studentId: string, minute: number) => void;
};

export function StudentPickerSheet({
  open,
  onClose,
  baseTimeLabel,
  hour,
  students,
  pendingStudentId,
  onPick,
}: Props) {
  const [search, setSearch] = useState("");
  const [minute, setMinute] = useState(0);

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

  useEffect(() => {
    if (!open) {
      setSearch("");
      setMinute(0);
    }
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const q = search.trim();
  const filtered = q
    ? students.filter(
        (s) => s.name.includes(q) || (s.phone ?? "").includes(q.replace(/[^\d]/g, "")),
      )
    : students;

  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");

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
        className="absolute left-0 right-0 bottom-0 bg-surface rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh]"
        style={{ animation: "courtside-sheet-up 0.25s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-3 pb-1 flex-none">
          <div className="w-10 h-1 rounded-full bg-line mx-auto mb-4" />
          <div className="text-base font-extrabold text-ink">레슨 시작 시간</div>
          <div className="mt-1 text-xs text-ink-3">{baseTimeLabel}</div>
        </div>

        <div className="px-5 pt-3 pb-1 flex-none">
          <div className="grid grid-cols-6 gap-1.5">
            {MINUTES.map((m) => {
              const active = m === minute;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinute(m)}
                  disabled={!!pendingStudentId}
                  className={`h-10 rounded-lg text-xs font-bold transition active:scale-[0.97] disabled:opacity-60 ${
                    active
                      ? "bg-primary text-white shadow-sm"
                      : "bg-soft text-ink-2 hover:bg-line"
                  }`}
                >
                  :{String(m).padStart(2, "0")}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-ink-3">
            선택된 시각:&nbsp;<span className="font-semibold text-ink">{hh}:{mm}</span>
          </p>
        </div>

        <div className="px-5 pt-4 pb-1 flex-none">
          <div className="text-sm font-bold text-ink mb-2">수강생 선택</div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 전화번호로 검색"
            className="w-full h-11 rounded-xl bg-soft px-3.5 text-sm text-ink placeholder:text-ink-3 outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {filtered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-ink-2">
                {students.length === 0 ? "등록된 수강생이 없어요" : "검색 결과가 없어요"}
              </p>
              {students.length === 0 && (
                <p className="mt-1 text-xs text-ink-3">
                  알림에서 학생 등록 요청을 수락하면 여기에 표시됩니다.
                </p>
              )}
            </div>
          ) : (
            <ul className="space-y-1.5 mt-2">
              {filtered.map((s) => {
                const isPending = pendingStudentId === s.id;
                const isDisabled = !!pendingStudentId;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onPick(s.id, minute)}
                      disabled={isDisabled}
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

        <div className="px-5 pb-6 pt-2 border-t border-line flex-none">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition"
          >
            취소
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
