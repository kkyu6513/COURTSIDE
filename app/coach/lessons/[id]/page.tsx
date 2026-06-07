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

  // 현재 레슨이 속한 월(KST) 범위 — 통계 집계용
  const lessonKst = new Date(new Date(lesson.scheduledAt).getTime() + 9 * 60 * 60 * 1000);
  const monthStartKst = new Date(Date.UTC(lessonKst.getUTCFullYear(), lessonKst.getUTCMonth(), 1, 0, 0, 0));
  const monthEndKst = new Date(Date.UTC(lessonKst.getUTCFullYear(), lessonKst.getUTCMonth() + 1, 1, 0, 0, 0));
  const monthStartUtc = new Date(monthStartKst.getTime() - 9 * 60 * 60 * 1000).toISOString();
  const monthEndUtc = new Date(monthEndKst.getTime() - 9 * 60 * 60 * 1000).toISOString();

  // 정규 패턴 추출용 — 같은 학생의 최근 active 회차 (CANCELLED 제외)
  const [studentRes, studentProfileRes, monthLessonsRes, recentLessonsRes] = await Promise.all([
    admin.from("users").select("id, realName, name, phone").eq("id", lesson.studentId).maybeSingle(),
    admin
      .from("student_profiles")
      .select("gender, ageGroup, ntrpLevel")
      .eq("userId", lesson.studentId)
      .maybeSingle(),
    admin
      .from("lessons")
      .select("id, scheduledAt, durationMinutes, status, paymentStatus, originalLessonId")
      .eq("coachId", user.id)
      .eq("studentId", lesson.studentId)
      .gte("scheduledAt", monthStartUtc)
      .lt("scheduledAt", monthEndUtc)
      .order("scheduledAt", { ascending: true }),
    admin
      .from("lessons")
      .select("scheduledAt, durationMinutes, status")
      .eq("coachId", user.id)
      .eq("studentId", lesson.studentId)
      .not("status", "in", "(CANCELLED,PENDING)")
      .order("scheduledAt", { ascending: false })
      .limit(30),
  ]);
  const student = studentRes.data;
  const studentProfile = studentProfileRes.data;

  // 해당 월 모든 회차 — 출석 현황 리스트 + 카운트 동시 산출
  const monthLessons = (monthLessonsRes.data ?? []) as Array<{
    id: number;
    scheduledAt: string;
    durationMinutes: number;
    status: string;
    paymentStatus: string | null;
    originalLessonId: number | null;
  }>;
  const monthlyAbsentCount = monthLessons.filter((l) => l.status === "ABSENT").length;
  const monthlyMakeupCount = monthLessons.filter(
    (l) =>
      l.status === "MAKEUP_PENDING" ||
      l.status === "MAKEUP_CONFIRMED" ||
      l.status === "MAKEUP_REQUESTED" ||
      l.originalLessonId != null,
  ).length;
  const monthlyAttendance = monthLessons.map((l) => ({
    id: l.id,
    scheduledAt: l.scheduledAt,
    durationMinutes: l.durationMinutes,
    status: l.status,
    isMakeup: l.originalLessonId != null,
    isCurrent: l.id === lesson.id,
  }));

  // 정기 패턴 추출 — (dayOfWeek, hour, minute, dur) 키별 빈도 mode
  type PatternKey = { dow: number; hour: number; minute: number; dur: number };
  const patternFreq = new Map<string, { key: PatternKey; count: number }>();
  for (const l of (recentLessonsRes.data ?? []) as Array<{ scheduledAt: string; durationMinutes: number; status: string }>) {
    const kst = new Date(new Date(l.scheduledAt).getTime() + 9 * 60 * 60 * 1000);
    const dow = kst.getUTCDay();
    const hour = kst.getUTCHours();
    const minute = kst.getUTCMinutes();
    const dur = l.durationMinutes;
    const k = `${dow}-${hour}-${minute}-${dur}`;
    const prev = patternFreq.get(k);
    if (prev) prev.count += 1;
    else patternFreq.set(k, { key: { dow, hour, minute, dur }, count: 1 });
  }
  let recurringPattern: NonNullable<LessonDetailData["studentInsights"]>["recurringPattern"] = null;
  // 최소 2회 이상 반복돼야 정규 패턴으로 인정
  for (const v of patternFreq.values()) {
    if (v.count >= 2 && (!recurringPattern || v.count > recurringPattern.sampleCount)) {
      recurringPattern = {
        dayOfWeek: v.key.dow,
        hour: v.key.hour,
        minute: v.key.minute,
        durationMinutes: v.key.dur,
        sampleCount: v.count,
      };
    }
  }

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
    studentInsights: {
      recurringPattern,
      monthlyAbsentCount,
      monthlyMakeupCount,
      monthLabel: `${lessonKst.getUTCMonth() + 1}월`,
      monthlyAttendance,
    },
  };

  return <LessonDetailScreen data={data} backHref="/" />;
}
