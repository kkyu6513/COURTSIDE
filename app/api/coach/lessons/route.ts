import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type StudentRow = {
  id: string;
  realName: string | null;
  name: string | null;
  phone: string | null;
};

/**
 * 코치 본인의 lessons + CONFIRMED 학생 목록 반환.
 * 캘린더 client component가 mount 시 호출 — 항상 fresh.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: lessonsRaw, error: lessonsError } = await admin
    .from("lessons")
    .select("id, studentId, scheduledAt, durationMinutes, status, notes")
    .eq("coachId", user.id)
    .neq("status", "CANCELLED");

  if (lessonsError) {
    console.error("[api/coach/lessons] lessons error:", lessonsError);
    return NextResponse.json({ error: lessonsError.message }, { status: 500 });
  }

  const { data: claimsRaw } = await admin
    .from("student_self_claims")
    .select("studentUserId")
    .eq("matchedCoachUserId", user.id)
    .eq("status", "CONFIRMED");

  const studentIds = Array.from(new Set((claimsRaw ?? []).map((c) => c.studentUserId)));
  let students: { id: string; name: string; phone: string | null }[] = [];
  if (studentIds.length > 0) {
    const { data: usersRows } = await admin
      .from("users")
      .select("id, realName, name, phone")
      .in("id", studentIds);
    students = ((usersRows ?? []) as StudentRow[]).map((u) => ({
      id: u.id,
      name: u.realName || u.name || "이름 미입력",
      phone: u.phone,
    }));
  }

  return NextResponse.json({
    lessons: lessonsRaw ?? [],
    students,
  });
}
