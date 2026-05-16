import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WeeklyTimetable, type LessonRow } from "@/components/coach/weekly-timetable";
import type { StudentOption } from "@/components/coach/student-picker-sheet";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function CoachSchedulePage() {
  noStore();
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

  // 코치 본인의 lessons
  const { data: lessonsRaw } = await admin
    .from("lessons")
    .select("id, studentId, scheduledAt, durationMinutes, status")
    .eq("coachId", user.id);
  const lessons = (lessonsRaw ?? []) as LessonRow[];

  // 코치 본인의 수강생 = matchedCoachUserId 본인 + status=CONFIRMED인 claim의 학생
  const { data: confirmedClaims } = await admin
    .from("student_self_claims")
    .select("studentUserId")
    .eq("matchedCoachUserId", user.id)
    .eq("status", "CONFIRMED");

  const studentIds = Array.from(new Set((confirmedClaims ?? []).map((c) => c.studentUserId)));

  let students: StudentOption[] = [];
  if (studentIds.length > 0) {
    const { data: usersRows } = await admin
      .from("users")
      .select("id, realName, name, phone")
      .in("id", studentIds);
    students = ((usersRows ?? []) as Array<{ id: string; realName: string | null; name: string | null; phone: string | null }>).map(
      (u) => ({
        id: u.id,
        name: u.realName || u.name || "이름 미입력",
        phone: u.phone,
      }),
    );
  }

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

        <WeeklyTimetable lessons={lessons} students={students} />
      </div>
    </main>
  );
}
