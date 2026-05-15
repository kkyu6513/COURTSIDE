"use client";

import { useState } from "react";
import { AlertModal } from "@/components/alert-modal";
import { FEATURE_INFO } from "./feature-info";

type Feature = {
  code: string;
  label: string;
  enabled: boolean;
};

export function PlanFeatures({ features }: { features: Feature[] }) {
  const [selected, setSelected] = useState<Feature | null>(null);

  const info = selected ? FEATURE_INFO[selected.code] : null;

  return (
    <>
      <ul className="mt-4 space-y-2">
        {features.map((f) => {
          const hasInfo = !!FEATURE_INFO[f.code];
          return (
            <li key={f.code}>
              <button
                type="button"
                onClick={() => hasInfo && setSelected(f)}
                disabled={!hasInfo}
                className={`w-full flex items-start gap-2 text-sm text-left rounded-lg px-2 py-1.5 -mx-2 transition ${
                  f.enabled ? "text-ink-2" : "text-ink-3"
                } ${hasInfo ? "hover:bg-soft active:scale-[0.99]" : "cursor-default"}`}
              >
                {f.enabled ? (
                  <svg
                    className="mt-0.5 h-4 w-4 flex-none text-emerald-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4l2.3 2.3 6.3-6.3a1 1 0 0 1 1.4 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="mt-0.5 h-4 w-4 flex-none text-ink-3"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M5 10a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Z" />
                  </svg>
                )}
                <span className={`flex-1 ${f.enabled ? "" : "line-through"}`}>
                  {f.label}
                </span>
                {hasInfo && (
                  <svg
                    className="mt-0.5 h-4 w-4 flex-none text-ink-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <AlertModal
        open={!!selected}
        onClose={() => setSelected(null)}
        variant="info"
        title={info?.title ?? selected?.label ?? ""}
        description={info?.description}
        items={info?.bullets}
        confirmText="알겠어요"
      />
    </>
  );
}
