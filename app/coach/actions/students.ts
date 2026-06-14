"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

type RegisterResult =
  | { ok: true; studentId: string; isPlaceholder: boolean; inviteMessage: string }
  | { ok: false; error: string };

/**
 * 코치가 학생을 직접 등록.
 * - 기존 user(phone 일치) 있으면 매칭만
 * - 없으면 placeholder user 생성 (학생이 같은 phone으로 가입 시 자동 연결)
 *
 * 반환에 inviteMessage 포함 — 코치가 카톡/문자로 학생에게 공유할 안내 텍스트.
 */
export async function registerStudentDirectly(input: {
  name: string;
  phone: string;
  memo?: string;
}): Promise<RegisterResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const name = input.name.trim();
  const phone = input.phone.replace(/[^\d]/g, "");
  if (!name) return { ok: false, error: "이름을 입력해주세요" };
  if (!/^\d{10,11}$/.test(phone)) {
    return { ok: false, error: "전화번호는 숫자 10~11자리 (- 없이)" };
  }

  const admin = createAdminClient();

  // 0. 코치 본인 정보 조회 — claim의 claimedCoachPhone 등 NOT NULL 컬럼용
  const { data: coach } = await admin
    .from("users")
    .select("id, realName, name, phone")
    .eq("id", user.id)
    .maybeSingle();
  const coachName = coach?.realName || coach?.name || "코치";
  const coachPhone = coach?.phone || "00000000000";

  // 1. 기존 학생 조회 (전화번호 기준)
  const { data: existing } = await admin
    .from("users")
    .select("id, realName, name")
    .eq("phone", phone)
    .maybeSingle();

  let studentId: string;
  let isPlaceholder = false;
  if (existing) {
    studentId = existing.id;
    if (!existing.realName && !existing.name) {
      await admin.from("users").update({ realName: name }).eq("id", studentId);
    }
  } else {
    // placeholder 학생 — User 스키마 NOT NULL: id, email
    studentId = randomUUID();
    const placeholderEmail = `placeholder_${phone}_${Date.now()}@courtside.local`;
    const { error: insertUserError } = await admin.from("users").insert({
      id: studentId,
      email: placeholderEmail,
      phone,
      realName: name,
      role: "STUDENT",
    });
    if (insertUserError) {
      console.error("[registerStudentDirectly] insert user error:", insertUserError);
      return {
        ok: false,
        error: `학생 등록 실패 (${insertUserError.message || "DB 오류"})`,
      };
    }
    isPlaceholder = true;
  }

  // 2. claim 중복 확인 → 없으면 생성, 있으면 CONFIRMED로 갱신
  const { data: claim } = await admin
    .from("student_self_claims")
    .select("id, status")
    .eq("studentUserId", studentId)
    .eq("matchedCoachUserId", user.id)
    .maybeSingle();

  if (claim) {
    if (claim.status !== "CONFIRMED") {
      await admin
        .from("student_self_claims")
        .update({
          status: "CONFIRMED",
          updatedAt: new Date().toISOString(),
        })
        .eq("id", claim.id);
    }
  } else {
    // claimedCoachName / claimedCoachPhone 은 NOT NULL — 코치 직접 등록이라 코치 본인 정보로
    const { error: claimError } = await admin.from("student_self_claims").insert({
      studentUserId: studentId,
      claimedCoachName: coachName,
      claimedCoachPhone: coachPhone,
      matchedCoachUserId: user.id,
      status: "CONFIRMED",
      notifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (claimError) {
      console.error("[registerStudentDirectly] insert claim error:", claimError);
      return {
        ok: false,
        error: `매칭 실패 (${claimError.message || "DB 오류"})`,
      };
    }
  }

  // 3. 학생에게 공유할 초대 메시지 (코치가 카톡/문자로 직접 전달)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://courtside.app";
  const inviteMessage = [
    `[COURTSIDE]`,
    ``,
    `${name}님, ${coachName} 코치가 회원님을 수강생으로 등록했어요.`,
    ``,
    `▶ 아래 링크에서 같은 전화번호(${phone.slice(0, 3)}-****-${phone.slice(-4)})로 가입하시면 자동 연결됩니다.`,
    baseUrl,
  ].join("\n");

  revalidatePath("/");
  revalidatePath("/coach/schedule");
  return { ok: true, studentId, isPlaceholder, inviteMessage };
}
