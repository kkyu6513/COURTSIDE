import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LessonDetailScreen, type LessonDetailData } from "@/components/lesson/lesson-detail-screen";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function CoachLessonDetailPage({
  params,
}: {
  params: { id: string };
}) {
  noStore();
  const lessonId = Number(params.id);
  if (!Number.isFinite(lessonId)) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") redirect("/");

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select(
      "id, coachId, studentId, scheduledAt, durationMinutes, status, paymentStatus, lessonFormat, roundNumber, totalRounds, originalScheduledAt, originalLessonId, parentLessonId, splitIndex, splitTotal, notes, createdAt, updatedAt",
    )
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) notFound();
  if (lesson.coachId !== user.id) redirect("/");

  const { data: student } = await admin
    .from("users")
    .select("id, realName, name, phone")
    .eq("id", lesson.studentId)
    .maybeSingle();

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("gender, ageGroup, ntrpLevel")
    .eq("userId", lesson.studentId)
    .maybeSingle();

  const data: LessonDetailData = {
    lesson,
    viewerRole: "COACH",
    counterpart: student
      ? {
          id: student.id,
          name: student.realName || student.name || "이름 미입력",
          phone: student.phone,
        }
      : null,
    studentProfile: studentProfile ?? null,
    coachProfile: null,
  };

  return <LessonDetailScreen data={data} backHref="/" />;
}
