"use client";

import { useState } from "react";
import { KOREA_REGIONS, SIDO_LIST } from "@/lib/korea-region";
import { Field } from "@/components/onboarding-form";

export function RegionSelectPair({
  sidoName,
  sigunguName,
  sidoLabel,
  sigunguLabel,
  required,
}: {
  sidoName: string;
  sigunguName: string;
  sidoLabel: string;
  sigunguLabel: string;
  required?: boolean;
}) {
  const [sido, setSido] = useState("");
  const sigunguOptions = sido ? KOREA_REGIONS[sido] || [] : [];

  return (
    <>
      <Field label={sidoLabel} required={required}>
        <select
          name={sidoName}
          required={required}
          value={sido}
          onChange={(e) => setSido(e.target.value)}
          className="w-full h-12 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
        >
          <option value="" disabled>
            시·도를 선택하세요
          </option>
          {SIDO_LIST.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      <Field label={sigunguLabel} required={required}>
        <select
          name={sigunguName}
          required={required}
          disabled={!sido}
          defaultValue=""
          key={sido}
          className="w-full h-12 rounded-lg border border-line bg-surface px-3 text-sm text-ink disabled:bg-soft disabled:text-ink-3"
        >
          <option value="" disabled>
            {sido ? "시·군·구를 선택하세요" : "시·도를 먼저 선택하세요"}
          </option>
          {sigunguOptions.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
