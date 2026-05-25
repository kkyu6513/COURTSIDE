"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true; lessonId: number } | { ok: false; error: string };

/**
 * 코치가 자신의 학생에게 레슨을 잡음.
 * 보안: 본인 coach 세션 + 그 학생이 본인 confirmed claim의 학생이어야 함.
 */
export async function bookLesson(
  studentId: string,
  scheduledAt: string,
  durationMinutes: number = 60,
): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  if (!studentId) return { ok: false, error: "수강생을 선택해주세요" };
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "시간이 올바르지 않습니다" };

  // 과거 시각 거부 (#4) — 자정 단위가 아니라 정확한 시각 비교.
  // 다만 클라이언트 시간 오차/네트워크 지연을 감안해 5분 유예 허용.
  const PAST_GRACE_MS = 5 * 60 * 1000;
  if (date.getTime() < Date.now() - PAST_GRACE_MS) {
    return { ok: false, error: "이미 지난 시각에는 레슨을 잡을 수 없어요" };
  }

  const dur = Number.isInteger(durationMinutes) ? durationMinutes : 60;
  if (dur < 10 || dur > 240) return { ok: false, error: "레슨 시간이 올바르지 않습니다" };

  const admin = createAdminClient();

  // 보안 — 이 학생이 본인 confirmed claim에 매칭되는지
  const { data: matchedClaim } = await admin
    .from("student_self_claims")
    .select("id")
    .eq("studentUserId", studentId)
    .eq("matchedCoachUserId", user.id)
    .eq("status", "CONFIRMED")
    .maybeSingle();

  if (!matchedClaim) {
    return { ok: false, error: "수락하지 않은 수강생이에요" };
  }

  // 시간 겹침 체크 — 새 lesson의 [start, end] 구간이 기존 active lesson과 겹치면 거부
  const newStart = date.getTime();
  const newEnd = newStart + dur * 60 * 1000;
  // 충돌 검색 윈도우 (#5) — 최대 레슨 길이(240분=4h) + 안전 마진을 고려.
  // ±24h 고정이면 240분 레슨이 양 끝에 있을 때 사이 시간 충돌 검출 실패 가능.
  const SAFETY_WINDOW_MS = (4 + 24) * 60 * 60 * 1000; // ±28h
  const windowStart = new Date(newStart - SAFETY_WINDOW_MS).toISOString();
  const windowEnd = new Date(newEnd + SAFETY_WINDOW_MS).toISOString();

  // 충돌 검증 — 슬롯 점유 해제 상태(CANCELLED/COMPLETED/ABSENT)는 제외.
  // 같은 시간에 보강·재등록이 가능해야 하므로 끝난 회차는 점유로 보지 않음.
  const { data: nearby } = await admin
    .from("lessons")
    .select("id, scheduledAt, durationMinutes, status")
    .eq("coachId", user.id)
    .not("status", "in", "(CANCELLED,COMPLETED,ABSENT)")
    .gte("scheduledAt", windowStart)
    .lte("scheduledAt", windowEnd);

  for (const ex of nearby ?? []) {
    const exStart = new Date(ex.scheduledAt).getTime();
    const exEnd = exStart + (ex.durationMinutes ?? 60) * 60 * 1000;
    // overlap: newStart < exEnd && newEnd > exStart
    if (newStart < exEnd && newEnd > exStart) {
      const exKst = new Date(exStart + 9 * 60 * 60 * 1000);
      const hh = String(exKst.getUTCHours()).padStart(2, "0");
      const mm = String(exKst.getUTCMinutes()).padStart(2, "0");
      const endKst = new Date(exEnd + 9 * 60 * 60 * 1000);
      const eh = String(endKst.getUTCHours()).padStart(2, "0");
      const em = String(endKst.getUTCMinutes()).padStart(2, "0");
      return {
        ok: false,
        error: `${hh}:${mm} ~ ${eh}:${em} 시간대에 이미 잡힌 레슨이 있어요`,
      };
    }
  }

  const { data: inserted, error: insertError } = await admin
    .from("lessons")
    .insert({
      coachId: user.id,
      studentId,
      scheduledAt: date.toISOString(),
      durationMinutes: dur,
      status: "CONFIRMED",
      updatedAt: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[bookLesson] insert error:", insertError);
    return { ok: false, error: "레슨 등록 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요." };
  }

  // TODO(Sprint 3): 학생에게 레슨 확정 알림톡 발송

  revalidatePath("/coach/schedule");
  revalidatePath("/");
  return { ok: true, lessonId: inserted!.id };
}

type SimpleResult = { ok: true } | { ok: false; error: string };

/**
 * 레슨 취소 — 본인 코치의 lesson만 status=CANCELLED 처리 (soft delete).
 */
export async function cancelLesson(lessonId: number): Promise<SimpleResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const admin = createAdminClient();

  const { data: lesson } = await admin
    .from("lessons")
    .select("id, coachId, status")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };
  if (lesson.coachId !== user.id) return { ok: false, error: "취소 권한이 없어요" };
  if (lesson.status === "CANCELLED") return { ok: false, error: "이미 취소된 레슨이에요" };

  const { error: updateError } = await admin
    .from("lessons")
    .update({ status: "CANCELLED", updatedAt: new Date().toISOString() })
    .eq("id", lessonId);

  if (updateError) {
    console.error("[cancelLesson] update error:", updateError);
    return { ok: false, error: "레슨 취소 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요." };
  }

  // TODO(Sprint 3): 학생에게 레슨 취소 알림톡

  revalidatePath("/coach/schedule");
  revalidatePath("/");
  return { ok: true };
}

/**
 * 레슨 상태 전이 공통 헬퍼 — 본인 코치의 lesson만 (fromStatuses) → toStatus.
 */
async function transitionLessonStatus(
  lessonId: number,
  fromStatuses: string[],
  toStatus: string,
): Promise<SimpleResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const admin = createAdminClient();

  const { data: lesson } = await admin
    .from("lessons")
    .select("id, coachId, status")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };
  if (lesson.coachId !== user.id) return { ok: false, error: "변경 권한이 없어요" };
  if (!fromStatuses.includes(lesson.status)) {
    return {
      ok: false,
      error: `현재 상태(${lesson.status})에서는 이 작업을 할 수 없어요`,
    };
  }

  const { error: updateError } = await admin
    .from("lessons")
    .update({ status: toStatus, updatedAt: new Date().toISOString() })
    .eq("id", lessonId);

  if (updateError) {
    console.error("[transitionLessonStatus] update error:", updateError);
    return { ok: false, error: "상태 변경 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/coach/schedule");
  revalidatePath("/");
  return { ok: true };
}

/** 레슨 완료 처리 — CONFIRMED/IN_PROGRESS → COMPLETED */
export async function markLessonCompleted(lessonId: number): Promise<SimpleResult> {
  return transitionLessonStatus(lessonId, ["CONFIRMED", "IN_PROGRESS"], "COMPLETED");
}

/** 결강 처리 — CONFIRMED/IN_PROGRESS → ABSENT */
export async function markLessonAbsent(lessonId: number): Promise<SimpleResult> {
  return transitionLessonStatus(lessonId, ["CONFIRMED", "IN_PROGRESS"], "ABSENT");
}

/**
 * 취소된 레슨 복구 — CANCELLED → CONFIRMED.
 * 동일 시간에 새 active 레슨이 이미 있으면 실패(충돌).
 */
export async function restoreLesson(lessonId: number): Promise<SimpleResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const admin = createAdminClient();

  const { data: lesson } = await admin
    .from("lessons")
    .select("id, coachId, status, scheduledAt, durationMinutes")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };
  if (lesson.coachId !== user.id) return { ok: false, error: "복구 권한이 없어요" };
  if (lesson.status !== "CANCELLED") return { ok: false, error: "취소된 레슨만 복구할 수 있어요" };

  // 동일 시간 충돌 검증 (다른 active 레슨이 그 자리를 차지했는지)
  const start = new Date(lesson.scheduledAt).getTime();
  const end = start + lesson.durationMinutes * 60 * 1000;
  // 충돌 검색 윈도우 (#5) — 최대 레슨 길이(240분) + 안전 마진
  const SAFETY_WINDOW_MS = (4 + 24) * 60 * 60 * 1000; // ±28h
  const windowStart = new Date(start - SAFETY_WINDOW_MS).toISOString();
  const windowEnd = new Date(end + SAFETY_WINDOW_MS).toISOString();
  const { data: nearby } = await admin
    .from("lessons")
    .select("id, scheduledAt, durationMinutes")
    .eq("coachId", user.id)
    .neq("id", lessonId)
    .not("status", "in", "(CANCELLED,COMPLETED,ABSENT)")
    .gte("scheduledAt", windowStart)
    .lte("scheduledAt", windowEnd);
  for (const ex of nearby ?? []) {
    const exStart = new Date(ex.scheduledAt).getTime();
    const exEnd = exStart + (ex.durationMinutes ?? 60) * 60 * 1000;
    if (start < exEnd && end > exStart) {
      return { ok: false, error: "그 시간에 이미 다른 레슨이 잡혀있어요" };
    }
  }

  const { error: updateError } = await admin
    .from("lessons")
    .update({ status: "CONFIRMED", updatedAt: new Date().toISOString() })
    .eq("id", lessonId);

  if (updateError) {
    console.error("[restoreLesson] update error:", updateError);
    return { ok: false, error: "레슨 복구 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/coach/schedule");
  revalidatePath("/");
  return { ok: true };
}

/**
 * 코치 메모(notes) 수정 — 본인 코치의 lesson만.
 */
export async function updateLessonNotes(lessonId: number, notes: string): Promise<SimpleResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const trimmed = notes.trim();
  if (trimmed.length > 1000) {
    return { ok: false, error: "코멘트는 1000자 이내로 작성해주세요" };
  }

  const admin = createAdminClient();

  const { data: lesson } = await admin
    .from("lessons")
    .select("id, coachId")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };
  if (lesson.coachId !== user.id) return { ok: false, error: "수정 권한이 없어요" };

  const { error: updateError } = await admin
    .from("lessons")
    .update({ notes: trimmed || null, updatedAt: new Date().toISOString() })
    .eq("id", lessonId);

  if (updateError) {
    console.error("[updateLessonNotes] error:", updateError);
    return { ok: false, error: "메모 저장 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/coach/schedule");
  return { ok: true };
}
