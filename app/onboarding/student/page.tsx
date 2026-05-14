import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingHeader } from "@/components/onboarding-form";
import { StudentForm } from "./student-form";
import { getActiveTerms } from "@/lib/terms";

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

  const terms = await getActiveTerms();

  return (
    <main className="min-h-screen bg-bg pb-12">
      <div className="max-w-md mx-auto px-6 pt-4">
        <OnboardingHeader backHref="/onboarding/role" step={2} total={2} />

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-ink">기본 정보 입력</h1>
          <p className="mt-1.5 text-sm text-ink-2">코치에게 초대받기 위한 기본 정보를 입력해주세요</p>
        </div>

        <StudentForm
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
