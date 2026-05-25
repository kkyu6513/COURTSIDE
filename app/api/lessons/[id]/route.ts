import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * GET /api/lessons/[id]
 * 본인 코치 또는 본인 학생만 조회 가능.
 * 코치/학생 양쪽 디테일 화면이 공유하는 단일 조회 엔드포인트.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lessonId = Number(params.id);
  if (!Number.isFinite(lessonId)) {
    return NextResponse.json({ error: "잘못된 레슨 ID" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: lesson, error } = await admin
    .from("lessons")
    .select(
      "id, coachId, studentId, scheduledAt, durationMinutes, status, paymentStatus, lessonFormat, roundNumber, totalRounds, originalScheduledAt, originalLessonId, parentLessonId, splitIndex, splitTotal, notes, createdAt, updatedAt",
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
  const { data: counterpart } = await admin
    .from("users")
    .select("id, realName, name, phone")
    .eq("id", counterpartId)
    .maybeSingle();

  // 학생 프로필 (코치 시점) — NTRP/연령/성별
  let studentProfile:
    | { gender: string | null; ageGroup: string | null; ntrpLevel: string | null }
    | null = null;
  if (isOwnerCoach) {
    const { data: sp } = await admin
      .from("student_profiles")
      .select("gender, ageGroup, ntrpLevel")
      .eq("userId", lesson.studentId)
      .maybeSingle();
    if (sp) studentProfile = sp;
  }

  // 코치 프로필 (학생 시점) — 지역 + NTRP 범위
  let coachProfile:
    | {
        areaSido: string | null;
        areaSigungu: string | null;
        ntrpMin: number | null;
        ntrpMax: number | null;
      }
    | null = null;
  if (isOwnerStudent) {
    const { data: cp } = await admin
      .from("coach_profiles")
      .select("areaSido, areaSigungu, ntrpMin, ntrpMax")
      .eq("userId", lesson.coachId)
      .maybeSingle();
    if (cp) coachProfile = cp;
  }

  return NextResponse.json({
    lesson,
    viewerRole: isOwnerCoach ? "COACH" : "STUDENT",
    counterpart: counterpart
      ? {
          id: counterpart.id,
          name: counterpart.realName || counterpart.name || "이름 미입력",
          phone: counterpart.phone,
        }
      : null,
    studentProfile,
    coachProfile,
  });
}
