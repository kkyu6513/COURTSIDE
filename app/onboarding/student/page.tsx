import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitStudentProfile } from "./actions";
import {
  OnboardingHeader,
  Field,
  RadioGroup,
  Select,
  TextInput,
  SubmitButton,
} from "@/components/onboarding-form";
import { RegionSelectPair } from "@/components/region-select";
import { NtrpTooltipButton } from "@/components/ntrp-tooltip";

const NTRP_OPTIONS = [
  { value: "1.0-2.0", label: "1.0 ~ 2.0 (입문)" },
  { value: "2.5-3.0", label: "2.5 ~ 3.0 (초급)" },
  { value: "3.5-4.0", label: "3.5 ~ 4.0 (중급)" },
  { value: "4.5-5.0", label: "4.5 ~ 5.0 (상급)" },
  { value: "5.5+", label: "5.5+ (프로)" },
];

export default async function StudentOnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = (user.app_metadata as { role?: string } | undefined)?.role;
  if (!role) redirect("/onboarding/role");
  if (role === "COACH") redirect("/onboarding/coach");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("student_profiles")
    .select("id")
    .eq("userId", user.id)
    .maybeSingle();

  if (existing) redirect("/");

  return (
    <main className="min-h-screen bg-bg pb-12">
      <div className="max-w-md mx-auto px-6 pt-4">
        <OnboardingHeader backHref="/onboarding/role" step={2} total={2} />

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-ink">학생 프로필 등록</h1>
          <p className="mt-1.5 text-sm text-ink-2">
            코치 매칭을 위해 정보를 입력해주세요
          </p>
        </div>

        <form action={submitStudentProfile} className="mt-8 space-y-6">
          <Field label="성별" required>
            <RadioGroup
              name="gender"
              cols={2}
              options={[
                { value: "MALE", label: "남성" },
                { value: "FEMALE", label: "여성" },
              ]}
            />
          </Field>

          <Field label="연령대" required>
            <div className="grid grid-cols-5 gap-2">
              {[
                { value: "TEENS", label: "10대" },
                { value: "TWENTIES", label: "20대" },
                { value: "THIRTIES", label: "30대" },
                { value: "FORTIES", label: "40대" },
                { value: "FIFTIES_PLUS", label: "50+" },
              ].map((o) => (
                <label key={o.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="ageGroup"
                    value={o.value}
                    required
                    className="peer sr-only"
                  />
                  <div className="h-11 flex items-center justify-center rounded-lg border border-line bg-surface text-xs text-ink-2 peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white transition">
                    {o.label}
                  </div>
                </label>
              ))}
            </div>
          </Field>

          <Field label="NTRP 레벨" required>
            <Select
              name="ntrpLevel"
              required
              placeholder="레벨을 선택하세요"
              options={NTRP_OPTIONS}
            />
            <div className="mt-2">
              <NtrpTooltipButton />
            </div>
          </Field>

          <RegionSelectPair
            sidoName="areaSido"
            sigunguName="areaSigungu"
            sidoLabel="희망 레슨 지역 (시·도)"
            sigunguLabel="희망 레슨 지역 (시·군·구)"
            required
          />

          <Field label="레슨 목표 (선택)">
            <TextInput
              name="goal"
              type="text"
              placeholder="예: 포핸드 개선, 실전 게임"
              maxLength={100}
            />
          </Field>

          <div className="pt-4">
            <SubmitButton>등록 완료</SubmitButton>
          </div>
        </form>
      </div>
    </main>
  );
}
