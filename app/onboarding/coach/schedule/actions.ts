"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ScheduleInput = {
  dayOfWeek: number;
  slotTime: string;
  isRecurring: boolean;
};

const HHMM_RE = /^([0-1]\d|2[0-2]):([0-5]\d)$/;

export async function submitSchedule(
  schedules: ScheduleInput[],
): Promise<{ error?: string } | void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인이 필요합니다" };

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { error: "코치만 등록 가능합니다" };

  if (!Array.isArray(schedules) || schedules.length === 0) {
    return { error: "스케줄을 최소 1개 등록해주세요" };
  }
  if (schedules.length > 7 * 102) {
    return { error: "한 번에 너무 많은 슬롯을 등록할 수 없습니다" };
  }

  // 입력 검증
  for (const s of schedules) {
    if (
      typeof s.dayOfWeek !== "number" ||
      s.dayOfWeek < 0 ||
      s.dayOfWeek > 6
    ) {
      return { error: "요일 값이 올바르지 않습니다" };
    }
    if (!HHMM_RE.test(s.slotTime) || !s.slotTime.endsWith("0")) {
      return { error: "시간 값이 올바르지 않습니다 (10분 단위)" };
    }
  }

  const admin = createAdminClient();

  // 기존 반복 스케줄 삭제 후 새로 INSERT (코치 본인 데이터만)
  const { error: delError } = await admin
    .from("schedules")
    .delete()
    .eq("coachId", user.id)
    .eq("isRecurring", true);

  if (delError) {
    console.error("[submitSchedule] delete error:", delError);
    return { error: "기존 스케줄 정리 중 오류가 발생했습니다" };
  }

  const now = new Date().toISOString();
  const rows = schedules.map((s) => ({
    coachId: user.id,
    dayOfWeek: s.dayOfWeek,
    slotTime: s.slotTime,
    isRecurring: s.isRecurring,
    isBlocked: false,
    updatedAt: now,
  }));

  const { error: insertError } = await admin.from("schedules").insert(rows);

  if (insertError) {
    console.error("[submitSchedule] insert error:", insertError);
    return { error: insertError.message };
  }

  revalidatePath("/");
}
