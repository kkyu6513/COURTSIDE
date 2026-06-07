"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true; messageId?: number } | { ok: false; error: string };

const CONTENT_MAX = 2000;

async function getAuthed() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role = (user.app_metadata as { role?: string } | undefined)?.role;
  if (role !== "COACH" && role !== "STUDENT") return null;
  return { user, role: role as "COACH" | "STUDENT" };
}

/**
 * 본인이 상대방과 매칭된 적이 있는지 검증 (보낼 권한 확인).
 * - 코치: student_self_claims 의 CONFIRMED 학생만 허용
 * - 학생: 본인 matched coach 만 허용
 */
async function verifyPair(
  viewer: { user: { id: string }; role: "COACH" | "STUDENT" },
  partnerId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const coachId = viewer.role === "COACH" ? viewer.user.id : partnerId;
  const studentId = viewer.role === "COACH" ? partnerId : viewer.user.id;
  const { data } = await admin
    .from("student_self_claims")
    .select("id")
    .eq("studentUserId", studentId)
    .eq("matchedCoachUserId", coachId)
    .eq("status", "CONFIRMED")
    .maybeSingle();
  return !!data;
}

/**
 * 메시지 전송 — 양방향 (코치 ↔ 학생).
 */
export async function sendMessage(partnerId: string, content: string): Promise<Result> {
  const viewer = await getAuthed();
  if (!viewer) return { ok: false, error: "로그인이 필요합니다" };

  const trimmed = content.trim();
  if (!trimmed) return { ok: false, error: "내용을 입력해주세요" };
  if (trimmed.length > CONTENT_MAX) {
    return { ok: false, error: `메시지는 ${CONTENT_MAX}자 이내로 작성해주세요` };
  }
  if (!partnerId) return { ok: false, error: "대화 상대가 올바르지 않습니다" };

  const allowed = await verifyPair(viewer, partnerId);
  if (!allowed) return { ok: false, error: "이 상대와는 대화할 수 없어요" };

  const admin = createAdminClient();
  const coachId = viewer.role === "COACH" ? viewer.user.id : partnerId;
  const studentId = viewer.role === "COACH" ? partnerId : viewer.user.id;

  const { data: inserted, error } = await admin
    .from("coach_messages")
    .insert({
      coachId,
      studentId,
      senderRole: viewer.role,
      senderId: viewer.user.id,
      content: trimmed,
      kind: "DIRECT",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[sendMessage] insert error:", error);
    return { ok: false, error: "메시지 전송 중 문제가 발생했어요" };
  }

  revalidatePath("/chat");
  revalidatePath(`/chat/${partnerId}`);
  revalidatePath("/");
  return { ok: true, messageId: inserted!.id };
}

/**
 * 본인에게 온 미읽음 메시지를 읽음 처리.
 * - 본인 role 과 senderRole 이 다른 메시지만 갱신
 */
export async function markMessagesRead(partnerId: string): Promise<Result> {
  const viewer = await getAuthed();
  if (!viewer) return { ok: false, error: "로그인이 필요합니다" };
  if (!partnerId) return { ok: false, error: "대화 상대가 올바르지 않습니다" };

  const admin = createAdminClient();
  const coachId = viewer.role === "COACH" ? viewer.user.id : partnerId;
  const studentId = viewer.role === "COACH" ? partnerId : viewer.user.id;
  // 상대방이 보낸 (=내 role 이 아닌) 미읽음 메시지만 갱신
  const oppositeRole = viewer.role === "COACH" ? "STUDENT" : "COACH";

  const { error } = await admin
    .from("coach_messages")
    .update({ readAt: new Date().toISOString() })
    .eq("coachId", coachId)
    .eq("studentId", studentId)
    .eq("senderRole", oppositeRole)
    .is("readAt", null);

  if (error) {
    console.error("[markMessagesRead] error:", error);
    return { ok: false, error: "읽음 처리 중 문제가 발생했어요" };
  }

  revalidatePath("/chat");
  revalidatePath(`/chat/${partnerId}`);
  return { ok: true };
}
