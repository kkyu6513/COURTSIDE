"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };

async function getAuthedUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * 레슨 완료 처리 — 코치 전용. CONFIRMED/IN_PROGRESS 에서만 가능.
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

  const { error } = await admin
    .from("lessons")
    .update({ status: "COMPLETED", updatedAt: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/coach/schedule");
  revalidatePath(`/coach/lessons/${lessonId}`);
  revalidatePath(`/lessons/${lessonId}`);
  return { ok: true };
}

/**
 * 결강 처리 — 코치 전용. 사유는 notes에 누적 기록.
 */
export async function markLessonAbsent(lessonId: number, reason: string): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "결강 사유를 입력해주세요" };

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, coachId, status, notes")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };
  if (lesson.coachId !== user.id) return { ok: false, error: "권한이 없어요" };
  if (["COMPLETED", "CANCELLED", "ABSENT"].includes(lesson.status)) {
    return { ok: false, error: "결강 처리할 수 없는 상태예요" };
  }

  const nextNotes = [lesson.notes, `[결강] ${trimmed}`].filter(Boolean).join("\n");

  const { error } = await admin
    .from("lessons")
    .update({
      status: "ABSENT",
      notes: nextNotes,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", lessonId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/coach/schedule");
  revalidatePath(`/coach/lessons/${lessonId}`);
  revalidatePath(`/lessons/${lessonId}`);
  return { ok: true };
}

/**
 * 보강 요청 — 코치 전용. 원 레슨을 MAKEUP_REQUESTED 로 표시.
 * (실제 보강 일정은 별도 추가 액션으로 처리 — Sprint 2 후반에 통합/분할 + 학생 응답 플로우 도입)
 */
export async function requestMakeup(lessonId: number, reason: string): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "보강 사유를 입력해주세요" };

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, coachId, status, notes")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };
  if (lesson.coachId !== user.id) return { ok: false, error: "권한이 없어요" };
  if (["COMPLETED", "CANCELLED", "MAKEUP_REQUESTED", "MAKEUP_PENDING", "MAKEUP_CONFIRMED"].includes(lesson.status)) {
    return { ok: false, error: "보강 요청을 보낼 수 없는 상태예요" };
  }

  const nextNotes = [lesson.notes, `[보강 요청] ${trimmed}`].filter(Boolean).join("\n");

  const { error } = await admin
    .from("lessons")
    .update({
      status: "MAKEUP_REQUESTED",
      notes: nextNotes,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", lessonId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/coach/schedule");
  revalidatePath(`/coach/lessons/${lessonId}`);
  revalidatePath(`/lessons/${lessonId}`);
  return { ok: true };
}

/**
 * 레슨 취소 (사유 포함) — 코치/학생 공통. 본인 관련 레슨만.
 * 기존 cancelLesson(coach/schedule)과 분리 — reason 받음.
 */
export async function cancelLessonWithReason(lessonId: number, reason: string): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const meta = user.app_metadata as { role?: string } | undefined;
  const role = meta?.role;

  const trimmed = reason.trim();

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, coachId, studentId, status, scheduledAt, notes")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) return { ok: false, error: "레슨을 찾을 수 없어요" };

  // 권한 — 본인 코치 OR 본인 학생만
  const isOwnerCoach = role === "COACH" && lesson.coachId === user.id;
  const isOwnerStudent = role === "STUDENT" && lesson.studentId === user.id;
  if (!isOwnerCoach && !isOwnerStudent) {
    return { ok: false, error: "취소 권한이 없어요" };
  }

  if (["CANCELLED", "COMPLETED", "ABSENT"].includes(lesson.status)) {
    return { ok: false, error: "이미 종료된 레슨이에요" };
  }

  // 학생 셀프 취소 — 당일 24시간 이내면 거부 (정책 단순화 — 환불 계산은 추후)
  if (isOwnerStudent) {
    const startMs = new Date(lesson.scheduledAt).getTime();
    if (startMs - Date.now() < 24 * 60 * 60 * 1000) {
      return { ok: false, error: "레슨 24시간 전부터는 취소가 불가합니다" };
    }
  }

  const note = trimmed
    ? `[${isOwnerCoach ? "코치" : "학생"} 취소] ${trimmed}`
    : `[${isOwnerCoach ? "코치" : "학생"} 취소]`;
  const nextNotes = [lesson.notes, note].filter(Boolean).join("\n");

  const { error } = await admin
    .from("lessons")
    .update({
      status: "CANCELLED",
      notes: nextNotes,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", lessonId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/coach/schedule");
  revalidatePath(`/coach/lessons/${lessonId}`);
  revalidatePath(`/lessons/${lessonId}`);
  return { ok: true };
}

/**
 * 코치 메모 수정 — schedule/actions의 updateLessonNotes 와 동일한 권한.
 * (lessons 라우트 페이지에서 직접 호출하기 위해 재노출)
 */
export async function saveLessonNotes(lessonId: number, notes: string): Promise<Result> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") return { ok: false, error: "코치만 가능해요" };

  const trimmed = notes.trim();
  if (trimmed.length > 1000) return { ok: false, error: "메모는 1000자 이내로 작성해주세요" };

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

  revalidatePath(`/coach/lessons/${lessonId}`);
  revalidatePath(`/lessons/${lessonId}`);
  return { ok: true };
}
