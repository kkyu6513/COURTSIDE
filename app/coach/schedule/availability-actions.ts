"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/notification";

type Result = { ok: true; skipped?: boolean } | { ok: false; error: string };

/**
 * 가능 시간 안내 메시지를 학생에게 SMS로 발송.
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

  // 학생 phone 조회
  const { data: student } = await admin
    .from("users")
    .select("phone, realName, name")
    .eq("id", studentId)
    .maybeSingle();
  if (!student?.phone) {
    return { ok: false, error: "수강생 전화번호가 등록되어 있지 않아요" };
  }

  // SMS 발송 — Solapi env 없으면 console.log + skipped
  const result = await sendSms(student.phone, trimmed);
  if (result.ok) {
    return { ok: true };
  }
  if (result.skipped) {
    // ENV 미설정 — 운영 전 환경에선 성공으로 간주하되 skip 표시
    return { ok: true, skipped: true };
  }
  return { ok: false, error: result.error || "메시지 발송 실패" };
}
