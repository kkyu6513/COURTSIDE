"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field, TextInput, Textarea } from "@/components/onboarding-form";
import { RegionSelectPair } from "@/components/region-select";
import { AlertModal } from "@/components/alert-modal";
import { TermsAgreement, type TermItem } from "@/components/terms-agreement";
import { submitCoachProfile } from "./actions";

type AlertState = {
  open: boolean;
  variant: "warning" | "error" | "success" | "info";
  title: string;
  description?: string;
  items?: string[];
};

function isNextRedirectError(e: unknown): boolean {
  return (
    !!e &&
    typeof e === "object" &&
    "digest" in e &&
    typeof (e as { digest: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export function CoachForm({ terms }: { terms: TermItem[] }) {
  const router = useRouter();
  const [realName, setRealName] = useState("");
  const [gender, setGender] = useState("");
  const [bio, setBio] = useState("");
  const [areaSido, setAreaSido] = useState("");
  const [areaSigungu, setAreaSigungu] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [agreedTerms, setAgreedTerms] = useState<number[]>([]);
  const [pending, startTransition] = useTransition();
  const [alert, setAlert] = useState<AlertState>({ open: false, variant: "warning", title: "" });

  const close = () => setAlert((a) => ({ ...a, open: false }));
  const requiredTermVersions = terms.filter((t) => t.isRequired).map((t) => t.versionId);

  const handleSubmit = () => {
    const missing: string[] = [];
    if (!realName.trim()) missing.push("이름을 입력해주세요");
    if (!gender) missing.push("성별을 선택해주세요");
    if (!bio.trim() || bio.trim().length < 10) missing.push("자기소개는 10자 이상 입력해주세요");
    if (!areaSido) missing.push("활동 지역 (시·도)를 선택해주세요");
    if (!areaSigungu) missing.push("활동 지역 (시·군·구)를 선택해주세요");
    if (!requiredTermVersions.every((id) => agreedTerms.includes(id))) {
      missing.push("필수 약관에 동의해주세요");
    }

    if (missing.length > 0) {
      setAlert({
        open: true,
        variant: "warning",
        title: "입력하지 않은 항목이 있어요",
        description: "아래 항목을 확인하고 다시 시도해 주세요.",
        items: missing,
      });
      return;
    }

    const fd = new FormData();
    fd.set("realName", realName.trim());
    fd.set("gender", gender);
    fd.set("bio", bio.trim());
    fd.set("areaSido", areaSido);
    fd.set("areaSigungu", areaSigungu);
    if (experienceYears) fd.set("experienceYears", experienceYears);
    fd.set("agreedTermVersionIds", agreedTerms.join(","));

    startTransition(async () => {
      try {
        await submitCoachProfile(fd);
        router.push("/onboarding/coach/schedule");
        router.refresh();
      } catch (e) {
        if (isNextRedirectError(e)) throw e;
        setAlert({
          open: true,
          variant: "error",
          title: "등록 중 오류가 발생했어요",
          description: e instanceof Error ? e.message : "잠시 후 다시 시도해주세요.",
        });
      }
    });
  };

  return (
    <>
      {pending && <div className="courtside-progress-bar" aria-hidden style={{ position: "fixed" }} />}

      <div className="mt-8 space-y-6">
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center flex-none mt-0.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-ink">왜 본명이 필요해요?</div>
              <ul className="mt-1.5 space-y-1 text-xs text-ink-2 leading-relaxed list-disc pl-4">
                <li>학생이 코치님께 등록을 요청할 때 본명·연락처로 매칭돼요.</li>
                <li>구독 결제·세금계산서 등 사업자 의무 처리를 위해 본인 확인이 필요해요.</li>
                <li>등록된 학생에게는 본명이 공개되고, 다른 회원에게는 마스킹(홍**)되어 표시돼요.</li>
              </ul>
            </div>
          </div>
        </div>

        <Field label="이름" required>
          <TextInput
            type="text"
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            placeholder="실명으로 입력해주세요"
            maxLength={20}
          />
        </Field>

        {/* 생년월일 필드는 일시 숨김 — 추후 마이페이지에서 입력하도록 이동 */}

        <Field label="성별" required>
          <RadioGroupControlled
            value={gender}
            onChange={setGender}
            options={[{ value: "MALE", label: "남성" }, { value: "FEMALE", label: "여성" }]}
          />
        </Field>

        <Field label="자기소개" required>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            minLength={10}
            maxLength={500}
            rows={4}
            placeholder="간단한 자기소개와 강점을 적어주세요 (10자 이상)"
          />
        </Field>

        <RegionSelectPair
          sidoName="areaSido"
          sigunguName="areaSigungu"
          sidoLabel="활동 지역 (시·도)"
          sigunguLabel="활동 지역 (시·군·구)"
          required
          value={{ sido: areaSido, sigungu: areaSigungu }}
          onChange={(v) => {
            setAreaSido(v.sido);
            setAreaSigungu(v.sigungu);
          }}
        />

        <Field label="경력 (년, 선택)">
          <TextInput
            type="number"
            min={0}
            max={50}
            value={experienceYears}
            onChange={(e) => setExperienceYears(e.target.value)}
            placeholder="예: 5"
          />
        </Field>

        {/* 약관 동의 */}
        <div>
          <div className="mb-2 text-sm font-semibold text-ink flex items-center gap-1">
            약관 동의
            <span className="text-red-500">*</span>
          </div>
          <TermsAgreement terms={terms} agreed={agreedTerms} onChange={setAgreedTerms} />
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="w-full h-12 rounded-xl bg-ink text-white font-semibold text-sm hover:opacity-90 transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {pending && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4zm2 5.3A7.96 7.96 0 014 12H0c0 3 1.1 5.8 3 7.9l3-2.6z" />
              </svg>
            )}
            {pending ? "등록 중…" : "등록 완료"}
          </button>
        </div>
      </div>

      <AlertModal open={alert.open} onClose={close} title={alert.title} description={alert.description} variant={alert.variant} items={alert.items} />
    </>
  );
}

function RadioGroupControlled({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-11 flex items-center justify-center rounded-lg border text-sm transition ${value === o.value ? "border-ink bg-ink text-white font-semibold" : "border-line bg-surface text-ink-2"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
