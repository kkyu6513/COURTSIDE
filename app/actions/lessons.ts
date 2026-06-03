"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };

const NOTES_MAX = 1000;

async function getAuthedUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function appendNote(prev: string | null, line: string): string {
  const next = [prev, line].filter(Boolean).join("\n");
  if (next.length <= NOTES_MAX) return next;
  const truncated = next.slice(next.length - NOTES_MAX + 1);
  const firstNewline = truncated.indexOf("\n");
  return firstNewline >= 0 ? "…" + truncated.slice(firstNewline) : truncated;
}

function revalidateLessonPaths(lessonId: number) {
  revalidatePath(`/coach/lessons/${lessonId}`);
  revalidatePath(`/lessons/${lessonId}`);
}

/**
 * 레슨 완료 처리 — 코치 전용. 시작 시각 이후만 가능.
 */
export async function completeLesson(lessonId: number): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, coachId, status, scheduledAt")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };
  if (lesson.coachId !== user.id) return { ok: false, error: "권한이 없어요" };
  if (!["CONFIRMED", "IN_PROGRESS", "MAKEUP_CONFIRMED"].includes(lesson.status)) {
    return { ok: false, error: "완료 처리할 수 없는 상태예요" };
  }
  if (new Date(lesson.scheduledAt).getTime() > Date.now()) {
    return { ok: false, error: "아직 시작하지 않은 레슨은 완료 처리할 수 없어요" };
  }

  const { error } = await admin
    .from("lessons")
    .update({ status: "COMPLETED", updatedAt: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) return { ok: false, error: error.message };

  revalidateLessonPaths(lessonId);
  return { ok: true };
}

/**
 * 결강 처리 — 코치 전용. 확정된 일정(CONFIRMED/IN_PROGRESS/MAKEUP_CONFIRMED)만.
 */
export async function markLessonAbsent(lessonId: number, reason: string): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "결강 사유를 입력해주세요" };
  if (trimmed.length > 500) return { ok: false, error: "사유는 500자 이내로 입력해주세요" };

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, coachId, status, notes")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };
  if (lesson.coachId !== user.id) return { ok: false, error: "권한이 없어요" };
  if (!["CONFIRMED", "IN_PROGRESS", "MAKEUP_CONFIRMED"].includes(lesson.status)) {
    return { ok: false, error: "확정된 레슨만 결강 처리할 수 있어요" };
  }

  const nextNotes = appendNote(lesson.notes, `[결강] ${trimmed}`);

  const { error } = await admin
    .from("lessons")
    .update({ status: "ABSENT", notes: nextNotes, updatedAt: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) return { ok: false, error: error.message };

  revalidateLessonPaths(lessonId);
  return { ok: true };
}

/**
 * 보강 요청 — 코치 전용. 확정 + 결강 회차만 (실제 일정 선택은 다음 PR).
 */
export async function requestMakeup(lessonId: number, reason: string): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "보강 사유를 입력해주세요" };
  if (trimmed.length > 500) return { ok: false, error: "사유는 500자 이내로 입력해주세요" };

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, coachId, status, notes")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };
  if (lesson.coachId !== user.id) return { ok: false, error: "권한이 없어요" };
  if (!["CONFIRMED", "IN_PROGRESS", "MAKEUP_CONFIRMED", "ABSENT"].includes(lesson.status)) {
    return { ok: false, error: "보강 요청을 보낼 수 없는 상태예요" };
  }

  const nextNotes = appendNote(lesson.notes, `[보강 요청] ${trimmed}`);

  const { error } = await admin
    .from("lessons")
    .update({
      status: "MAKEUP_REQUESTED",
      notes: nextNotes,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", lessonId);
  if (error) return { ok: false, error: error.message };

  revalidateLessonPaths(lessonId);
  return { ok: true };
}

/**
 * 보강 제안 (추가 모드) — 결강 또는 진행 예정 원 회차에 대해 새 보강 회차를 제안.
 * 새 lessons row 생성 (status=MAKEUP_PENDING + originalLessonId 참조 + notes=사유).
 * 학생이 수락하면 별도 액션에서 MAKEUP_CONFIRMED로 전환.
 *
 * 통합(MERGE)/분할(SPLIT) 모드는 후속 작업.
 */
export async function proposeMakeup(
  originalLessonId: number,
  reason: string,
  scheduledAt: string,
  durationMinutes: number,
): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "보강 사유를 선택해주세요" };
  if (trimmed.length > 500) return { ok: false, error: "사유는 500자 이내로 입력해주세요" };

  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "보강 일정 시각이 올바르지 않습니다" };
  if (date.getTime() < Date.now() - 5 * 60 * 1000) {
    return { ok: false, error: "이미 지난 시각에는 보강을 잡을 수 없어요" };
  }

  const dur = Number.isInteger(durationMinutes) ? durationMinutes : 60;
  if (dur < 10 || dur > 240) return { ok: false, error: "레슨 시간이 올바르지 않습니다" };

  const admin = createAdminClient();

  // 원 회차 검증 — 본인 코치의 레슨이어야 함
  const { data: orig } = await admin
    .from("lessons")
    .select("id, coachId, studentId, status")
    .eq("id", originalLessonId)
    .maybeSingle();

  if (!orig) return { ok: false, error: "원 레슨을 찾을 수 없어요" };
  if (orig.coachId !== user.id) return { ok: false, error: "권한이 없어요" };
  if (orig.status === "CANCELLED") {
    return { ok: false, error: "취소된 레슨에는 보강을 제안할 수 없어요" };
  }

  // 충돌 검증 (다른 활성 레슨과 시간 겹침 차단)
  const newStart = date.getTime();
  const newEnd = newStart + dur * 60 * 1000;
  const SEARCH_MS = 28 * 60 * 60 * 1000;
  const windowStart = new Date(newStart - SEARCH_MS).toISOString();
  const windowEnd = new Date(newEnd + SEARCH_MS).toISOString();
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

  const { error: insertError } = await admin.from("lessons").insert({
    coachId: user.id,
    studentId: orig.studentId,
    scheduledAt: date.toISOString(),
    durationMinutes: dur,
    status: "MAKEUP_PENDING",
    paymentStatus: "NONE",
    originalLessonId: orig.id,
    notes: `[보강 제안] ${trimmed}`,
    updatedAt: new Date().toISOString(),
  });

  if (insertError) {
    console.error("[proposeMakeup] insert error:", insertError);
    return { ok: false, error: "보강 제안 등록 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요." };
  }

  revalidateLessonPaths(originalLessonId);
  revalidatePath("/coach/schedule");
  revalidatePath("/");
  return { ok: true };
}

/**
 * 학생 — 보강 제안 수락. MAKEUP_PENDING → MAKEUP_CONFIRMED.
 * 본인 레슨만 처리. 시간 충돌 시 거부.
 */
export async function acceptMakeup(lessonId: number): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "STUDENT") return { ok: false, error: "학생만 수락할 수 있어요" };

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, studentId, status, scheduledAt, durationMinutes")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };
  if (lesson.studentId !== user.id) return { ok: false, error: "본인 레슨만 수락할 수 있어요" };
  if (lesson.status !== "MAKEUP_PENDING") {
    return { ok: false, error: "이미 처리된 보강 제안이에요" };
  }

  // 본인의 다른 활성 레슨과 시간 충돌 확인
  const start = new Date(lesson.scheduledAt).getTime();
  const end = start + (lesson.durationMinutes ?? 60) * 60 * 1000;
  const SEARCH_MS = 28 * 60 * 60 * 1000;
  const { data: nearby } = await admin
    .from("lessons")
    .select("id, scheduledAt, durationMinutes, status")
    .eq("studentId", user.id)
    .not("status", "in", "(CANCELLED,COMPLETED,ABSENT,MAKEUP_PENDING)")
    .gte("scheduledAt", new Date(start - SEARCH_MS).toISOString())
    .lte("scheduledAt", new Date(end + SEARCH_MS).toISOString());
  for (const ex of nearby ?? []) {
    if (ex.id === lessonId) continue;
    const exStart = new Date(ex.scheduledAt).getTime();
    const exEnd = exStart + (ex.durationMinutes ?? 60) * 60 * 1000;
    if (start < exEnd && end > exStart) {
      return {
        ok: false,
        error: "그 시간에 이미 잡혀 있는 다른 레슨이 있어요. 코치님께 다른 시간을 요청해 주세요.",
      };
    }
  }

  const { error } = await admin
    .from("lessons")
    .update({ status: "MAKEUP_CONFIRMED", updatedAt: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) {
    console.error("[acceptMakeup] update error:", error);
    return { ok: false, error: "보강 수락 중 문제가 발생했어요." };
  }

  revalidateLessonPaths(lessonId);
  revalidatePath("/");
  return { ok: true };
}

/**
 * 학생 — 보강 제안 거절. MAKEUP_PENDING → CANCELLED. 본인 레슨만.
 * 코치는 새 제안을 다시 보낼 수 있음.
 */
export async function rejectMakeup(lessonId: number): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "STUDENT") return { ok: false, error: "학생만 거절할 수 있어요" };

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, studentId, status")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };
  if (lesson.studentId !== user.id) return { ok: false, error: "본인 레슨만 거절할 수 있어요" };
  if (lesson.status !== "MAKEUP_PENDING") {
    return { ok: false, error: "이미 처리된 보강 제안이에요" };
  }

  const { error } = await admin
    .from("lessons")
    .update({ status: "CANCELLED", updatedAt: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) {
    console.error("[rejectMakeup] update error:", error);
    return { ok: false, error: "보강 거절 중 문제가 발생했어요." };
  }

  revalidateLessonPaths(lessonId);
  revalidatePath("/");
  return { ok: true };
}

/**
 * 레슨 취소 (사유 입력). 코치/학생 둘 다 호출 가능.
 * - COACH: 본인 코치의 레슨
 * - STUDENT: 본인 학생의 레슨 (단, 24시간 전까지만)
 */
export async function cancelLessonWithReason(
  lessonId: number,
  reason: string,
): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const meta = user.app_metadata as { role?: string } | undefined;
  const role = meta?.role;

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "취소 사유를 입력해주세요" };
  if (trimmed.length > 500) return { ok: false, error: "사유는 500자 이내로 입력해주세요" };

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, coachId, studentId, status, scheduledAt, notes")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };

  const isOwnerCoach = role === "COACH" && lesson.coachId === user.id;
  const isOwnerStudent = role === "STUDENT" && lesson.studentId === user.id;
  if (!isOwnerCoach && !isOwnerStudent) {
    return { ok: false, error: "취소 권한이 없어요" };
  }

  if (["CANCELLED", "COMPLETED", "ABSENT", "RESCHEDULE_COMPLETED"].includes(lesson.status)) {
    return { ok: false, error: "이미 종료된 레슨이에요" };
  }

  if (isOwnerStudent) {
    const startMs = new Date(lesson.scheduledAt).getTime();
    if (startMs - Date.now() < 24 * 60 * 60 * 1000) {
      return { ok: false, error: "레슨 24시간 전부터는 취소가 불가합니다" };
    }
  }

  const prefix = isOwnerCoach ? "[코치 취소]" : "[학생 취소]";
  const nextNotes = appendNote(lesson.notes, `${prefix} ${trimmed}`);

  const { error } = await admin
    .from("lessons")
    .update({ status: "CANCELLED", notes: nextNotes, updatedAt: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) return { ok: false, error: error.message };

  revalidateLessonPaths(lessonId);
  return { ok: true };
}

/**
 * 코치 메모 수정 — 코치 본인 레슨만. 1000자 한도.
 * (schedule/actions.ts의 updateLessonNotes 와 별개로 lesson detail 페이지 전용 노출)
 */
export async function saveLessonNotes(lessonId: number, notes: string): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const trimmed = notes.trim();
  if (trimmed.length > NOTES_MAX) {
    return { ok: false, error: `메모는 ${NOTES_MAX}자 이내로 작성해주세요` };
  }

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, coachId")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };
  if (lesson.coachId !== user.id) return { ok: false, error: "권한이 없어요" };

  const { error } = await admin
    .from("lessons")
    .update({ notes: trimmed || null, updatedAt: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) return { ok: false, error: error.message };

  revalidateLessonPaths(lessonId);
  return { ok: true };
}

/**
 * 대기 신청 확정 — 코치 전용. PENDING → CONFIRMED.
 * spec 7-0 "스케줄 확정하기" 액션. 이 시점에 학생에게 알림톡 발송 예정 (Sprint 3).
 */
export async function confirmPendingLesson(lessonId: number): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, coachId, status, scheduledAt")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };
  if (lesson.coachId !== user.id) return { ok: false, error: "권한이 없어요" };
  if (lesson.status !== "PENDING") {
    return { ok: false, error: "대기 중인 신청만 확정할 수 있어요" };
  }
  if (new Date(lesson.scheduledAt).getTime() < Date.now()) {
    return { ok: false, error: "이미 지난 시간이라 확정할 수 없어요" };
  }

  const { error } = await admin
    .from("lessons")
    .update({ status: "CONFIRMED", updatedAt: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) return { ok: false, error: error.message };

  revalidateLessonPaths(lessonId);
  return { ok: true };
}

/**
 * 결제 확인 — 코치 전용. paymentStatus UNPAID → PAID.
 * spec FR-12b "결제확인" — 학생이 외부로 입금 완료 후 코치가 수동 확인.
 */
export async function markLessonPaid(lessonId: number): Promise<Result> {
  const user = await getAuthedUser();
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
  if (lesson.coachId !== user.id) return { ok: false, error: "권한이 없어요" };
  if (lesson.paymentStatus === "PAID") {
    return { ok: false, error: "이미 결제완료 상태예요" };
  }
  if (lesson.paymentStatus === "NONE") {
    return { ok: false, error: "결제 무관 회차예요" };
  }

  const { error } = await admin
    .from("lessons")
    .update({ paymentStatus: "PAID", updatedAt: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) return { ok: false, error: error.message };

  revalidateLessonPaths(lessonId);
  return { ok: true };
}

/**
 * 완료/결강 처리 되돌리기 — COMPLETED/ABSENT → CONFIRMED.
 * 코치가 실수로 처리한 경우 다시 예정 상태로 복원.
 */
export async function revertLessonStatus(lessonId: number): Promise<Result> {
  const user = await getAuthedUser();
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
  if (lesson.coachId !== user.id) return { ok: false, error: "권한이 없어요" };
  if (!["COMPLETED", "ABSENT"].includes(lesson.status)) {
    return { ok: false, error: "완료/결강 처리된 레슨만 되돌릴 수 있어요" };
  }

  const { error } = await admin
    .from("lessons")
    .update({ status: "CONFIRMED", updatedAt: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) return { ok: false, error: error.message };

  revalidateLessonPaths(lessonId);
  return { ok: true };
}

/**
 * 결제 확인 되돌리기 — paymentStatus PAID → UNPAID.
 * 코치가 실수로 결제 확인을 누른 경우. EXTERNAL/NONE 은 토글 불가.
 */
export async function unmarkLessonPaid(lessonId: number): Promise<Result> {
  const user = await getAuthedUser();
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
  if (lesson.coachId !== user.id) return { ok: false, error: "권한이 없어요" };
  if (lesson.paymentStatus !== "PAID") {
    return { ok: false, error: "결제 완료된 레슨만 되돌릴 수 있어요" };
  }

  const { error } = await admin
    .from("lessons")
    .update({ paymentStatus: "UNPAID", updatedAt: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) return { ok: false, error: error.message };

  revalidateLessonPaths(lessonId);
  return { ok: true };
}
