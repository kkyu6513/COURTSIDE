"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field, RadioGroup, TextInput } from "@/components/onboarding-form";
import { AlertModal } from "@/components/alert-modal";
import { PhoneVerification } from "@/components/phone-verification";
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

export function StudentForm() {
  const router = useRouter();
  const [gender, setGender] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [coachName, setCoachName] = useState("");
  const [coachPhone, setCoachPhone] = useState("");
  const [pending, startTransition] = useTransition();
  const [alert, setAlert] = useState<AlertState>({
    open: false,
    variant: "warning",
    title: "",
  });

  const close = () => setAlert((a) => ({ ...a, open: false }));

  const handleSubmit = () => {
    const missing: string[] = [];
    if (!gender) missing.push("성별을 선택해주세요");
    if (!ageGroup) missing.push("연령대를 선택해주세요");
    if (!verifiedPhone) missing.push("전화번호 본인 인증을 완료해주세요");

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

    const cName = coachName.trim();
    const cPhone = coachPhone.replace(/[^\d]/g, "");
    if ((cName && !cPhone) || (!cName && cPhone)) {
      setAlert({
        open: true,
        variant: "warning",
        title: "코치 정보를 확인해 주세요",
        description: "코치 이름과 코치 전화번호는 함께 입력해야 자동 매칭이 가능해요. 둘 다 입력하거나, 둘 다 비워주세요.",
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
    fd.set("gender", gender);
    fd.set("ageGroup", ageGroup);
    fd.set("phone", verifiedPhone!);
    fd.set("phoneVerified", "1");
    if (cName) fd.set("claimedCoachName", cName);
    if (cPhone) fd.set("claimedCoachPhone", cPhone);

    startTransition(async () => {
      try {
        await submitStudentProfile(fd);
        router.push("/");
      } catch (e) {
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
        <Field label="성별" required>
          <RadioGroupControlled value={gender} onChange={setGender} options={[{ value: "MALE", label: "남성" }, { value: "FEMALE", label: "여성" }]} />
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
              레슨받고 계시는 코치님 정보를 미리 입력해 두시면, 등록 완료 시 코치님께 알림이 자동으로 발송되어 본인의 학생으로
              빠르게 등록받을 수 있어요. 정보가 일치하지 않으면 알림은 발송되지 않습니다.
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

        <div className="rounded-xl bg-soft p-4 text-xs text-ink-2 leading-relaxed space-y-3">
          <div className="font-semibold text-ink text-sm">💡 가입 이후 흐름을 알려드릴게요</div>

          <div>
            <div className="font-semibold text-ink mb-1">① 위에 코치 정보를 입력했다면</div>
            <p>등록 완료 즉시 시스템이 해당 코치님을 찾아 알림톡을 발송합니다. 코치님이 알림을 받고 회원님을 본인의 학생으로 등록하면 자동 연결됩니다.</p>
          </div>

          <div>
            <div className="font-semibold text-ink mb-1">② 코치 정보를 입력하지 않았거나 매칭이 안 되는 경우</div>
            <p>레슨받으실 코치님께 <b>방금 입력하신 회원님 전화번호로 가입했다고 직접 말씀</b>해 주세요. 코치님이 회원님을 조회해서 학생으로 등록해 드립니다.</p>
          </div>

          <div>
            <div className="font-semibold text-ink mb-1">③ 추가 정보는 나중에 채워도 돼요</div>
            <p>NTRP 레벨, 레슨 목표, 선호 시간대 등은 가입 후 <b>마이페이지 → 내 정보</b>에서 언제든 추가하거나 수정할 수 있어요.</p>
          </div>

          <p className="pt-1 text-ink-3">※ 입력하신 전화번호는 코치님이 회원님을 찾고 알림을 보내는 용도로만 사용됩니다.</p>
        </div>

        <div className="pt-4">
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
