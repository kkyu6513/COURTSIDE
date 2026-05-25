"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 과거 시각 유예 — 클라이언트/서버 시계 편차 + 네트워크 지연 흡수.
// 클라이언트(weekly-timetable.tsx onCellClick)와 동일 값 사용.
const PAST_GRACE_MS = 5 * 60 * 1000;

// 충돌 검색 범위 — 최대 레슨 길이(4h) × 2 + 자정 경계 마진.
// gte/lte로 scheduledAt 범위만 좁히기 위함이지, 실제 충돌 판정은 항상 [start,end] 교차로 한다.
const CONFLICT_SEARCH_WINDOW_MS = (4 + 24) * 60 * 60 * 1000;

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

  // 시간 겹침 체크 — 새 lesson의 [start, end] 구간이 기존 active lesson과 겹치면 거부.
  // 참고: 검증 → insert 사이에 race condition이 존재합니다. 같은 코치 세션 2 탭에서
  // 동시 등록 시 두 건 모두 통과될 수 있어, 완전 차단은 DB unique partial index(또는
  // SERIALIZABLE 트랜잭션 RPC)가 필요합니다. 일반 사용 시나리오(한 코치 = 한 세션)에서는
  // 발생 확률이 낮아 후속 작업으로 미룹니다.
  const newStart = date.getTime();
  const newEnd = newStart + dur * 60 * 1000;
  const windowStart = new Date(newStart - CONFLICT_SEARCH_WINDOW_MS).toISOString();
  const windowEnd = new Date(newEnd + CONFLICT_SEARCH_WINDOW_MS).toISOString();

  // 슬롯 점유 해제 상태(CANCELLED/COMPLETED/ABSENT)는 제외 — 보강·재등록 허용.
  const { data: nearby } = await admin
    .from("lessons")
    .select("id, studentId, scheduledAt, durationMinutes, status")
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
      // 충돌 학생 이름 조회 (#32) — 어떤 레슨이 막고 있는지 명시
      let conflictStudentName = "";
      if (ex.studentId) {
        const { data: u } = await admin
          .from("users")
          .select("realName, name")
          .eq("id", ex.studentId)
          .maybeSingle();
        conflictStudentName = u?.realName || u?.name || "";
      }
      const studentLabel = conflictStudentName ? ` (${conflictStudentName} 학생)` : "";
      return {
        ok: false,
        error: `${hh}:${mm} ~ ${eh}:${em} 시간대에 이미 잡힌 레슨이 있어요${studentLabel}`,
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
      // 신규 레슨은 항상 미결제로 시작 — 코치 결제 확인 또는 결제 모듈로 PAID 전환
      paymentStatus: "UNPAID",
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

type RecurringResult =
  | { ok: true; bookedCount: number; skippedWeeks: Array<{ week: number; reason: string }> }
  | { ok: false; error: string };

/**
 * 정기 레슨 일괄 등록 (#19) — baseScheduledAt 기준 매 주 같은 요일·시간으로 weekCount 회 반복.
 * 충돌이 있는 주는 skip 하고 결과 리포트로 알림. 0건 등록 시 전체 실패로 처리.
 */
export async function bookRecurringLessons(
  studentId: string,
  baseScheduledAt: string,
  durationMinutes: number,
  weekCount: number,
): Promise<RecurringResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  if (!studentId) return { ok: false, error: "수강생을 선택해주세요" };
  if (!Number.isInteger(weekCount) || weekCount < 1 || weekCount > 24) {
    return { ok: false, error: "반복 주 수는 1~24 사이여야 해요" };
  }
  const dur = Number.isInteger(durationMinutes) ? durationMinutes : 60;
  if (dur < 10 || dur > 240) return { ok: false, error: "레슨 시간이 올바르지 않습니다" };

  const baseDate = new Date(baseScheduledAt);
  if (Number.isNaN(baseDate.getTime())) return { ok: false, error: "시간이 올바르지 않습니다" };

  const admin = createAdminClient();

  // 학생 매칭 검증 (bookLesson 과 동일)
  const { data: matchedClaim } = await admin
    .from("student_self_claims")
    .select("id")
    .eq("studentUserId", studentId)
    .eq("matchedCoachUserId", user.id)
    .eq("status", "CONFIRMED")
    .maybeSingle();
  if (!matchedClaim) return { ok: false, error: "수락하지 않은 수강생이에요" };

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  let bookedCount = 0;
  const skippedWeeks: Array<{ week: number; reason: string }> = [];

  for (let w = 0; w < weekCount; w++) {
    const startMs = baseDate.getTime() + w * WEEK_MS;
    const endMs = startMs + dur * 60 * 1000;

    if (startMs < Date.now() - PAST_GRACE_MS) {
      skippedWeeks.push({ week: w + 1, reason: "이미 지난 시각" });
      continue;
    }

    // 충돌 검증
    const wStart = new Date(startMs - CONFLICT_SEARCH_WINDOW_MS).toISOString();
    const wEnd = new Date(endMs + CONFLICT_SEARCH_WINDOW_MS).toISOString();
    const { data: nearby } = await admin
      .from("lessons")
      .select("scheduledAt, durationMinutes, status")
      .eq("coachId", user.id)
      .not("status", "in", "(CANCELLED,COMPLETED,ABSENT)")
      .gte("scheduledAt", wStart)
      .lte("scheduledAt", wEnd);
    let conflict = false;
    for (const ex of nearby ?? []) {
      const exStart = new Date(ex.scheduledAt).getTime();
      const exEnd = exStart + (ex.durationMinutes ?? 60) * 60 * 1000;
      if (startMs < exEnd && endMs > exStart) {
        conflict = true;
        break;
      }
    }
    if (conflict) {
      skippedWeeks.push({ week: w + 1, reason: "이미 잡힌 레슨과 겹침" });
      continue;
    }

    const { error: insertError } = await admin.from("lessons").insert({
      coachId: user.id,
      studentId,
      scheduledAt: new Date(startMs).toISOString(),
      durationMinutes: dur,
      status: "CONFIRMED",
      paymentStatus: "UNPAID",
      updatedAt: new Date().toISOString(),
    });
    if (insertError) {
      console.error("[bookRecurringLessons] insert error:", insertError);
      skippedWeeks.push({ week: w + 1, reason: "등록 중 오류" });
      continue;
    }
    bookedCount += 1;
  }

  if (bookedCount === 0) {
    return { ok: false, error: "등록 가능한 주가 없어요. 시간 또는 반복 횟수를 다시 확인해 주세요." };
  }

  revalidatePath("/coach/schedule");
  revalidatePath("/");
  return { ok: true, bookedCount, skippedWeeks };
}

/**
 * 보강 레슨 등록 (#18) — 결강(ABSENT)된 원 회차에 대한 보강 회차 추가.
 * 학생측 수락 흐름은 후속(상태=MAKEUP_PENDING 사용). 여기는 코치가 바로 확정으로 등록.
 */
export async function bookMakeupLesson(
  originalLessonId: number,
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

  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "시간이 올바르지 않습니다" };

  if (date.getTime() < Date.now() - 5 * 60 * 1000) {
    return { ok: false, error: "이미 지난 시각에는 보강을 잡을 수 없어요" };
  }

  const dur = Number.isInteger(durationMinutes) ? durationMinutes : 60;
  if (dur < 10 || dur > 240) return { ok: false, error: "레슨 시간이 올바르지 않습니다" };

  const admin = createAdminClient();

  // 원 회차 검증
  const { data: orig } = await admin
    .from("lessons")
    .select("id, coachId, studentId, status")
    .eq("id", originalLessonId)
    .maybeSingle();
  if (!orig) return { ok: false, error: "원 레슨을 찾을 수 없어요" };
  if (orig.coachId !== user.id) return { ok: false, error: "권한이 없어요" };
  if (orig.status !== "ABSENT") return { ok: false, error: "결강 처리된 레슨에만 보강을 등록할 수 있어요" };

  // 충돌 검증
  const newStart = date.getTime();
  const newEnd = newStart + dur * 60 * 1000;
  const windowStart = new Date(newStart - CONFLICT_SEARCH_WINDOW_MS).toISOString();
  const windowEnd = new Date(newEnd + CONFLICT_SEARCH_WINDOW_MS).toISOString();
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
    if (newStart < exEnd && newEnd > exStart) {
      return { ok: false, error: "그 시간에 이미 잡힌 레슨이 있어요" };
    }
  }

  const { data: inserted, error: insertError } = await admin
    .from("lessons")
    .insert({
      coachId: user.id,
      studentId: orig.studentId,
      scheduledAt: date.toISOString(),
      durationMinutes: dur,
      status: "MAKEUP_CONFIRMED",
      paymentStatus: "NONE",
      originalLessonId: orig.id,
      notes: "보강",
      updatedAt: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[bookMakeupLesson] insert error:", insertError);
    return { ok: false, error: "보강 등록 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/coach/schedule");
  revalidatePath("/");
  return { ok: true, lessonId: inserted!.id };
}

/**
 * 레슨 시간 변경 (코치 직접 변경) — 학생 요청 없이 코치가 시각/길이 수정.
 * CONFIRMED/IN_PROGRESS 상태만 허용. 충돌 시 거부.
 */
export async function updateLessonSchedule(
  lessonId: number,
  newScheduledAt: string,
  newDurationMinutes: number,
): Promise<SimpleResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const newDate = new Date(newScheduledAt);
  if (Number.isNaN(newDate.getTime())) return { ok: false, error: "시간이 올바르지 않습니다" };
  if (newDate.getTime() < Date.now() - 5 * 60 * 1000) {
    return { ok: false, error: "이미 지난 시각으로는 변경할 수 없어요" };
  }
  const dur = Number.isInteger(newDurationMinutes) ? newDurationMinutes : 60;
  if (dur < 10 || dur > 240) return { ok: false, error: "레슨 시간이 올바르지 않습니다" };

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, coachId, status, scheduledAt")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };
  if (lesson.coachId !== user.id) return { ok: false, error: "변경 권한이 없어요" };
  if (lesson.status !== "CONFIRMED" && lesson.status !== "IN_PROGRESS") {
    return { ok: false, error: "예정/진행 중 레슨만 시간 변경이 가능해요" };
  }

  // 충돌 검증 — 본인 외 active 레슨
  const newStart = newDate.getTime();
  const newEnd = newStart + dur * 60 * 1000;
  const windowStart = new Date(newStart - CONFLICT_SEARCH_WINDOW_MS).toISOString();
  const windowEnd = new Date(newEnd + CONFLICT_SEARCH_WINDOW_MS).toISOString();
  const { data: nearby } = await admin
    .from("lessons")
    .select("id, scheduledAt, durationMinutes, status")
    .eq("coachId", user.id)
    .neq("id", lessonId)
    .not("status", "in", "(CANCELLED,COMPLETED,ABSENT)")
    .gte("scheduledAt", windowStart)
    .lte("scheduledAt", windowEnd);
  for (const ex of nearby ?? []) {
    const exStart = new Date(ex.scheduledAt).getTime();
    const exEnd = exStart + (ex.durationMinutes ?? 60) * 60 * 1000;
    if (newStart < exEnd && newEnd > exStart) {
      return { ok: false, error: "그 시간에 이미 다른 레슨이 잡혀있어요" };
    }
  }

  const { error: updateError } = await admin
    .from("lessons")
    .update({
      scheduledAt: newDate.toISOString(),
      durationMinutes: dur,
      originalScheduledAt: lesson.scheduledAt, // 변경 전 시각 보관
      status: "RESCHEDULE_COMPLETED",
      updatedAt: new Date().toISOString(),
    })
    .eq("id", lessonId);

  if (updateError) {
    console.error("[updateLessonSchedule] update error:", updateError);
    return { ok: false, error: "시간 변경 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/coach/schedule");
  revalidatePath("/");
  return { ok: true };
}

/**
 * 결제확인 처리 — paymentStatus UNPAID → PAID.
 * EXTERNAL/PAID/NONE 상태에서는 호출 불가.
 */
export async function markLessonPaid(lessonId: number): Promise<SimpleResult> {
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
    .select("id, coachId, paymentStatus")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };
  if (lesson.coachId !== user.id) return { ok: false, error: "결제 처리 권한이 없어요" };
  if (lesson.paymentStatus !== "UNPAID") {
    return { ok: false, error: "미결제 상태의 레슨만 결제 확인할 수 있어요" };
  }

  const { error: updateError } = await admin
    .from("lessons")
    .update({ paymentStatus: "PAID", updatedAt: new Date().toISOString() })
    .eq("id", lessonId);

  if (updateError) {
    console.error("[markLessonPaid] update error:", updateError);
    return { ok: false, error: "결제 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/coach/schedule");
  revalidatePath("/");
  return { ok: true };
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
  const windowStart = new Date(start - CONFLICT_SEARCH_WINDOW_MS).toISOString();
  const windowEnd = new Date(end + CONFLICT_SEARCH_WINDOW_MS).toISOString();
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
  revalidatePath("/");
  return { ok: true };
}
