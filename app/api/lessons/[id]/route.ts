import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskPhone } from "@/lib/masking";

export const dynamic = "force-dynamic";

/**
 * GET /api/lessons/[id]
 * 본인 코치 또는 본인 학생만 조회 가능. 코치/학생 양쪽 디테일 화면 공용.
 * counterpart.phone 은 항상 마스킹.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lessonId = Number(params.id);
  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    return NextResponse.json({ error: "잘못된 레슨 ID" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: lesson, error } = await admin
    .from("lessons")
    .select(
      "id, coachId, studentId, scheduledAt, durationMinutes, status, paymentStatus, lessonFormat, roundNumber, totalRounds, originalScheduledAt, splitIndex, splitTotal, notes",
    )
    .eq("id", lessonId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!lesson) return NextResponse.json({ error: "레슨을 찾을 수 없어요" }, { status: 404 });

  const role = (user.app_metadata as { role?: string } | undefined)?.role;
  const isOwnerCoach = role === "COACH" && lesson.coachId === user.id;
  const isOwnerStudent = role === "STUDENT" && lesson.studentId === user.id;
  if (!isOwnerCoach && !isOwnerStudent) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });
  }

  const counterpartId = isOwnerCoach ? lesson.studentId : lesson.coachId;

  const [counterpartRes, studentProfileRes, coachProfileRes] = await Promise.all([
    admin.from("users").select("id, realName, name, phone").eq("id", counterpartId).maybeSingle(),
    isOwnerCoach
      ? admin
          .from("student_profiles")
          .select("gender, ageGroup, ntrpLevel")
          .eq("userId", lesson.studentId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isOwnerStudent
      ? admin
          .from("coach_profiles")
          .select("areaSido, areaSigungu, ntrpMin, ntrpMax")
          .eq("userId", lesson.coachId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const counterpart = counterpartRes.data;

  return NextResponse.json({
    lesson,
    viewerRole: isOwnerCoach ? "COACH" : "STUDENT",
    counterpart: counterpart
      ? {
          id: counterpart.id,
          name: counterpart.realName || counterpart.name || "이름 미입력",
          phone: maskPhone(counterpart.phone),
        }
      : null,
    studentProfile: studentProfileRes.data ?? null,
    coachProfile: coachProfileRes.data ?? null,
  });
}
