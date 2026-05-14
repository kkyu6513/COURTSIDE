"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export type TermsItem = {
  versionId: number;
  code: string;
  title: string;
  isRequired: boolean;
  sortOrder: number;
  content: string;
  version: string;
};

type Props = {
  terms: TermsItem[];
  agreed: Record<number, boolean>;
  onChange: (next: Record<number, boolean>) => void;
};

export function TermsAgreement({ terms, agreed, onChange }: Props) {
  const [viewing, setViewing] = useState<TermsItem | null>(null);

  const allChecked = useMemo(() => terms.every((t) => agreed[t.versionId]), [terms, agreed]);

  const toggleAll = (checked: boolean) => {
    const next: Record<number, boolean> = {};
    for (const t of terms) next[t.versionId] = checked;
    onChange(next);
  };

  const toggleOne = (versionId: number, checked: boolean) => {
    onChange({ ...agreed, [versionId]: checked });
  };

  return (
    <div className="rounded-xl border border-line bg-surface">
      <label className="flex items-center gap-3 px-4 py-3 border-b border-line cursor-pointer select-none">
        <CheckBox checked={allChecked} onChange={toggleAll} size="lg" />
        <span className="text-sm font-semibold text-ink">전체 동의</span>
      </label>

      <ul className="px-4 py-2 divide-y divide-line">
        {terms.map((t) => (
          <li key={t.versionId} className="flex items-center gap-3 py-2.5">
            <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer select-none">
              <CheckBox
                checked={!!agreed[t.versionId]}
                onChange={(v) => toggleOne(t.versionId, v)}
                size="md"
              />
              <span className="text-sm text-ink-2 truncate">
                <span className={t.isRequired ? "text-emerald-600 font-semibold" : "text-ink-3 font-semibold"}>
                  [{t.isRequired ? "필수" : "선택"}]
                </span>{" "}
                {t.title}
              </span>
            </label>
            <button
              type="button"
              onClick={() => setViewing(t)}
              className="flex-none text-xs text-ink-3 hover:text-ink underline-offset-2 hover:underline"
              aria-label={`${t.title} 본문 보기`}
            >
              보기 ›
            </button>
          </li>
        ))}
      </ul>

      <TermsViewerModal terms={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function CheckBox({
  checked,
  onChange,
  size = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: "md" | "lg";
}) {
  const dim = size === "lg" ? "w-5 h-5" : "w-[18px] h-[18px]";
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={`${dim} inline-flex items-center justify-center rounded-md border transition flex-none ${
        checked ? "bg-ink border-ink text-white" : "bg-surface border-line text-transparent"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

function TermsViewerModal({ terms, onClose }: { terms: TermsItem | null; onClose: () => void }) {
  useEffect(() => {
    if (!terms) return;
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
  }, [terms, onClose]);

  if (!terms) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={terms.title}
      className="courtside-backdrop-anim fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="courtside-pop-anim w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-surface shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-ink truncate">{terms.title}</h3>
            <p className="text-xs text-ink-3 mt-0.5">버전 {terms.version}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex-none w-9 h-9 -mr-1 flex items-center justify-center rounded-full text-ink-2 hover:bg-soft transition"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto text-xs text-ink-2 leading-relaxed whitespace-pre-wrap flex-1">
          {terms.content}
        </div>

        <div className="px-5 py-3 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-ink text-sm font-semibold text-white hover:opacity-90 transition active:scale-[0.98]"
          >
            확인
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
