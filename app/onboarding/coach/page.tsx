import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingHeader } from "@/components/onboarding-form";
import { CoachForm } from "./coach-form";
import { getActiveTerms } from "@/lib/terms";

export default async function CoachOnboardingPage({
  searchParams,
}: {
  searchParams?: { force?: string };
}) {
  const force = searchParams?.force === "1";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const meta = user.app_metadata as { role?: string; plan?: string } | undefined;
  const role = meta?.role;
  if (!role) redirect("/onboarding/role");
  if (role === "STUDENT") redirect("/onboarding/student");
  if (!meta?.plan) redirect("/onboarding/coach/plan");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("coach_profiles")
    .select("id")
    .eq("userId", user.id)
    .maybeSingle();

  if (existing && !force) redirect("/");

  const terms = await getActiveTerms();

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

        <CoachForm
          terms={terms.map((t) => ({
            versionId: t.versionId,
            code: t.code,
            title: t.title,
            isRequired: t.isRequired,
            sortOrder: t.sortOrder,
            content: t.content,
          }))}
        />
      </div>
    </main>
  );
}
