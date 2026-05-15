import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WeeklyTimetable } from "@/components/coach/weekly-timetable";

export default async function CoachSchedulePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") redirect("/");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("coach_profiles")
    .select("id")
    .eq("userId", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding/coach");

  // 추후 lessons 테이블 조회 후 props로 전달 (Sprint 2)
  return (
    <main className="min-h-screen bg-bg">
      <div className="max-w-md mx-auto">
        <div className="flex items-center h-14 px-3 sticky top-0 z-10 bg-bg/85 backdrop-blur border-b border-line">
          <Link
            href="/"
            aria-label="뒤로가기"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-soft transition text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="flex-1 text-center text-sm font-bold text-ink">전체 스케줄</div>
          <div className="w-10 h-10" />
        </div>

        <WeeklyTimetable />
      </div>
    </main>
  );
}
