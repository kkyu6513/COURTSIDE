"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED = new Set(["06:00", "07:00", "08:00", "09:00", "OFF"]);

/**
 * FR-16a 오늘의 코트사이드 푸시 시간 저장
 * - User.dailyPushTime: "HH:mm" or null(OFF)
 */
export async function updateDailyPushTime(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const raw = String(formData.get("pushTime") ?? "");
  if (!ALLOWED.has(raw)) {
    throw new Error("INVALID_PUSH_TIME");
  }

  const admin = createAdminClient();
  await admin
    .from("users")
    .update({ dailyPushTime: raw === "OFF" ? null : raw })
    .eq("id", user.id);

  revalidatePath("/my/courtside");
}
