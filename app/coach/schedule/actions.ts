"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true; lessonId: number } | { ok: false; error: string };

/**
 * 코치가 자신의 학생에게 레슨을 잡음.
 * 보안: 본인 coach 세션 + 그 학생이 본인 confirmed claim의 학생이어야 함.
 */
export async function bookLesson(
  studentId: string,
  scheduledAt: string,
  durationMinutes: number = 60,
): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  if (!studentId) return { ok: false, error: "수강생을 선택해주세요" };
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "시간이 올바르지 않습니다" };

  const dur = Number.isInteger(durationMinutes) ? durationMinutes : 60;
  if (dur < 10 || dur > 240) return { ok: false, error: "레슨 시간이 올바르지 않습니다" };

  const admin = createAdminClient();

  // 보안 — 이 학생이 본인 confirmed claim에 매칭되는지
  const { data: matchedClaim } = await admin
    .from("student_self_claims")
    .select("id")
    .eq("studentUserId", studentId)
    .eq("matchedCoachUserId", user.id)
    .eq("status", "CONFIRMED")
    .maybeSingle();

  if (!matchedClaim) {
    return { ok: false, error: "수락하지 않은 수강생이에요" };
  }

  // 중복 체크 — 같은 코치가 같은 시각에 다른 레슨이 있으면 거부
  const { data: existing } = await admin
    .from("lessons")
    .select("id")
    .eq("coachId", user.id)
    .eq("scheduledAt", date.toISOString())
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "이 시간에 이미 다른 레슨이 잡혀 있어요" };
  }

  const { data: inserted, error: insertError } = await admin
    .from("lessons")
    .insert({
      coachId: user.id,
      studentId,
      scheduledAt: date.toISOString(),
      durationMinutes: dur,
      status: "CONFIRMED",
      updatedAt: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[bookLesson] insert error:", insertError);
    return { ok: false, error: insertError.message };
  }

  // TODO(Sprint 3): 학생에게 레슨 확정 알림톡 발송

  revalidatePath("/coach/schedule");
  revalidatePath("/");
  return { ok: true, lessonId: inserted!.id };
}

type SimpleResult = { ok: true } | { ok: false; error: string };

/**
 * 레슨 취소 — 본인 코치의 lesson만 status=CANCELLED 처리 (soft delete).
 */
export async function cancelLesson(lessonId: number): Promise<SimpleResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const admin = createAdminClient();

  const { data: lesson } = await admin
    .from("lessons")
    .select("id, coachId, status")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };
  if (lesson.coachId !== user.id) return { ok: false, error: "취소 권한이 없어요" };
  if (lesson.status === "CANCELLED") return { ok: false, error: "이미 취소된 레슨이에요" };

  const { error: updateError } = await admin
    .from("lessons")
    .update({ status: "CANCELLED", updatedAt: new Date().toISOString() })
    .eq("id", lessonId);

  if (updateError) {
    console.error("[cancelLesson] update error:", updateError);
    return { ok: false, error: updateError.message };
  }

  // TODO(Sprint 3): 학생에게 레슨 취소 알림톡

  revalidatePath("/coach/schedule");
  revalidatePath("/");
  return { ok: true };
}
