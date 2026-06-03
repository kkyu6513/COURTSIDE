"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";

type Result = { ok: true } | { ok: false; error: string };

/**
 * 가능 시간 안내 메시지를 학생에게 인앱 메시지로 발송.
 * coach_messages 테이블에 INSERT — 학생 홈 "코치 메시지" 박스에서 노출됨.
 * 코치 본인의 CONFIRMED 학생만 발송 허용.
 */
export async function sendAvailabilityToStudent(
  studentId: string,
  message: string,
): Promise<Result> {
  if (!studentId) return { ok: false, error: "수강생을 선택해주세요" };
  const trimmed = message.trim();
  if (!trimmed) return { ok: false, error: "메시지가 비어있어요" };
  if (trimmed.length > 1000) {
    return { ok: false, error: "메시지는 1000자 이내로 작성해주세요" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const admin = createAdminClient();

  // 학생이 본인 confirmed claim 인지 검증
  const { data: matched } = await admin
    .from("student_self_claims")
    .select("id")
    .eq("studentUserId", studentId)
    .eq("matchedCoachUserId", user.id)
    .eq("status", "CONFIRMED")
    .maybeSingle();
  if (!matched) return { ok: false, error: "수락하지 않은 수강생이에요" };

  // 인앱 메시지 INSERT
  const { error: insertError } = await admin.from("coach_messages").insert({
    coachId: user.id,
    studentId,
    content: trimmed,
    kind: "AVAILABILITY",
  });

  if (insertError) {
    console.error("[sendAvailabilityToStudent] insert error:", insertError);
    return { ok: false, error: "메시지 전송 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요." };
  }

  // 학생 푸시 구독에 푸시 알림 발송 (best-effort — 실패해도 메시지 자체는 성공)
  void (async () => {
    try {
      // 코치 이름 조회 (알림 제목)
      const { data: coach } = await admin
        .from("users")
        .select("realName, name")
        .eq("id", user.id)
        .maybeSingle();
      const coachName = (coach?.realName as string | null) || (coach?.name as string | null) || "코치";

      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("userId", studentId);
      const subscriptions = (subs ?? []) as Array<{ id: number; endpoint: string; p256dh: string; auth: string }>;

      const preview = trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed;
      const deadEndpoints: string[] = [];
      await Promise.all(
        subscriptions.map(async (s) => {
          const res = await sendPush(
            { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
            {
              title: `${coachName} 코치 메시지`,
              body: preview,
              url: "/",
              tag: `coach-msg-${user.id}`,
            },
          );
          if (!res.ok && "gone" in res && res.gone) {
            deadEndpoints.push(s.endpoint);
          }
        }),
      );
      // 만료된 구독 정리
      if (deadEndpoints.length > 0) {
        await admin.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
      }
    } catch (e) {
      console.warn("[sendAvailabilityToStudent] push best-effort failed:", e);
    }
  })();

  // 학생 홈에서 즉시 노출되도록 revalidate
  revalidatePath("/");

  return { ok: true };
}
