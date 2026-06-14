"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type InviteResult =
  | {
      ok: true;
      code: string;
      inviteUrl: string;
      shareMessage: string;
      studentName: string;
    }
  | { ok: false; error: string };

const NAME_MAX = 30;
const PHONE_DIGITS_MAX = 11;

/** 6자리 영문 대문자+숫자 (혼동되는 0,O,1,I 제외) */
function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

/**
 * 코치가 수강생 직접 등록 — 초대 코드 발급.
 * 학생이 이 코드로 가입 시 자동 매칭(별도 redeem 액션에서 처리).
 */
export async function createCoachInvite(
  studentName: string,
  studentPhone: string,
): Promise<InviteResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const name = studentName.trim();
  if (!name) return { ok: false, error: "수강생 이름을 입력해 주세요" };
  if (name.length > NAME_MAX) return { ok: false, error: `이름은 ${NAME_MAX}자 이내로 입력해 주세요` };

  const phoneDigits = studentPhone.replace(/[^\d]/g, "");
  if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > PHONE_DIGITS_MAX)) {
    return { ok: false, error: "전화번호는 10~11자리 숫자로 입력해 주세요" };
  }

  const admin = createAdminClient();

  // 충돌 시 최대 5회 재시도 — code unique 제약
  let code = "";
  let inserted = false;
  for (let i = 0; i < 5 && !inserted; i++) {
    code = generateCode();
    const { error } = await admin.from("coach_invites").insert({
      code,
      coachId: user.id,
      studentName: name,
      studentPhone: phoneDigits || null,
      status: "PENDING",
    });
    if (!error) {
      inserted = true;
      break;
    }
    // unique 위반(23505) 아닌 다른 에러는 즉시 실패 노출
    const codeErr = String(error.code || "");
    const msgErr = String(error.message || "");
    if (codeErr !== "23505" && !msgErr.toLowerCase().includes("duplicate")) {
      console.error("[createCoachInvite] insert error:", error);
      return { ok: false, error: `초대 코드 발급 실패: ${msgErr}` };
    }
  }
  if (!inserted) {
    return { ok: false, error: "초대 코드 발급에 실패했어요. 다시 시도해 주세요" };
  }

  // 코치 이름 가져오기 (공유 메시지에 포함)
  const { data: coach } = await admin
    .from("users")
    .select("realName, name")
    .eq("id", user.id)
    .maybeSingle();
  const coachName = coach?.realName || coach?.name || "코치";

  const inviteUrl = `https://courtside-two-silk.vercel.app/invite/${code}`;
  const shareMessage = `안녕하세요, ${name}님!\n${coachName} 코치가 COURTSIDE 레슨 관리에 ${name}님을 초대했어요.\n\n초대 코드: ${code}\n초대 링크: ${inviteUrl}\n\n링크로 가입하시면 코치와 자동으로 연결됩니다.`;

  revalidatePath("/coach/schedule");
  return {
    ok: true,
    code,
    inviteUrl,
    shareMessage,
    studentName: name,
  };
}
