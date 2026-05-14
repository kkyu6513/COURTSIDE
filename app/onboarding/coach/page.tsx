import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitCoachProfile } from "./actions";
import {
  SIDO_LIST,
  OnboardingHeader,
  Field,
  RadioGroup,
  Select,
  TextInput,
  Textarea,
  SubmitButton,
} from "@/components/onboarding-form";

export default async function CoachOnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = (user.app_metadata as { role?: string } | undefined)?.role;
  if (!role) redirect("/onboarding/role");
  if (role === "STUDENT") redirect("/onboarding/student");

  // 이미 코치 프로필 있으면 홈
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
        <OnboardingHeader backHref="/onboarding/role" step={2} total={2} />

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
              options={[
                { value: "MALE", label: "남성" },
                { value: "FEMALE", label: "여성" },
                { value: "OTHER", label: "기타" },
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

          <Field label="활동 지역 (시·도)" required>
            <Select
              name="areaSido"
              required
              placeholder="시·도를 선택하세요"
              options={SIDO_LIST.map((s) => ({ value: s, label: s }))}
            />
          </Field>

          <Field label="활동 지역 (시·군·구)" required>
            <TextInput
              name="areaSigungu"
              required
              type="text"
              placeholder="예: 강남구"
              maxLength={30}
            />
          </Field>

          <Field label="경력 (년, 선택)">
            <TextInput
              name="experienceYears"
              type="number"
              min={0}
              max={50}
              placeholder="예: 5"
            />
          </Field>

          <Field label="레슨 가격 (1회, 원)">
            <TextInput
              name="lessonPrice"
              type="number"
              min={0}
              step={1000}
              placeholder="예: 50000 (비공개 시 비워두기)"
            />
          </Field>

          <Field label="가격 공개 여부" required>
            <RadioGroup
              name="priceVisibility"
              cols={2}
              options={[
                { value: "PUBLIC", label: "공개" },
                { value: "PRIVATE", label: "비공개" },
              ]}
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
