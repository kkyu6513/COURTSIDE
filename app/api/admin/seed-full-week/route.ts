/**
 * 일회성 테스트 시드 — 이번 주 월~일, 매 시간(06~22시) 60분 짜리 lesson을 채움.
 * 학생: 코치의 CONFIRMED claim 학생들을 순환 배정.
 * 이미 있는 시각은 skip.
 *
 * 사용 후 라우트 + 데이터 정리 예정.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ONE_TIME_TOKEN = "courtside-seed-full-week-2026-05-17-Mn4qPzW9rT";

async function runSeed(coachUserId: string): Promise<NextResponse> {
  const admin = createAdminClient();

  // 1. 본인 CONFIRMED 학생
  const { data: claims } = await admin
    .from("student_self_claims")
    .select("studentUserId")
    .eq("matchedCoachUserId", coachUserId)
    .eq("status", "CONFIRMED");

  const studentIds = Array.from(new Set((claims ?? []).map((c) => c.studentUserId)));
  if (studentIds.length === 0) {
    return NextResponse.json(
      {
        error:
          "수락된 수강생이 없어요. /coach/notifications에서 학생 등록 요청을 먼저 수락해주세요.",
      },
      { status: 400 },
    );
  }

  // 2. 이번 주 월요일 KST 자정 시각 계산
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dow = nowKst.getUTCDay();
  const offsetToMon = (dow + 6) % 7;
  const monKstTrick = new Date(nowKst);
  monKstTrick.setUTCDate(monKstTrick.getUTCDate() - offsetToMon);
  monKstTrick.setUTCHours(0, 0, 0, 0);
  // monKstTrick: KST 월요일 자정을 의도, raw는 +9h shift된 값

  // 3. 이미 있는 lesson 시각 set
  const { data: existing } = await admin
    .from("lessons")
    .select("scheduledAt, status")
    .eq("coachId", coachUserId);
  const existingSet = new Set(
    (existing ?? [])
      .filter((e) => e.status !== "CANCELLED")
      .map((e) => new Date(e.scheduledAt).getTime()),
  );

  // 4. 월~일 × 06~22시 lesson rows
  const now = new Date().toISOString();
  const rows: Array<{
    coachId: string;
    studentId: string;
    scheduledAt: string;
    durationMinutes: number;
    status: string;
    updatedAt: string;
  }> = [];
  let idx = 0;
  let skipped = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 6; h < 23; h++) {
      // KST (월요일 + d일, h시 0분) → UTC ISO
      const kstMs = monKstTrick.getTime() + d * 24 * 60 * 60 * 1000 + h * 60 * 60 * 1000;
      const utcMs = kstMs - 9 * 60 * 60 * 1000;
      const startIso = new Date(utcMs).toISOString();
      if (existingSet.has(utcMs)) {
        skipped++;
        continue;
      }
      const studentId = studentIds[idx % studentIds.length];
      idx++;
      rows.push({
        coachId: coachUserId,
        studentId,
        scheduledAt: startIso,
        durationMinutes: 60,
        status: "CONFIRMED",
        updatedAt: now,
      });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      inserted: 0,
      skipped,
      message: "이번 주 모든 시간에 이미 레슨이 있어요. 추가 생성 안 됨.",
    });
  }

  // 5. 일괄 INSERT
  const { error: insertError } = await admin.from("lessons").insert(rows);
  if (insertError) {
    console.error("[seed-full-week] insert error:", insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    inserted: rows.length,
    skipped,
    message: `이번 주 ${rows.length}건의 lesson을 생성했어요 (이미 있던 ${skipped}건은 skip)`,
  });
}

async function authorize(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== ONE_TIME_TOKEN) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "코치로 로그인된 상태에서 호출하세요" }, { status: 401 }),
    };
  }

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") {
    return { error: NextResponse.json({ error: "코치 계정만 호출 가능" }, { status: 403 }) };
  }

  return { userId: user.id };
}

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if (auth.error) return auth.error;
  return runSeed(auth.userId!);
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (auth.error) return auth.error;
  return runSeed(auth.userId!);
}
