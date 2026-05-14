"use client";

import { useState } from "react";
import { KOREA_REGIONS, SIDO_LIST } from "@/lib/korea-region";
import { Field } from "@/components/onboarding-form";

type ControlledValue = { sido: string; sigungu: string };

export function RegionSelectPair({
  sidoName,
  sigunguName,
  sidoLabel,
  sigunguLabel,
  required,
  value,
  onChange,
}: {
  sidoName: string;
  sigunguName: string;
  sidoLabel: string;
  sigunguLabel: string;
  required?: boolean;
  value?: ControlledValue;
  onChange?: (v: ControlledValue) => void;
}) {
  const isControlled = value !== undefined && onChange !== undefined;
  const [internalSido, setInternalSido] = useState("");
  const [internalSigungu, setInternalSigungu] = useState("");

  const sido = isControlled ? value!.sido : internalSido;
  const sigungu = isControlled ? value!.sigungu : internalSigungu;

  const setSido = (next: string) => {
    if (isControlled) onChange!({ sido: next, sigungu: "" });
    else {
      setInternalSido(next);
      setInternalSigungu("");
    }
  };

  const setSigungu = (next: string) => {
    if (isControlled) onChange!({ sido, sigungu: next });
    else setInternalSigungu(next);
  };

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
          value={sigungu}
          onChange={(e) => setSigungu(e.target.value)}
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
