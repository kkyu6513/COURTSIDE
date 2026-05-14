import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitCoachProfile } from "./actions";
import {
  OnboardingHeader,
  Field,
  RadioGroup,
  TextInput,
  Textarea,
} from "@/components/onboarding-form";
import { SubmitButton } from "@/components/submit-button";
import { RegionSelectPair } from "@/components/region-select";

export default async function CoachOnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const meta = user.app_metadata as
    | { role?: string; plan?: string }
    | undefined;
  const role = meta?.role;
  if (!role) redirect("/onboarding/role");
  if (role === "STUDENT") redirect("/onboarding/student");

  // 플랜 미선택 시 플랜 선택부터
  if (!meta?.plan) redirect("/onboarding/coach/plan");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("coach_profiles")
    .select("id")
    .eq("userId", user.id)
    .maybeSingle();

  if (existing) redirect("/");

  return (
    <main className="min-h-screen bg-bg pb-12">
      <div className="max-w-md mx-auto px-6 pt-4">
        <OnboardingHeader
          backHref="/onboarding/coach/plan"
          step={3}
          total={3}
        />

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-ink">코치 프로필 등록</h1>
          <p className="mt-1.5 text-sm text-ink-2">
            학생들에게 보여줄 정보를 입력해주세요
          </p>
        </div>

        <form action={submitCoachProfile} className="mt-8 space-y-6">
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

          <Field label="자기소개" required>
            <Textarea
              name="bio"
              required
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
          />

          <Field label="경력 (년, 선택)">
            <TextInput
              name="experienceYears"
              type="number"
              min={0}
              max={50}
              placeholder="예: 5"
            />
          </Field>

          {/* 레슨 가격 + 가격 공개 여부는 다음 스프린트에서 코치 마이페이지에서 설정하도록 임시 숨김 */}

          <div className="pt-4">
            <SubmitButton>등록 완료</SubmitButton>
          </div>
        </form>
      </div>
    </main>
  );
}
