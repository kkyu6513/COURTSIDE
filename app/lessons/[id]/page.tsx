import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LessonDetailScreen, type LessonDetailData } from "@/components/lesson/lesson-detail-screen";

export const dynamic = "force-dynamic";

export default async function StudentLessonDetailPage({
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
  const role = meta?.role;
  if (!role) redirect("/onboarding/role");

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select(
      "id, coachId, studentId, scheduledAt, durationMinutes, status, paymentStatus, lessonFormat, roundNumber, totalRounds, originalScheduledAt, splitIndex, splitTotal, notes",
    )
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) notFound();

  const isOwnerCoach = role === "COACH" && lesson.coachId === user.id;
  const isOwnerStudent = role === "STUDENT" && lesson.studentId === user.id;
  if (!isOwnerCoach && !isOwnerStudent) notFound();

  // 코치는 전용 라우트로 (알림톡 딥링크가 /lessons/[id]만 와도 코치 페이지로)
  if (isOwnerCoach) redirect(`/coach/lessons/${lessonId}`);

  const [coachRes, coachProfileRes] = await Promise.all([
    admin.from("users").select("id, realName, name, phone").eq("id", lesson.coachId).maybeSingle(),
    admin
      .from("coach_profiles")
      .select("areaSido, areaSigungu, ntrpMin, ntrpMax")
      .eq("userId", lesson.coachId)
      .maybeSingle(),
  ]);
  const coach = coachRes.data;
  const coachProfile = coachProfileRes.data;

  const data: LessonDetailData = {
    lesson,
    viewerRole: "STUDENT",
    counterpart: coach
      ? {
          id: coach.id,
          name: coach.realName || coach.name || "이름 미입력",
          phone: null, // 학생 시점 — 코치 번호 미노출
        }
      : null,
    studentProfile: null,
    coachProfile: coachProfile ?? null,
  };

  return <LessonDetailScreen data={data} backHref="/" />;
}
