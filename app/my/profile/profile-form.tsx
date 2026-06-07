"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field, TextInput, Textarea } from "@/components/onboarding-form";
import { RegionSelectPair } from "@/components/region-select";
import { AlertModal } from "@/components/alert-modal";
import { updateCoachProfile } from "./actions";

type AlertState = {
  open: boolean;
  variant: "warning" | "error" | "success" | "info";
  title: string;
  description?: string;
  items?: string[];
};

export type CoachProfileInitial = {
  realName: string;
  birthDate: string; // yyyy-MM-dd 또는 ""
  gender: string;
  bio: string;
  areaSido: string;
  areaSigungu: string;
  experienceYears: string;
  phone: string; // 마스킹된 표시용
  email: string;
};

export function ProfileForm({ initial }: { initial: CoachProfileInitial }) {
  const router = useRouter();
  const [realName, setRealName] = useState(initial.realName);
  const [birthDate, setBirthDate] = useState(initial.birthDate);
  const [gender, setGender] = useState(initial.gender);
  const [bio, setBio] = useState(initial.bio);
  const [areaSido, setAreaSido] = useState(initial.areaSido);
  const [areaSigungu, setAreaSigungu] = useState(initial.areaSigungu);
  const [experienceYears, setExperienceYears] = useState(initial.experienceYears);
  const [pending, startTransition] = useTransition();
  const [alert, setAlert] = useState<AlertState>({ open: false, variant: "warning", title: "" });

  const close = () => setAlert((a) => ({ ...a, open: false }));

  const handleSubmit = () => {
    const missing: string[] = [];
    if (!realName.trim()) missing.push("이름을 입력해주세요");
    if (!gender) missing.push("성별을 선택해주세요");
    if (!bio.trim() || bio.trim().length < 10) missing.push("자기소개는 10자 이상 입력해주세요");
    if (!areaSido) missing.push("활동 지역(시·도)을 선택해주세요");
    if (!areaSigungu) missing.push("활동 지역(시·군·구)을 선택해주세요");

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
    if (birthDate) fd.set("birthDate", birthDate);
    fd.set("gender", gender);
    fd.set("bio", bio.trim());
    fd.set("areaSido", areaSido);
    fd.set("areaSigungu", areaSigungu);
    if (experienceYears) fd.set("experienceYears", experienceYears);

    startTransition(async () => {
      try {
        await updateCoachProfile(fd);
        setAlert({
          open: true,
          variant: "success",
          title: "프로필을 저장했어요",
          description: "변경한 내용이 반영되었습니다.",
        });
        router.refresh();
      } catch (e) {
        setAlert({
          open: true,
          variant: "error",
          title: "저장 중 오류가 발생했어요",
          description: e instanceof Error ? e.message : "잠시 후 다시 시도해주세요.",
        });
      }
    });
  };

  return (
    <>
      {pending && <div className="courtside-progress-bar" aria-hidden style={{ position: "fixed" }} />}

      <div className="mt-6 space-y-6">
        {/* 기본 정보 */}
        <div className="rounded-2xl border border-line bg-surface p-4 space-y-5">
          <Field label="이름" required>
            <TextInput
              type="text"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              placeholder="실명으로 입력해주세요"
              maxLength={20}
            />
          </Field>

          <Field label="생년월일 (선택)">
            <TextInput
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max="2015-12-31"
            />
          </Field>

          <Field label="성별" required>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "MALE", label: "남성" },
                { value: "FEMALE", label: "여성" },
              ].map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setGender(o.value)}
                  className={`h-11 flex items-center justify-center rounded-lg border text-sm transition ${
                    gender === o.value
                      ? "border-ink bg-ink text-white font-semibold"
                      : "border-line bg-surface text-ink-2"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* 코치 정보 */}
        <div className="rounded-2xl border border-line bg-surface p-4 space-y-5">
          <Field label="자기소개" required>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              minLength={10}
              maxLength={500}
              rows={4}
              placeholder="간단한 자기소개와 강점을 적어주세요 (10자 이상)"
            />
            <p className="mt-1 text-[11px] text-ink-3 text-right">{bio.length}/500</p>
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
        </div>

        {/* 변경 불가 정보 (읽기 전용) */}
        <div className="rounded-2xl border border-line bg-surface p-4 space-y-4">
          <div className="text-xs font-semibold text-ink-3">변경할 수 없는 정보</div>
          <ReadonlyRow label="이메일" value={initial.email || "—"} />
          <ReadonlyRow label="전화번호" value={initial.phone || "미등록"} />
          <p className="text-[11px] text-ink-3 leading-relaxed">
            전화번호는 학생 매칭에 사용되며, 변경하려면 계정 관리에서 재인증이 필요해요.
          </p>
        </div>

        <div className="pb-2">
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
            {pending ? "저장 중…" : "저장하기"}
          </button>
        </div>
      </div>

      <AlertModal open={alert.open} onClose={close} title={alert.title} description={alert.description} variant={alert.variant} items={alert.items} />
    </>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-ink-2">{label}</span>
      <span className="text-sm font-medium text-ink truncate">{value}</span>
    </div>
  );
}
