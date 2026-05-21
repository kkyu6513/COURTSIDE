/**
 * 코치 홈 12종 상태 카드 테스트 시드 — 로그인한 코치 본인 계정 / 어제 날짜
 *
 * 사용법: 코치로 로그인한 상태에서 GET /api/coach/seed-test-lessons 호출.
 * 어제(KST) 날짜에 12종 상태 레슨을 본인 스케줄로 삽입한다.
 * 재실행 안전 — 어제 날짜의 본인 레슨을 지우고 다시 삽입.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// 어제(KST) 날짜의 hour:minute → UTC ISO
function yesterdayAt(hour: number, minute: number): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(kst.getUTCDate() - 1);
  kst.setUTCHours(hour, minute, 0, 0);
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

// 더미 학생 12명 (고정 UUID)
const STUDENTS: Array<{ id: string; name: string }> = [
  { id: "20000000-0000-4000-8000-000000000001", name: "박민호" },
  { id: "20000000-0000-4000-8000-000000000002", name: "김영희" },
  { id: "20000000-0000-4000-8000-000000000003", name: "이민호" },
  { id: "20000000-0000-4000-8000-000000000004", name: "최영수" },
  { id: "20000000-0000-4000-8000-000000000005", name: "강민서" },
  { id: "20000000-0000-4000-8000-000000000006", name: "박지수" },
  { id: "20000000-0000-4000-8000-000000000007", name: "한지원" },
  { id: "20000000-0000-4000-8000-000000000008", name: "정다은" },
  { id: "20000000-0000-4000-8000-000000000009", name: "김태호" },
  { id: "20000000-0000-4000-8000-00000000000A", name: "이수진" },
  { id: "20000000-0000-4000-8000-00000000000B", name: "한지우" },
  { id: "20000000-0000-4000-8000-00000000000C", name: "최준혁" },
];

type LessonSeed = {
  studentIdx: number;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  paymentStatus: string;
  lessonFormat: "PRIVATE" | "GROUP";
  roundNumber?: number;
  totalRounds?: number;
  originalScheduledAt?: string;
  splitIndex?: number;
  splitTotal?: number;
  notes?: string;
};

// 12종 상태 — 어제 날짜 시간순
function buildLessons(): LessonSeed[] {
  return [
    // 1. PENDING — 레슨 신청
    {
      studentIdx: 0,
      scheduledAt: yesterdayAt(9, 0),
      durationMinutes: 60,
      status: "PENDING",
      paymentStatus: "NONE",
      lessonFormat: "PRIVATE",
      notes: "정규 1:1 · 화·목 09:00 희망",
    },
    // 2. CONFIRMED — 레슨 예정 (미결제)
    {
      studentIdx: 1,
      scheduledAt: yesterdayAt(10, 0),
      durationMinutes: 60,
      status: "CONFIRMED",
      paymentStatus: "UNPAID",
      lessonFormat: "PRIVATE",
      roundNumber: 4,
      totalRounds: 8,
    },
    // 3. IN_PROGRESS — 진행중
    {
      studentIdx: 2,
      scheduledAt: yesterdayAt(11, 0),
      durationMinutes: 60,
      status: "IN_PROGRESS",
      paymentStatus: "PAID",
      lessonFormat: "PRIVATE",
      roundNumber: 6,
      totalRounds: 8,
    },
    // 4. COMPLETED — 레슨완료 (외부결제)
    {
      studentIdx: 3,
      scheduledAt: yesterdayAt(12, 0),
      durationMinutes: 60,
      status: "COMPLETED",
      paymentStatus: "EXTERNAL",
      lessonFormat: "PRIVATE",
      roundNumber: 5,
      totalRounds: 8,
    },
    // 5. ABSENT — 결강
    {
      studentIdx: 4,
      scheduledAt: yesterdayAt(13, 0),
      durationMinutes: 60,
      status: "ABSENT",
      paymentStatus: "PAID",
      lessonFormat: "GROUP",
      roundNumber: 3,
      totalRounds: 8,
    },
    // 6. RESCHEDULE_REQUESTED — 변경 요청
    {
      studentIdx: 5,
      scheduledAt: yesterdayAt(14, 0),
      durationMinutes: 60,
      status: "RESCHEDULE_REQUESTED",
      paymentStatus: "PAID",
      lessonFormat: "PRIVATE",
      roundNumber: 3,
      totalRounds: 8,
    },
    // 7. RESCHEDULE_COMPLETED — 변경완료 (이전 시간 표시)
    {
      studentIdx: 6,
      scheduledAt: yesterdayAt(15, 0),
      durationMinutes: 60,
      status: "RESCHEDULE_COMPLETED",
      paymentStatus: "PAID",
      lessonFormat: "PRIVATE",
      roundNumber: 5,
      totalRounds: 8,
      originalScheduledAt: yesterdayAt(10, 0),
    },
    // 8. MAKEUP_PENDING — 보강 일정 선택중
    {
      studentIdx: 7,
      scheduledAt: yesterdayAt(16, 0),
      durationMinutes: 60,
      status: "MAKEUP_PENDING",
      paymentStatus: "NONE",
      lessonFormat: "GROUP",
      notes: "보강",
    },
    // 9. MAKEUP_CONFIRMED — 보강확정
    {
      studentIdx: 8,
      scheduledAt: yesterdayAt(16, 30),
      durationMinutes: 60,
      status: "MAKEUP_CONFIRMED",
      paymentStatus: "NONE",
      lessonFormat: "PRIVATE",
      notes: "보강",
    },
    // 10. MAKEUP_REQUESTED — 보강 요청
    {
      studentIdx: 9,
      scheduledAt: yesterdayAt(17, 0),
      durationMinutes: 60,
      status: "MAKEUP_REQUESTED",
      paymentStatus: "NONE",
      lessonFormat: "PRIVATE",
      notes: "보강 요청",
    },
    // 11. MERGE — 통합 회차 (40분)
    {
      studentIdx: 10,
      scheduledAt: yesterdayAt(18, 0),
      durationMinutes: 40,
      status: "MERGE",
      paymentStatus: "PAID",
      lessonFormat: "PRIVATE",
      notes: "통합 (원 회차 2건)",
    },
    // 12. SPLIT — 분할 회차 (20분, 1/2)
    {
      studentIdx: 11,
      scheduledAt: yesterdayAt(19, 0),
      durationMinutes: 20,
      status: "SPLIT",
      paymentStatus: "PAID",
      lessonFormat: "PRIVATE",
      splitIndex: 1,
      splitTotal: 2,
      notes: "분할 (그룹 2건 중 1)",
    },
  ];
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized — 로그인이 필요합니다" }, { status: 401 });
  }
  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") {
    return NextResponse.json({ error: "Forbidden — 코치 계정으로 로그인하세요" }, { status: 403 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // 1. 더미 학생 12명 upsert
  const { error: usersError } = await admin.from("users").upsert(
    STUDENTS.map((s) => ({
      id: s.id,
      email: `test-${s.id.slice(-12)}@courtside.local`,
      name: s.name,
      realName: s.name,
      role: "STUDENT",
      isActive: true,
      updatedAt: nowIso,
    })),
    { onConflict: "id" },
  );
  if (usersError) {
    console.error("[seed-test-lessons] users upsert error:", usersError);
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  // 2. 어제 날짜의 본인 레슨 삭제 (재실행 안전)
  const dayStart = yesterdayAt(0, 0);
  const dayEnd = yesterdayAt(23, 59);
  const { error: delError } = await admin
    .from("lessons")
    .delete()
    .eq("coachId", user.id)
    .gte("scheduledAt", dayStart)
    .lte("scheduledAt", dayEnd);
  if (delError) {
    console.error("[seed-test-lessons] delete error:", delError);
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  // 3. 12종 레슨 삽입
  const lessons = buildLessons();
  const rows = lessons.map((l) => ({
    coachId: user.id,
    studentId: STUDENTS[l.studentIdx].id,
    scheduledAt: l.scheduledAt,
    durationMinutes: l.durationMinutes,
    status: l.status,
    paymentStatus: l.paymentStatus,
    lessonFormat: l.lessonFormat,
    roundNumber: l.roundNumber ?? null,
    totalRounds: l.totalRounds ?? null,
    originalScheduledAt: l.originalScheduledAt ?? null,
    splitIndex: l.splitIndex ?? null,
    splitTotal: l.splitTotal ?? null,
    notes: l.notes ?? null,
    updatedAt: nowIso,
  }));
  const { error: insertError } = await admin.from("lessons").insert(rows);
  if (insertError) {
    console.error("[seed-test-lessons] insert error:", insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "어제 날짜에 12종 상태 테스트 레슨을 시드했습니다.",
    coachId: user.id,
    date: dayStart.slice(0, 10),
    lessonsInserted: rows.length,
    statuses: lessons.map((l) => l.status),
  });
}
