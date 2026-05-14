"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field, TextInput } from "@/components/onboarding-form";
import { AlertModal } from "@/components/alert-modal";
import { PhoneVerification } from "@/components/phone-verification";
import { TermsAgreement, type TermItem } from "@/components/terms-agreement";
import { submitStudentProfile } from "./actions";

type AlertState = {
  open: boolean;
  variant: "warning" | "error" | "success" | "info";
  title: string;
  description?: string;
  items?: string[];
};

const AGE_GROUPS = [
  { value: "TEENS", label: "10대" },
  { value: "TWENTIES", label: "20대" },
  { value: "THIRTIES", label: "30대" },
  { value: "FORTIES", label: "40대" },
  { value: "FIFTIES_PLUS", label: "50+" },
];

function isNextRedirectError(e: unknown): boolean {
  return (
    !!e &&
    typeof e === "object" &&
    "digest" in e &&
    typeof (e as { digest: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

// YYYY-MM-DD 기본 검증
function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  if (d.getTime() > now.getTime()) return false;
  const yyyy = parseInt(s.slice(0, 4), 10);
  if (yyyy < 1900) return false;
  return true;
}

export function StudentForm({ terms }: { terms: TermItem[] }) {
  const router = useRouter();
  const [realName, setRealName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [coachName, setCoachName] = useState("");
  const [coachPhone, setCoachPhone] = useState("");
  const [agreedTerms, setAgreedTerms] = useState<number[]>([]);
  const [pending, startTransition] = useTransition();
  const [alert, setAlert] = useState<AlertState>({ open: false, variant: "warning", title: "" });

  const close = () => setAlert((a) => ({ ...a, open: false }));

  const requiredTermVersions = terms.filter((t) => t.isRequired).map((t) => t.versionId);

  const handleSubmit = () => {
    const missing: string[] = [];
    if (!realName.trim()) missing.push("이름을 입력해주세요");
    if (!birthDate) missing.push("생년월일을 입력해주세요");
    if (!gender) missing.push("성별을 선택해주세요");
    if (!ageGroup) missing.push("연령대를 선택해주세요");
    if (!verifiedPhone) missing.push("전화번호 본인 인증을 완료해주세요");
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

    if (birthDate && !isValidDate(birthDate)) {
      setAlert({
        open: true,
        variant: "warning",
        title: "생년월일을 확인해 주세요",
        description: "YYYY-MM-DD 형식의 올바른 날짜를 입력해 주세요.",
      });
      return;
    }

    const cName = coachName.trim();
    const cPhone = coachPhone.replace(/[^\d]/g, "");
    if ((cName && !cPhone) || (!cName && cPhone)) {
      setAlert({
        open: true,
        variant: "warning",
        title: "코치 정보를 확인해 주세요",
        description: "코치 이름과 전화번호는 함께 입력해야 자동 매칭이 가능해요.",
      });
      return;
    }
    if (cPhone && (cPhone.length < 10 || cPhone.length > 11)) {
      setAlert({
        open: true,
        variant: "warning",
        title: "코치 전화번호를 확인해 주세요",
        description: "10~11자리 숫자(- 없이)로 입력해 주세요.",
      });
      return;
    }

    const fd = new FormData();
    fd.set("realName", realName.trim());
    fd.set("birthDate", birthDate);
    fd.set("gender", gender);
    fd.set("ageGroup", ageGroup);
    fd.set("phone", verifiedPhone!);
    fd.set("phoneVerified", "1");
    fd.set("agreedTermVersionIds", agreedTerms.join(","));
    if (cName) fd.set("claimedCoachName", cName);
    if (cPhone) fd.set("claimedCoachPhone", cPhone);

    startTransition(async () => {
      try {
        await submitStudentProfile(fd);
        router.push("/");
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
                <li>코치님이 회원님을 정확히 알아보고 학생으로 등록할 수 있어요.</li>
                <li>결제·환불 등 안전한 거래를 위해 본인 확인이 필요해요.</li>
                <li>다른 회원에게는 공개되지 않고, 코치님 외에는 마스킹(김**)되어 표시돼요.</li>
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

        <Field label="생년월일" required>
          <TextInput
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            min="1900-01-01"
          />
        </Field>

        <Field label="성별" required>
          <RadioGroupControlled
            value={gender}
            onChange={setGender}
            options={[{ value: "MALE", label: "남성" }, { value: "FEMALE", label: "여성" }]}
          />
        </Field>

        <Field label="연령대" required>
          <div className="grid grid-cols-5 gap-2">
            {AGE_GROUPS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setAgeGroup(o.value)}
                className={`h-11 flex items-center justify-center rounded-lg border text-xs transition ${ageGroup === o.value ? "border-ink bg-ink text-white font-semibold" : "border-line bg-surface text-ink-2"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Field>

        <PhoneVerification
          onVerifiedChange={setVerifiedPhone}
          onError={(msg) => setAlert({ open: true, variant: "error", title: "인증 중 오류", description: msg })}
        />

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
          <div>
            <div className="font-semibold text-ink text-sm">🎾 코치 정보 (선택)</div>
            <p className="mt-1 text-xs text-ink-2 leading-relaxed">
              레슨받고 계시는 코치님 정보를 미리 입력해 두시면 등록 완료 시 알림이 발송됩니다.
              가입 후 홈에서도 다시 신청할 수 있어요.
            </p>
          </div>

          <Field label="코치 이름">
            <TextInput type="text" value={coachName} onChange={(e) => setCoachName(e.target.value)} placeholder="예: 김코치" maxLength={30} />
          </Field>

          <Field label="코치 전화번호">
            <TextInput
              type="tel"
              inputMode="numeric"
              value={coachPhone}
              onChange={(e) => setCoachPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 11))}
              placeholder="01012345678 (- 없이)"
              pattern="[0-9]{10,11}"
              maxLength={11}
            />
          </Field>
        </div>

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
