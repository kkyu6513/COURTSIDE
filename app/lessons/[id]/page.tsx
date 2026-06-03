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

  // 현재 레슨이 속한 월(KST) 범위 — 통계 집계용
  const lessonKst = new Date(new Date(lesson.scheduledAt).getTime() + 9 * 60 * 60 * 1000);
  const monthStartKst = new Date(Date.UTC(lessonKst.getUTCFullYear(), lessonKst.getUTCMonth(), 1, 0, 0, 0));
  const monthEndKst = new Date(Date.UTC(lessonKst.getUTCFullYear(), lessonKst.getUTCMonth() + 1, 1, 0, 0, 0));
  const monthStartUtc = new Date(monthStartKst.getTime() - 9 * 60 * 60 * 1000).toISOString();
  const monthEndUtc = new Date(monthEndKst.getTime() - 9 * 60 * 60 * 1000).toISOString();

  const [coachRes, coachProfileRes, monthLessonsRes, recentLessonsRes] = await Promise.all([
    admin.from("users").select("id, realName, name, phone").eq("id", lesson.coachId).maybeSingle(),
    admin
      .from("coach_profiles")
      .select("areaSido, areaSigungu, ntrpMin, ntrpMax")
      .eq("userId", lesson.coachId)
      .maybeSingle(),
    // 학생 본인의 같은 코치 + 해당 월 회차 (월간 통계)
    admin
      .from("lessons")
      .select("status, originalLessonId")
      .eq("studentId", user.id)
      .eq("coachId", lesson.coachId)
      .gte("scheduledAt", monthStartUtc)
      .lt("scheduledAt", monthEndUtc),
    // 정규 패턴 — 최근 30건(CANCELLED/PENDING 제외)
    admin
      .from("lessons")
      .select("scheduledAt, durationMinutes, status")
      .eq("studentId", user.id)
      .eq("coachId", lesson.coachId)
      .not("status", "in", "(CANCELLED,PENDING)")
      .order("scheduledAt", { ascending: false })
      .limit(30),
  ]);
  const coach = coachRes.data;
  const coachProfile = coachProfileRes.data;

  // 해당 월 결강/보강 카운트
  const monthLessons = (monthLessonsRes.data ?? []) as Array<{ status: string; originalLessonId: number | null }>;
  const monthlyAbsentCount = monthLessons.filter((l) => l.status === "ABSENT").length;
  const monthlyMakeupCount = monthLessons.filter(
    (l) =>
      l.status === "MAKEUP_PENDING" ||
      l.status === "MAKEUP_CONFIRMED" ||
      l.status === "MAKEUP_REQUESTED" ||
      l.originalLessonId != null,
  ).length;

  // 정기 패턴 — (요일·시·분·길이) mode, 최소 2회
  const patternFreq = new Map<string, { dow: number; hour: number; minute: number; dur: number; count: number }>();
  for (const l of (recentLessonsRes.data ?? []) as Array<{ scheduledAt: string; durationMinutes: number; status: string }>) {
    const kst = new Date(new Date(l.scheduledAt).getTime() + 9 * 60 * 60 * 1000);
    const dow = kst.getUTCDay();
    const hour = kst.getUTCHours();
    const minute = kst.getUTCMinutes();
    const dur = l.durationMinutes;
    const k = `${dow}-${hour}-${minute}-${dur}`;
    const prev = patternFreq.get(k);
    if (prev) prev.count += 1;
    else patternFreq.set(k, { dow, hour, minute, dur, count: 1 });
  }
  let recurringPattern: NonNullable<LessonDetailData["studentInsights"]>["recurringPattern"] = null;
  for (const v of patternFreq.values()) {
    if (v.count >= 2 && (!recurringPattern || v.count > recurringPattern.sampleCount)) {
      recurringPattern = {
        dayOfWeek: v.dow,
        hour: v.hour,
        minute: v.minute,
        durationMinutes: v.dur,
        sampleCount: v.count,
      };
    }
  }

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
    studentInsights: {
      recurringPattern,
      monthlyAbsentCount,
      monthlyMakeupCount,
      monthLabel: `${lessonKst.getUTCMonth() + 1}월`,
    },
  };

  return <LessonDetailScreen data={data} backHref="/" />;
}
