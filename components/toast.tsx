"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

type ToastVariant = "success" | "info" | "warning" | "error";

type Props = {
  open: boolean;
  onClose: () => void;
  variant?: ToastVariant;
  title: string;
  description?: string;
  /** 자동 닫힘 ms — null/0이면 수동 닫기만 */
  duration?: number;
};

const VARIANT_STYLES: Record<ToastVariant, { bg: string; fg: string; icon: React.ReactNode }> = {
  success: {
    bg: "bg-emerald-50 border-emerald-200",
    fg: "text-emerald-700",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  info: {
    bg: "bg-sky-50 border-sky-200",
    fg: "text-sky-700",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  warning: {
    bg: "bg-amber-50 border-amber-200",
    fg: "text-amber-700",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
        <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  error: {
    bg: "bg-red-50 border-red-200",
    fg: "text-red-600",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
};

/**
 * 흐름을 끊지 않는 가벼운 알림.
 * 성공/정보 알림은 toast, 사용자 확인이 필요한 에러/경고는 AlertModal 권장.
 */
export function Toast({ open, onClose, variant = "success", title, description, duration = 2500 }: Props) {
  useEffect(() => {
    if (!open || !duration) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [open, duration, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const v = VARIANT_STYLES[variant];

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[9999] w-[min(420px,calc(100%-32px))]"
      style={{ animation: "courtside-sheet-up 0.2s ease-out" }}
    >
      <button
        type="button"
        onClick={onClose}
        className={`w-full flex items-start gap-2.5 rounded-xl border ${v.bg} px-3.5 py-3 shadow-lg active:scale-[0.99] transition text-left`}
      >
        <span className={`flex-none mt-0.5 ${v.fg}`}>{v.icon}</span>
        <span className="flex-1 min-w-0">
          <span className={`block text-sm font-bold ${v.fg}`}>{title}</span>
          {description && (
            <span className="mt-0.5 block text-[11px] text-ink-2 leading-relaxed">
              {description}
            </span>
          )}
        </span>
      </button>
    </div>,
    document.body,
  );
}
