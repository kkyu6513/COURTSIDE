import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/lessons
 * 본인 학생의 다가오는 21일(이번 주 시작 ~ +3주) 레슨 + 코치 이름.
 * CANCELLED 제외.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "STUDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dow = nowKst.getUTCDay();
  const offsetToMon = (dow + 6) % 7;
  const monKst = new Date(nowKst);
  monKst.setUTCDate(monKst.getUTCDate() - offsetToMon);
  monKst.setUTCHours(0, 0, 0, 0);
  const fromUtc = new Date(monKst.getTime() - 9 * 60 * 60 * 1000);
  const toUtc = new Date(fromUtc.getTime() + 21 * 24 * 60 * 60 * 1000);

  const { data: lessonsRaw, error } = await admin
    .from("lessons")
    .select(
      "id, coachId, scheduledAt, durationMinutes, status, paymentStatus, lessonFormat, roundNumber, totalRounds, originalScheduledAt",
    )
    .eq("studentId", user.id)
    .neq("status", "CANCELLED")
    .gte("scheduledAt", fromUtc.toISOString())
    .lte("scheduledAt", toUtc.toISOString())
    .order("scheduledAt", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const coachIds = Array.from(new Set((lessonsRaw ?? []).map((l) => l.coachId as string)));
  const coachNames: Record<string, string> = {};
  if (coachIds.length > 0) {
    const { data: usersRows } = await admin
      .from("users")
      .select("id, realName, name")
      .in("id", coachIds);
    for (const u of (usersRows ?? []) as { id: string; realName: string | null; name: string | null }[]) {
      coachNames[u.id] = u.realName || u.name || "이름 미입력";
    }
  }

  return NextResponse.json({
    lessons: lessonsRaw ?? [],
    coachNames,
  });
}
