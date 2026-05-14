"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms, buildStudentClaimMessage } from "@/lib/notification";

type Result =
  | { ok: true; matched: boolean; notified: boolean }
  | { ok: false; error: string };

export async function requestCoachLink(formData: FormData): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "STUDENT") return { ok: false, error: "학생만 신청할 수 있습니다" };

  const coachName = formData.get("coachName")?.toString()?.trim();
  const coachPhoneRaw = formData.get("coachPhone")?.toString()?.trim();
  const coachPhone = coachPhoneRaw?.replace(/[^\d]/g, "");

  if (!coachName) return { ok: false, error: "코치 이름을 입력해주세요" };
  if (!coachPhone || coachPhone.length < 10 || coachPhone.length > 11) {
    return { ok: false, error: "코치 전화번호는 10~11자리 숫자로 입력해주세요" };
  }

  const admin = createAdminClient();

  const { data: candidates } = await admin
    .from("users")
    .select("id, name, phone, role")
    .eq("phone", coachPhone)
    .eq("role", "COACH");

  const matched = candidates?.[0];

  const { data: existing } = await admin
    .from("student_self_claims")
    .select("id, status")
    .eq("studentUserId", user.id)
    .eq("claimedCoachPhone", coachPhone)
    .maybeSingle();

  const now = new Date().toISOString();
  let claimId: number | undefined = existing?.id;

  if (existing) {
    await admin
      .from("student_self_claims")
      .update({
        claimedCoachName: coachName,
        matchedCoachUserId: matched?.id ?? null,
        status: "PENDING",
        updatedAt: now,
      })
      .eq("id", existing.id);
  } else {
    const { data: inserted, error: insertError } = await admin
      .from("student_self_claims")
      .insert({
        studentUserId: user.id,
        claimedCoachName: coachName,
        claimedCoachPhone: coachPhone,
        matchedCoachUserId: matched?.id ?? null,
        status: "PENDING",
        updatedAt: now,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[requestCoachLink] insert error:", insertError);
      return { ok: false, error: insertError.message };
    }
    claimId = inserted?.id;
  }

  let notified = false;
  if (matched && claimId) {
    const studentName =
      (user.user_metadata?.nickname as string | undefined) ||
      user.email ||
      "신규 학생";

    const res = await sendSms(coachPhone, buildStudentClaimMessage(studentName));
    const update: Record<string, unknown> = {
      notifyAttempts: 1,
      updatedAt: new Date().toISOString(),
    };
    if (res.ok) {
      update.notifiedAt = new Date().toISOString();
      notified = true;
    } else if ("error" in res) {
      update.notifyLastError = res.error;
    } else if (res.skipped) {
      update.notifyLastError = `SKIPPED: ${res.reason}`;
    }
    await admin.from("student_self_claims").update(update).eq("id", claimId);
  }

  revalidatePath("/");
  return { ok: true, matched: !!matched, notified };
}
