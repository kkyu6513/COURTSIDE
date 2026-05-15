import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 코치가 phone을 등록한 시점에, 그 번호로 들어와 있는 미매칭 PENDING claim을
 * 자동으로 본인 ID에 연결.
 *
 * 호출 시점:
 * - 신규 코치 가입 시 (phone 인증 통과 직후)
 * - 코치가 phone을 변경했을 때 (마이페이지 - Phase 2)
 *
 * 반환: 업데이트된 claim 개수
 */
export async function rematchClaimsForCoach(
  coachUserId: string,
  phone: string,
): Promise<number> {
  const normalized = phone.replace(/[^\d]/g, "");
  if (!normalized) return 0;

  const admin = createAdminClient();

  const { data: claims, error: fetchError } = await admin
    .from("student_self_claims")
    .select("id")
    .eq("claimedCoachPhone", normalized)
    .is("matchedCoachUserId", null)
    .eq("status", "PENDING");

  if (fetchError) {
    console.error("[rematchClaimsForCoach] fetch error:", fetchError);
    return 0;
  }
  if (!claims || claims.length === 0) return 0;

  const ids = claims.map((c) => c.id);
  const { error: updateError } = await admin
    .from("student_self_claims")
    .update({ matchedCoachUserId: coachUserId, updatedAt: new Date().toISOString() })
    .in("id", ids);

  if (updateError) {
    console.error("[rematchClaimsForCoach] update error:", updateError);
    return 0;
  }

  // TODO(Sprint 3): 매칭된 학생들에게 "코치가 연결되었어요" 알림톡 발송
  return ids.length;
}
