import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LessonDetailScreen, type LessonDetailData } from "@/components/lesson/lesson-detail-screen";

export const dynamic = "force-dynamic";

export default async function CoachLessonDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const lessonId = Number(params.id);
  if (!Number.isInteger(lessonId) || lessonId <= 0) notFound();

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
      "id, coachId, studentId, scheduledAt, durationMinutes, status, paymentStatus, lessonFormat, roundNumber, totalRounds, originalScheduledAt, splitIndex, splitTotal, notes",
    )
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) notFound();
  if (lesson.coachId !== user.id) notFound();

  const [studentRes, studentProfileRes] = await Promise.all([
    admin.from("users").select("id, realName, name, phone").eq("id", lesson.studentId).maybeSingle(),
    admin
      .from("student_profiles")
      .select("gender, ageGroup, ntrpLevel")
      .eq("userId", lesson.studentId)
      .maybeSingle(),
  ]);
  const student = studentRes.data;
  const studentProfile = studentProfileRes.data;

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
