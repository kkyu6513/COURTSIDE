import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LessonDetailScreen, type LessonDetailData } from "@/components/lesson/lesson-detail-screen";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function StudentLessonDetailPage({
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
  const role = meta?.role;
  if (!role) redirect("/onboarding/role");

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select(
      "id, coachId, studentId, scheduledAt, durationMinutes, status, paymentStatus, lessonFormat, roundNumber, totalRounds, originalScheduledAt, originalLessonId, parentLessonId, splitIndex, splitTotal, notes, createdAt, updatedAt",
    )
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) notFound();

  // 권한 — 본인 코치(코치 모드) OR 본인 학생만 진입 가능
  const isOwnerCoach = role === "COACH" && lesson.coachId === user.id;
  const isOwnerStudent = role === "STUDENT" && lesson.studentId === user.id;
  if (!isOwnerCoach && !isOwnerStudent) redirect("/");

  // 코치가 잘못 진입한 경우 — 코치용 라우트로 리다이렉트
  if (isOwnerCoach) redirect(`/coach/lessons/${lessonId}`);

  const { data: coach } = await admin
    .from("users")
    .select("id, realName, name, phone")
    .eq("id", lesson.coachId)
    .maybeSingle();

  const { data: coachProfile } = await admin
    .from("coach_profiles")
    .select("areaSido, areaSigungu, ntrpMin, ntrpMax")
    .eq("userId", lesson.coachId)
    .maybeSingle();

  const data: LessonDetailData = {
    lesson,
    viewerRole: "STUDENT",
    counterpart: coach
      ? {
          id: coach.id,
          name: coach.realName || coach.name || "이름 미입력",
          phone: coach.phone,
        }
      : null,
    studentProfile: null,
    coachProfile: coachProfile ?? null,
  };

  return <LessonDetailScreen data={data} backHref="/" />;
}
