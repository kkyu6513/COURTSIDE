"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

type Result = { ok: true; studentId: string } | { ok: false; error: string };

/**
 * 코치가 학생을 직접 등록.
 * - 이름 + 전화번호 입력
 * - 전화번호로 기존 학생 조회 → 있으면 CONFIRMED claim 생성/갱신
 * - 없으면 placeholder user 생성 + CONFIRMED claim (학생이 나중에 가입 시 자동 매칭)
 */
export async function registerStudentDirectly(input: {
  name: string;
  phone: string;
  memo?: string;
}): Promise<Result> {
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

  // 1. 기존 학생 조회 (전화번호 기준)
  const { data: existing } = await admin
    .from("users")
    .select("id, realName, name")
    .eq("phone", phone)
    .maybeSingle();

  let studentId: string;
  if (existing) {
    studentId = existing.id;
    // 이름이 비어있으면 갱신
    if (!existing.realName && !existing.name) {
      await admin.from("users").update({ realName: name }).eq("id", studentId);
    }
  } else {
    // placeholder 학생 생성 — 학생이 나중에 가입 시 phone 매칭으로 연결
    studentId = randomUUID();
    const { error: insertUserError } = await admin.from("users").insert({
      id: studentId,
      phone,
      realName: name,
      role: "STUDENT",
    });
    if (insertUserError) {
      console.error("[registerStudentDirectly] insert user error:", insertUserError);
      return { ok: false, error: "학생 등록 중 문제가 발생했어요." };
    }
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
          claimedCoachName: name,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", claim.id);
    }
  } else {
    const { error: claimError } = await admin.from("student_self_claims").insert({
      studentUserId: studentId,
      matchedCoachUserId: user.id,
      claimedCoachName: name,
      status: "CONFIRMED",
      notifiedAt: new Date().toISOString(),
    });
    if (claimError) {
      console.error("[registerStudentDirectly] insert claim error:", claimError);
      return { ok: false, error: "학생 매칭 중 문제가 발생했어요." };
    }
  }

  revalidatePath("/");
  revalidatePath("/coach/schedule");
  return { ok: true, studentId };
}
