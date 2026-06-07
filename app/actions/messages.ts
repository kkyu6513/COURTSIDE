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

  // 1차 시도 — senderRole/senderId 포함 (양방향 컬럼 마이그레이션 완료된 경우)
  let inserted: { id: number } | null = null;
  let lastError: { message?: string; code?: string } | null = null;

  const r1 = await admin
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

  if (!r1.error) {
    inserted = r1.data;
  } else {
    lastError = r1.error;
    const msg = String(r1.error.message || "").toLowerCase();
    // senderRole/senderId 컬럼 미존재 또는 PostgREST 스키마 캐시 미갱신 → 단방향 fallback
    const isMissingCol =
      msg.includes("senderrole") ||
      msg.includes("senderid") ||
      msg.includes("could not find the") ||
      msg.includes("schema cache");
    // 학생 발신인데 마이그레이션 안 됐으면 단방향 불가 — 명확히 안내
    if (isMissingCol && viewer.role === "COACH") {
      const r2 = await admin
        .from("coach_messages")
        .insert({ coachId, studentId, content: trimmed, kind: "DIRECT" })
        .select("id")
        .single();
      if (!r2.error) {
        inserted = r2.data;
      } else {
        lastError = r2.error;
      }
    } else if (isMissingCol && viewer.role === "STUDENT") {
      return {
        ok: false,
        error:
          "양방향 메시지 컬럼 마이그레이션이 아직 적용되지 않았어요. (학생 발신은 마이그레이션 완료 후 가능)",
      };
    }
  }

  if (!inserted) {
    console.error("[sendMessage] insert error:", lastError);
    return {
      ok: false,
      error: `메시지 전송 실패: ${lastError?.message ?? "알 수 없는 오류"}`,
    };
  }

  revalidatePath("/chat");
  revalidatePath(`/chat/${partnerId}`);
  revalidatePath("/");
  return { ok: true, messageId: inserted.id };
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
