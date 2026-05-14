"use client";

import { useState } from "react";
import { TermsDetailModal } from "@/components/terms-detail-modal";

export type TermItem = {
  versionId: number;
  code: string;
  title: string;
  isRequired: boolean;
  sortOrder: number;
  content: string;
};

type Props = {
  terms: TermItem[];
  agreed: number[]; // 동의한 versionId 배열
  onChange: (agreed: number[]) => void;
};

export function TermsAgreement({ terms, agreed, onChange }: Props) {
  const [detail, setDetail] = useState<TermItem | null>(null);

  const required = terms.filter((t) => t.isRequired).map((t) => t.versionId);
  const allIds = terms.map((t) => t.versionId);
  const allAgreed = allIds.every((id) => agreed.includes(id));
  const requiredAgreed = required.every((id) => agreed.includes(id));

  const toggleAll = () => {
    if (allAgreed) onChange([]);
    else onChange(allIds);
  };

  const toggle = (id: number) => {
    if (agreed.includes(id)) onChange(agreed.filter((x) => x !== id));
    else onChange([...agreed, id]);
  };

  return (
    <>
      <div className="rounded-xl border border-line bg-surface">
        {/* 전체 동의 */}
        <button
          type="button"
          onClick={toggleAll}
          className="w-full flex items-center gap-3 p-4 text-left"
        >
          <CheckBox checked={allAgreed} />
          <div className="flex-1">
            <div className="text-sm font-semibold text-ink">약관 전체 동의</div>
            <div className="mt-0.5 text-[11px] text-ink-3">
              필수·선택 항목을 한번에 동의합니다
            </div>
          </div>
        </button>

        <div className="h-px bg-line mx-4" />

        {/* 개별 동의 */}
        <ul className="py-2">
          {terms.map((t) => (
            <li key={t.versionId} className="flex items-center gap-3 px-4 py-2">
              <button
                type="button"
                onClick={() => toggle(t.versionId)}
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
              >
                <CheckBox
                  checked={agreed.includes(t.versionId)}
                  size="sm"
                />
                <span
                  className={`text-xs ${
                    t.isRequired ? "text-ink-2" : "text-ink-3"
                  }`}
                >
                  <span
                    className={`font-semibold mr-1 ${
                      t.isRequired ? "text-red-500" : "text-ink-3"
                    }`}
                  >
                    [{t.isRequired ? "필수" : "선택"}]
                  </span>
                  {t.title}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDetail(t)}
                aria-label={`${t.title} 보기`}
                className="flex-none text-[11px] text-ink-3 hover:text-ink underline underline-offset-2"
              >
                보기 ›
              </button>
            </li>
          ))}
        </ul>
      </div>

      {!requiredAgreed && (
        <p className="mt-2 text-[11px] text-red-500">
          필수 약관 동의가 필요해요
        </p>
      )}

      <TermsDetailModal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title ?? ""}
        content={detail?.content ?? ""}
      />
    </>
  );
}

function CheckBox({ checked, size = "md" }: { checked: boolean; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-5 h-5" : "w-6 h-6";
  return (
    <span
      className={`${sz} flex-none rounded-full flex items-center justify-center transition ${
        checked
          ? "bg-emerald-500 text-white"
          : "bg-soft text-ink-3 border border-line"
      }`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden>
        <path
          fillRule="evenodd"
          d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4l2.3 2.3 6.3-6.3a1 1 0 0 1 1.4 0Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}
