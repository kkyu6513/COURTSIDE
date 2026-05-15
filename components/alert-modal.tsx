"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export type AlertVariant = "warning" | "error" | "success" | "info";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  variant?: AlertVariant;
  confirmText?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  items?: string[];
};

const VARIANT_STYLES: Record<
  AlertVariant,
  { bg: string; fg: string; icon: React.ReactNode }
> = {
  warning: {
    bg: "bg-amber-50",
    fg: "text-amber-600",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden>
        <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  error: {
    bg: "bg-red-50",
    fg: "text-red-500",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
  success: {
    bg: "bg-emerald-50",
    fg: "text-emerald-600",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  info: {
    bg: "bg-sky-50",
    fg: "text-sky-600",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
};

export function AlertModal({
  open,
  onClose,
  title,
  description,
  variant = "warning",
  confirmText = "확인",
  primaryAction,
  items,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const v = VARIANT_STYLES[variant];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="courtside-backdrop-anim fixed inset-0 z-[10000] flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="courtside-pop-anim w-full max-w-sm rounded-2xl bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className={`flex-none w-11 h-11 rounded-full ${v.bg} ${v.fg} flex items-center justify-center`}>
              {v.icon}
            </div>
            <h3 className="flex-1 min-w-0 text-base font-bold text-ink leading-snug">{title}</h3>
          </div>
          {description && (
            <p className="mt-3 text-sm text-ink-2 leading-relaxed whitespace-pre-wrap">{description}</p>
          )}

          {items && items.length > 0 && (
            <div className="mt-4 space-y-1.5 rounded-xl bg-soft p-3.5">
              {items.map((it, idx) => (
                <p key={idx} className="text-xs text-ink-2 leading-relaxed">{it}</p>
              ))}
            </div>
          )}

          <div className="mt-6 flex gap-2">
            {primaryAction ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-11 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition"
                >
                  {confirmText}
                </button>
                <button
                  type="button"
                  onClick={primaryAction.onClick}
                  className="flex-1 h-11 rounded-xl bg-ink text-sm font-semibold text-white hover:opacity-90 transition active:scale-[0.98]"
                >
                  {primaryAction.label}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full h-11 rounded-xl bg-ink text-sm font-semibold text-white hover:opacity-90 transition active:scale-[0.98]"
              >
                {confirmText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
