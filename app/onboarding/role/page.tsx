import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingHeader } from "@/components/onboarding-form";
import { randomQuote } from "@/lib/quotes";
import { RoleButtons } from "./role-buttons";
import { testSwitchRole } from "@/app/actions/test-switch-role";

export default async function RoleOnboardingPage({
  searchParams,
}: {
  searchParams?: { force?: string };
}) {
  const force = searchParams?.force === "1";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const currentRole = (user.app_metadata as { role?: string } | undefined)
    ?.role;

  const nickname =
    (user.user_metadata?.nickname as string | undefined) || "회원";

  const quote = randomQuote();

  return (
    <main className="min-h-screen bg-bg p-6">
      <div className="w-full max-w-sm mx-auto">
        <OnboardingHeader step={1} total={2} />

        <div className="text-center mt-6 mb-10">
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            반가워요, {nickname}님!
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            어떤 역할로 COURTSIDE를 사용하시나요?
          </p>
          {currentRole && (
            <p className="mt-2 text-xs text-ink-3">
              현재 역할: {currentRole === "STUDENT" ? "학생" : "코치"} (변경
              가능)
            </p>
          )}
        </div>

        <RoleButtons currentRole={currentRole} force={force} quote={quote} />

        <p className="mt-8 text-center text-xs text-ink-3 leading-relaxed">
          역할은 나중에 마이페이지에서 변경할 수 있어요
        </p>

        {/* [임시] 테스트 점프 — 가입 폼을 건너뛰고 바로 홈 진입 */}
        <div className="mt-10 p-4 rounded-2xl bg-soft border border-dashed border-line">
          <div className="text-[11px] font-bold text-ink-3 mb-2.5 tracking-wide">
            [테스트] 가입 완료 상태로 바로 점프
          </div>
          <div className="grid grid-cols-2 gap-2">
            <form action={testSwitchRole}>
              <input type="hidden" name="role" value="STUDENT" />
              <button
                type="submit"
                className="w-full h-10 rounded-lg border border-line bg-surface text-xs font-semibold text-ink-2 hover:bg-soft transition active:scale-[0.98]"
              >
                가입한 학생 홈
              </button>
            </form>
            <form action={testSwitchRole}>
              <input type="hidden" name="role" value="COACH" />
              <button
                type="submit"
                className="w-full h-10 rounded-lg border border-line bg-surface text-xs font-semibold text-ink-2 hover:bg-soft transition active:scale-[0.98]"
              >
                가입한 코치 홈
              </button>
            </form>
          </div>
          <p className="mt-2.5 text-[10px] text-ink-3 leading-relaxed">
            클릭 시 본인 계정의 역할이 즉시 변경되고 프로필이 자동 생성됩니다. 정식 가입 흐름이 안정화되면 제거됩니다.
          </p>
        </div>
      </div>
    </main>
  );
}
