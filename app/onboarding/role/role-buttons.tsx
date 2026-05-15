"use client";

import { useFormStatus } from "react-dom";
import { FormPendingIndicator } from "@/components/form-pending-indicator";
import type { Quote } from "@/lib/quotes";
import { selectRole } from "./actions";

type Props = {
  currentRole?: string;
  force?: boolean;
  quote: Quote;
};

export function RoleButtons({ currentRole, force, quote }: Props) {
  return (
    <form action={selectRole} className="space-y-3">
      <FormPendingIndicator />
      <RoleTransitionSplash quote={quote} />
      {force && <input type="hidden" name="force" value="1" />}
      <RoleButton
        value="STUDENT"
        currentRole={currentRole}
        icon="🎾"
        title="학생"
        desc="코치에게 레슨을 받습니다"
      />
      <RoleButton
        value="COACH"
        currentRole={currentRole}
        icon="👨‍🏫"
        title="코치"
        desc="학생을 관리하고 레슨을 운영합니다"
      />
    </form>
  );
}

function RoleTransitionSplash({ quote }: { quote: Quote }) {
  const { pending, data } = useFormStatus();
  if (!pending) return null;

  const role = data?.get("role")?.toString();
  const message =
    role === "STUDENT"
      ? "학생 가입을 준비하고 있어요"
      : role === "COACH"
        ? "코치 가입을 준비하고 있어요"
        : "잠시만요";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100"
      role="status"
      aria-live="polite"
    >
      <div className="px-8 max-w-md text-center">
        <div className="text-emerald-500/70 text-7xl leading-none font-serif select-none" aria-hidden>
          &ldquo;
        </div>
        <p className="mt-1 text-lg font-semibold text-ink leading-relaxed">{quote.t}</p>
        <p className="mt-3 text-sm text-emerald-700 font-medium">{quote.by}</p>

        <div className="mt-10">
          <div
            className="h-1.5 w-full rounded-full bg-emerald-100 overflow-hidden"
            role="progressbar"
            aria-label={message}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="courtside-splash-progress-fill h-full w-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.45)]" />
          </div>
          <div className="mt-2.5 text-[11px] text-emerald-700/70 font-medium tracking-wide">{message}…</div>
        </div>
      </div>
    </div>
  );
}

function RoleButton({
  value,
  currentRole,
  icon,
  title,
  desc,
}: {
  value: "STUDENT" | "COACH";
  currentRole?: string;
  icon: string;
  title: string;
  desc: string;
}) {
  const { pending, data } = useFormStatus();
  const selecting = pending && data?.get("role") === value;
  const isCurrent = currentRole === value;

  return (
    <button
      name="role"
      value={value}
      type="submit"
      disabled={pending}
      className={`w-full p-5 rounded-2xl border-2 bg-surface text-left transition active:scale-[0.98] disabled:cursor-not-allowed ${
        isCurrent ? "border-ink" : "border-line hover:border-ink"
      } ${pending && !selecting ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl">{icon}</div>
        <div className="flex-1">
          <div className="text-lg font-bold text-ink">{title}</div>
          <div className="mt-0.5 text-xs text-ink-2">{desc}</div>
        </div>
        {selecting && (
          <svg
            className="animate-spin h-5 w-5 text-ink"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4zm2 5.3A7.96 7.96 0 014 12H0c0 3 1.1 5.8 3 7.9l3-2.6z"
            />
          </svg>
        )}
      </div>
    </button>
  );
}
