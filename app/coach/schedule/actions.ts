"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true; action: "added" | "removed" } | { ok: false; error: string };

/**
 * 한 시간 단위 가용 시간 슬롯 토글.
 * 그 시간(HH)에 슬롯이 하나라도 있으면 모두 삭제, 없으면 10분 단위 6개 INSERT.
 *
 * recurring(매주 반복) 슬롯만 다룸.
 */
export async function toggleHourSlot(dayOfWeek: number, hour: number): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { ok: false, error: "요일 값이 올바르지 않습니다" };
  }
  if (!Number.isInteger(hour) || hour < 6 || hour > 22) {
    return { ok: false, error: "시간 값이 올바르지 않습니다" };
  }

  const admin = createAdminClient();
  const hh = String(hour).padStart(2, "0");

  const { data: existing, error: fetchError } = await admin
    .from("schedules")
    .select("id")
    .eq("coachId", user.id)
    .eq("dayOfWeek", dayOfWeek)
    .eq("isRecurring", true)
    .like("slotTime", `${hh}:%`);

  if (fetchError) {
    console.error("[toggleHourSlot] fetch error:", fetchError);
    return { ok: false, error: fetchError.message };
  }

  if (existing && existing.length > 0) {
    const { error: delError } = await admin
      .from("schedules")
      .delete()
      .in(
        "id",
        existing.map((s) => s.id),
      );
    if (delError) {
      console.error("[toggleHourSlot] delete error:", delError);
      return { ok: false, error: delError.message };
    }
    revalidatePath("/coach/schedule");
    revalidatePath("/");
    return { ok: true, action: "removed" };
  }

  const now = new Date().toISOString();
  const rows: Array<{
    coachId: string;
    dayOfWeek: number;
    slotTime: string;
    isRecurring: boolean;
    isBlocked: boolean;
    updatedAt: string;
  }> = [];
  for (let m = 0; m < 60; m += 10) {
    const mm = String(m).padStart(2, "0");
    rows.push({
      coachId: user.id,
      dayOfWeek,
      slotTime: `${hh}:${mm}`,
      isRecurring: true,
      isBlocked: false,
      updatedAt: now,
    });
  }

  const { error: insertError } = await admin.from("schedules").insert(rows);
  if (insertError) {
    console.error("[toggleHourSlot] insert error:", insertError);
    return { ok: false, error: insertError.message };
  }

  revalidatePath("/coach/schedule");
  revalidatePath("/");
  return { ok: true, action: "added" };
}
