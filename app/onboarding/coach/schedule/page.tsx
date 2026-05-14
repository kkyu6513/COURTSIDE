import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ScheduleForm } from "./schedule-form";

export default async function CoachScheduleOnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const meta = user.app_metadata as
    | { role?: string; plan?: string }
    | undefined;
  if (meta?.role !== "COACH") redirect("/onboarding/role");
  if (!meta?.plan) redirect("/onboarding/coach/plan");

  // 프로필 등록 안 됐으면 프로필부터
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("coach_profiles")
    .select("id")
    .eq("userId", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding/coach");

  return (
    <main className="min-h-screen bg-bg">
      <div className="max-w-md mx-auto">
        <div className="flex items-center h-12 px-3">
          <div className="w-10 h-10" />
          <div className="flex-1 text-center text-sm font-semibold text-ink">
            스케줄 등록
          </div>
          <Link
            href="/"
            className="w-16 h-10 flex items-center justify-center text-sm text-ink-3 hover:text-ink transition"
          >
            건너뛰기
          </Link>
        </div>

        <ScheduleForm />
      </div>
    </main>
  );
}
