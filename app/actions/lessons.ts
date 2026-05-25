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
 * 레슨 취소 (사유 필수) — 코치/학생 공통.
 * - 학생: 레슨 24시간 전까지
 * (환불 자동 계산은 결제 모듈 도입 후 다음 PR)
 */
export async function cancelLessonWithReason(lessonId: number, reason: string): Promise<Result> {
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
