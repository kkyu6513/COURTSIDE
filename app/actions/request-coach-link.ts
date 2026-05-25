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
  if (!user) return { ok: false, error: "로그인이 필요해요" };

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "STUDENT") return { ok: false, error: "학생만 신청할 수 있어요" };

  const coachName = formData.get("coachName")?.toString()?.trim();
  const coachPhoneRaw = formData.get("coachPhone")?.toString()?.trim();
  const coachPhone = coachPhoneRaw?.replace(/[^\d]/g, "");

  if (!coachName) return { ok: false, error: "코치 이름을 입력해주세요" };
  if (!coachPhone || coachPhone.length < 10 || coachPhone.length > 11) {
    return { ok: false, error: "코치 전화번호는 10~11자리 숫자로 입력해주세요" };
  }

  const admin = createAdminClient();

  // 본인 인증 확인 — 학생 본인 전화번호 등록 여부 (온보딩 SMS 인증 완료 검증)
  const { data: selfRow } = await admin
    .from("users")
    .select("phone")
    .eq("id", user.id)
    .maybeSingle();
  if (!selfRow?.phone) {
    return { ok: false, error: "본인 전화번호 인증을 먼저 완료해주세요" };
  }

  // Rate limit — 10분 내 3건 초과 신청 차단 (스팸 방지)
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recent } = await admin
    .from("student_self_claims")
    .select("id", { count: "exact", head: true })
    .eq("studentUserId", user.id)
    .gte("createdAt", since);
  if ((recent ?? 0) >= 3) {
    return {
      ok: false,
      error: "짧은 시간에 신청을 여러 번 보내셨어요. 잠시 후 다시 시도해주세요.",
    };
  }

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

type CancelResult = { ok: true } | { ok: false; error: string };

export async function cancelCoachLink(claimId: number): Promise<CancelResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요" };

  const admin = createAdminClient();
  const { data: claim } = await admin
    .from("student_self_claims")
    .select("id, studentUserId, status")
    .eq("id", claimId)
    .maybeSingle();

  if (!claim) return { ok: false, error: "신청 정보를 찾을 수 없어요" };
  if (claim.studentUserId !== user.id) return { ok: false, error: "본인 신청만 취소할 수 있어요" };
  if (claim.status !== "PENDING") return { ok: false, error: "이미 처리된 신청이에요" };

  const { error } = await admin
    .from("student_self_claims")
    .update({ status: "CANCELLED", updatedAt: new Date().toISOString() })
    .eq("id", claimId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true };
}
