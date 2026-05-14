import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingHeader } from "@/components/onboarding-form";
import { RoleButtons } from "./role-buttons";

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

        <RoleButtons currentRole={currentRole} force={force} />

        <p className="mt-8 text-center text-xs text-ink-3 leading-relaxed">
          역할은 나중에 마이페이지에서 변경할 수 있어요
        </p>
      </div>
    </main>
  );
}
