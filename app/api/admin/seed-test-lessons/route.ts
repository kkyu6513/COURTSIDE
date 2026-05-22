/**
 * 코치 홈 12종 상태 카드 테스트 데이터 시드 (실 DB insert)
 *
 * - users 테이블의 모든 COACH 계정에 대해
 * - 어제(KST) 날짜에 12종 상태 레슨을 insert
 * - 더미 학생 12명 upsert (이름 표시는 /api/coach/lessons 의 studentNames 로 해석)
 *
 * 재실행 안전: 각 코치의 더미 학생 레슨만 삭제 후 재삽입 (실 레슨은 보존)
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ONE_TIME_TOKEN = "courtside-seed-test-lessons-2026-05-15-Lq7vBnRyKx";

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

// 어제(KST) 날짜의 hour:minute → UTC ISO
function yesterdayAt(hour: number, minute: number): string {
  const kst = new Date(Date.now() - 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000);
  kst.setUTCHours(hour, minute, 0, 0);
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

type LessonSeed = {
  studentIdx: number;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  paymentStatus: string;
  lessonFormat: "PRIVATE" | "GROUP";
  roundNumber: number | null;
  totalRounds: number | null;
  originalScheduledAt: string | null;
  splitIndex: number | null;
  splitTotal: number | null;
  notes: string | null;
};

// 12종 상태 — 어제 날짜
function buildLessons(): LessonSeed[] {
  const base = {
    durationMinutes: 60,
    paymentStatus: "PAID",
    lessonFormat: "PRIVATE" as const,
    roundNumber: null as number | null,
    totalRounds: null as number | null,
    originalScheduledAt: null as string | null,
    splitIndex: null as number | null,
    splitTotal: null as number | null,
    notes: null as string | null,
  };
  return [
    { ...base, studentIdx: 0, scheduledAt: yesterdayAt(9, 0), status: "PENDING", paymentStatus: "NONE", notes: "정규 1:1 · 화·목 09:00 희망" },
    { ...base, studentIdx: 1, scheduledAt: yesterdayAt(10, 0), status: "CONFIRMED", paymentStatus: "UNPAID", roundNumber: 4, totalRounds: 8 },
    { ...base, studentIdx: 2, scheduledAt: yesterdayAt(11, 0), status: "IN_PROGRESS", roundNumber: 6, totalRounds: 8 },
    { ...base, studentIdx: 3, scheduledAt: yesterdayAt(12, 0), status: "COMPLETED", paymentStatus: "EXTERNAL", roundNumber: 5, totalRounds: 8 },
    { ...base, studentIdx: 4, scheduledAt: yesterdayAt(13, 0), status: "ABSENT", lessonFormat: "GROUP", roundNumber: 3, totalRounds: 8 },
    { ...base, studentIdx: 5, scheduledAt: yesterdayAt(14, 0), status: "RESCHEDULE_REQUESTED", roundNumber: 3, totalRounds: 8 },
    { ...base, studentIdx: 6, scheduledAt: yesterdayAt(15, 0), status: "RESCHEDULE_COMPLETED", roundNumber: 5, totalRounds: 8, originalScheduledAt: yesterdayAt(10, 0) },
    { ...base, studentIdx: 7, scheduledAt: yesterdayAt(16, 0), status: "MAKEUP_PENDING", paymentStatus: "NONE", lessonFormat: "GROUP", notes: "보강" },
    { ...base, studentIdx: 8, scheduledAt: yesterdayAt(16, 30), status: "MAKEUP_CONFIRMED", paymentStatus: "NONE", notes: "보강" },
    { ...base, studentIdx: 9, scheduledAt: yesterdayAt(17, 0), status: "MAKEUP_REQUESTED", paymentStatus: "NONE", notes: "보강 요청" },
    { ...base, studentIdx: 10, scheduledAt: yesterdayAt(18, 0), durationMinutes: 40, status: "MERGE", notes: "통합 (원 회차 2건)" },
    { ...base, studentIdx: 11, scheduledAt: yesterdayAt(19, 0), durationMinutes: 20, status: "SPLIT", splitIndex: 1, splitTotal: 2, notes: "분할 (그룹 2건 중 1)" },
  ];
}

async function runSeed(): Promise<NextResponse> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: "DATABASE_URL or DIRECT_URL not set" }, { status: 500 });
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    // 1. 더미 학생 12명 upsert
    for (const s of STUDENTS) {
      await prisma.$executeRaw`
        INSERT INTO users (id, email, name, "realName", role, "isActive", "createdAt", "updatedAt")
        VALUES (
          ${s.id}::uuid,
          ${"test-" + s.id.slice(-12) + "@courtside.local"},
          ${s.name},
          ${s.name},
          'STUDENT',
          true,
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          "realName" = EXCLUDED."realName",
          role = EXCLUDED.role,
          "updatedAt" = NOW()
      `;
    }

    // 2. 모든 코치 계정 조회
    const coaches = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users WHERE role = 'COACH'
    `;
    if (coaches.length === 0) {
      return NextResponse.json(
        { ok: false, error: "role=COACH 인 사용자가 없습니다. 먼저 코치 계정으로 가입하세요." },
        { status: 404 },
      );
    }

    const dummyIdList = STUDENTS.map((s) => `'${s.id}'::uuid`).join(",");
    const lessons = buildLessons();
    let totalInserted = 0;

    for (const coach of coaches) {
      // 2-1. 기존 더미 레슨 삭제 (실 레슨은 보존 — 더미 학생 레슨만 제거)
      await prisma.$executeRawUnsafe(
        `DELETE FROM lessons WHERE "coachId" = $1::uuid AND "studentId" IN (${dummyIdList})`,
        coach.id,
      );

      // 2-2. 12종 레슨 insert
      for (const l of lessons) {
        await prisma.$executeRaw`
          INSERT INTO lessons (
            "coachId", "studentId", "scheduledAt", "durationMinutes",
            "status", "paymentStatus", "lessonFormat",
            "roundNumber", "totalRounds",
            "originalScheduledAt", "splitIndex", "splitTotal",
            "notes", "createdAt", "updatedAt"
          ) VALUES (
            ${coach.id}::uuid,
            ${STUDENTS[l.studentIdx].id}::uuid,
            ${l.scheduledAt}::timestamp,
            ${l.durationMinutes},
            ${l.status},
            ${l.paymentStatus},
            ${l.lessonFormat},
            ${l.roundNumber},
            ${l.totalRounds},
            ${l.originalScheduledAt}::timestamp,
            ${l.splitIndex},
            ${l.splitTotal},
            ${l.notes},
            NOW(),
            NOW()
          )
        `;
        totalInserted += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      message: "어제 날짜에 12종 상태 테스트 레슨을 모든 코치 계정에 시드했습니다.",
      date: yesterdayAt(0, 0).slice(0, 10),
      coachesSeeded: coaches.length,
      lessonsPerCoach: lessons.length,
      totalLessonsInserted: totalInserted,
      statuses: lessons.map((l) => l.status),
    });
  } catch (e) {
    console.error("[seed-test-lessons] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "시드 중 오류" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== ONE_TIME_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSeed();
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== ONE_TIME_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSeed();
}
