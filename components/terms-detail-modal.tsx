"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
};

export function TermsDetailModal({ open, onClose, title, content }: Props) {
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="courtside-backdrop-anim fixed inset-0 z-[10000] flex items-end sm:items-center justify-center"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="courtside-pop-anim w-full max-w-md max-h-[85vh] flex flex-col bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-line flex-none">
          <h3 className="text-base font-bold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-soft transition"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <pre className="text-xs text-ink-2 leading-relaxed whitespace-pre-wrap font-sans break-words">
            {content}
          </pre>
        </div>

        <div className="p-5 border-t border-line flex-none">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-ink text-white text-sm font-semibold hover:opacity-90 transition active:scale-[0.98]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
