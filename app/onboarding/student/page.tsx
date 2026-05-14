import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitStudentProfile } from "./actions";
import {
  OnboardingHeader,
  Field,
  RadioGroup,
  TextInput,
} from "@/components/onboarding-form";
import { SubmitButton } from "@/components/submit-button";

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
          <h1 className="text-2xl font-bold text-ink">기본 정보 입력</h1>
          <p className="mt-1.5 text-sm text-ink-2">
            코치에게 초대받기 위한 기본 정보를 입력해주세요
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

          <Field label="전화번호" required>
            <TextInput
              name="phone"
              required
              type="tel"
              inputMode="numeric"
              placeholder="01012345678 (- 없이)"
              pattern="[0-9]{10,11}"
              maxLength={11}
            />
            <p className="mt-1.5 text-xs text-ink-3">
              코치가 카카오톡 또는 SMS로 초대할 때 사용됩니다
            </p>
          </Field>

          <div className="rounded-xl bg-soft p-4 text-xs text-ink-2 leading-relaxed space-y-3">
            <div className="font-semibold text-ink text-sm">💡 가입 이후 흐름을 알려드릴게요</div>

            <div>
              <div className="font-semibold text-ink mb-1">① 코치님에게 알려주세요</div>
              <p>
                레슨받고 계신(또는 받으실) 코치님께 <b>방금 입력하신 전화번호로 가입했다고 말씀</b>해 주세요. 코치님이
                회원님을 조회해서 본인의 학생으로 등록(초대)해 드립니다.
              </p>
            </div>

            <div>
              <div className="font-semibold text-ink mb-1">② 자동으로 연결됩니다</div>
              <p>
                코치님이 초대를 보내면 카카오 알림톡(또는 SMS)이 도착하고, 별도 작업 없이 회원님 홈에 코치님과 레슨
                스케줄이 자동으로 표시됩니다.
              </p>
            </div>

            <div>
              <div className="font-semibold text-ink mb-1">③ 추가 정보는 나중에 채워도 돼요</div>
              <p>
                NTRP 레벨, 레슨 목표, 선호 시간대 등은 가입 후 <b>마이페이지 → 내 정보</b>에서 언제든 추가하거나 수정할
                수 있어요.
              </p>
            </div>

            <p className="pt-1 text-ink-3">
              ※ 입력하신 전화번호는 코치님이 회원님을 찾고 알림을 보내는 용도로만 사용됩니다.
            </p>
          </div>

          <div className="pt-4">
            <SubmitButton>등록 완료</SubmitButton>
          </div>
        </form>
      </div>
    </main>
  );
}
