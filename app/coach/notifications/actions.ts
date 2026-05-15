"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };

async function resolveCoach() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다", user: null };
  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { error: "코치만 처리할 수 있어요", user: null };
  return { error: null, user };
}

async function updateClaimStatus(claimId: number, nextStatus: "CONFIRMED" | "REJECTED"): Promise<Result> {
  const { user, error } = await resolveCoach();
  if (error || !user) return { ok: false, error: error || "권한 없음" };

  const admin = createAdminClient();

  // 본인(코치)에게 매칭된 PENDING 요청만 처리 가능
  const { data: claim, error: fetchError } = await admin
    .from("student_self_claims")
    .select("id, status, matchedCoachUserId")
    .eq("id", claimId)
    .maybeSingle();

  if (fetchError || !claim) {
    return { ok: false, error: "요청을 찾을 수 없어요" };
  }
  if (claim.matchedCoachUserId !== user.id) {
    return { ok: false, error: "처리 권한이 없는 요청이에요" };
  }
  if (claim.status !== "PENDING") {
    return { ok: false, error: "이미 처리된 요청이에요" };
  }

  const { error: updateError } = await admin
    .from("student_self_claims")
    .update({ status: nextStatus, updatedAt: new Date().toISOString() })
    .eq("id", claimId);

  if (updateError) {
    console.error("[coach notifications] update error:", updateError);
    return { ok: false, error: updateError.message };
  }

  // TODO(Sprint 3): 학생에게 결과 알림톡 발송 (수락/거절)
  // - 수락: "○○ 코치님이 회원님의 등록 요청을 수락했습니다"
  // - 거절: 정책 결정 후 발송 또는 미발송

  revalidatePath("/coach/notifications");
  revalidatePath("/");
  return { ok: true };
}

export async function acceptClaim(claimId: number) {
  return updateClaimStatus(claimId, "CONFIRMED");
}

export async function rejectClaim(claimId: number) {
  return updateClaimStatus(claimId, "REJECTED");
}
