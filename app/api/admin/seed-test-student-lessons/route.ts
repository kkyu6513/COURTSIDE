/**
 * 학생 홈 12종 상태 테스트 데이터 시드 (실 DB insert)
 *
 * - users 테이블의 모든 STUDENT 계정에 대해
 * - 어제(KST) 날짜에 12종 상태 레슨을 insert
 * - 코치는 고정 더미 코치 (홍길동, 00000000-0000-4000-8000-000000000001)
 *
 * 재실행 안전: 각 학생의 더미 코치 레슨만 삭제 후 재삽입 (실 레슨은 보존)
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ONE_TIME_TOKEN = "courtside-seed-test-student-lessons-2026-05-15-Yp4xKbWzQn";

// 더미 코치 (홍길동) — 이미 seed-test-coach 에서 생성됨. 안전을 위해 여기서도 upsert.
const TEST_COACH_ID = "00000000-0000-4000-8000-000000000001";
const TEST_COACH_NAME = "홍길동";
const TEST_COACH_EMAIL = "hong-test@courtside.local";
const TEST_COACH_PHONE = "01012345678";

// 어제(KST) 날짜의 hour:minute → UTC ISO
function yesterdayAt(hour: number, minute: number): string {
  const kst = new Date(Date.now() - 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000);
  kst.setUTCHours(hour, minute, 0, 0);
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

// 이번 주 월요일 00:00 KST 기준의 N일 후 hh:mm → UTC ISO
function thisWeekAt(dayOffset: number, hour: number, minute: number): string {
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dow = nowKst.getUTCDay();
  const offsetToMon = (dow + 6) % 7;
  const monKst = new Date(nowKst);
  monKst.setUTCDate(monKst.getUTCDate() - offsetToMon);
  monKst.setUTCHours(0, 0, 0, 0);
  const target = new Date(monKst);
  target.setUTCDate(target.getUTCDate() + dayOffset);
  target.setUTCHours(hour, minute, 0, 0);
  return new Date(target.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

type LessonSeed = {
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

// 학생 홈에 12종 다양한 상태를 보여주는 레슨 세트.
// 이번 주(월~일) 평일에 분산 + 어제 자리에 완료/결강을 둠.
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
    // 어제 — 완료 / 결강
    { ...base, scheduledAt: yesterdayAt(10, 0), status: "COMPLETED", roundNumber: 5, totalRounds: 8 },
    { ...base, scheduledAt: yesterdayAt(14, 0), status: "ABSENT", lessonFormat: "GROUP", roundNumber: 3, totalRounds: 8 },
    // 이번 주 월 (dayOffset=0)
    { ...base, scheduledAt: thisWeekAt(0, 11, 0), status: "RESCHEDULE_COMPLETED", roundNumber: 6, totalRounds: 8, originalScheduledAt: thisWeekAt(0, 9, 0) },
    // 화 (1) — 진행중 (현재 시각 무관, 단순 표시용)
    { ...base, scheduledAt: thisWeekAt(1, 10, 0), status: "IN_PROGRESS", roundNumber: 7, totalRounds: 8 },
    // 수 (2) — 변경 요청 (학생→코치)
    { ...base, scheduledAt: thisWeekAt(2, 14, 0), status: "RESCHEDULE_REQUESTED", roundNumber: 4, totalRounds: 8 },
    // 목 (3) — 미결제 예정
    { ...base, scheduledAt: thisWeekAt(3, 19, 0), status: "CONFIRMED", paymentStatus: "UNPAID", roundNumber: 1, totalRounds: 8 },
    // 금 (4) — 예정
    { ...base, scheduledAt: thisWeekAt(4, 19, 0), status: "CONFIRMED", roundNumber: 8, totalRounds: 8, notes: "이번 회차 마지막 레슨" },
    // 토 (5) — 보강 일정 선택중
    { ...base, scheduledAt: thisWeekAt(5, 11, 0), status: "MAKEUP_PENDING", paymentStatus: "NONE", notes: "보강" },
    // 토 (5) — 보강 확정
    { ...base, scheduledAt: thisWeekAt(5, 14, 0), status: "MAKEUP_CONFIRMED", paymentStatus: "NONE", notes: "보강" },
    // 일 (6) — 보강 요청
    { ...base, scheduledAt: thisWeekAt(6, 10, 0), status: "MAKEUP_REQUESTED", paymentStatus: "NONE", notes: "보강 요청" },
    // 일 (6) — 통합 회차
    { ...base, scheduledAt: thisWeekAt(6, 13, 0), durationMinutes: 40, status: "MERGE", notes: "통합 (원 회차 2건)" },
    // 일 (6) — 분할 회차
    { ...base, scheduledAt: thisWeekAt(6, 17, 0), durationMinutes: 20, status: "SPLIT", splitIndex: 1, splitTotal: 2, notes: "분할 (그룹 2건 중 1)" },
    // 다음 주 — 레슨 신청 (PENDING)
    { ...base, scheduledAt: thisWeekAt(8, 10, 0), status: "PENDING", paymentStatus: "NONE", notes: "정규 1:1 · 화·목 10:00 희망" },
  ];
}

async function runSeed(): Promise<NextResponse> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: "DATABASE_URL or DIRECT_URL not set" }, { status: 500 });
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    // 1. 더미 코치 (홍길동) upsert
    await prisma.$executeRaw`
      INSERT INTO users (id, email, name, "realName", phone, role, "isActive", "createdAt", "updatedAt")
      VALUES (
        ${TEST_COACH_ID}::uuid,
        ${TEST_COACH_EMAIL},
        ${TEST_COACH_NAME},
        ${TEST_COACH_NAME},
        ${TEST_COACH_PHONE},
        'COACH',
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        "realName" = EXCLUDED."realName",
        phone = EXCLUDED.phone,
        role = EXCLUDED.role,
        "updatedAt" = NOW()
    `;

    // coach_profiles (FK 일관성 위해)
    await prisma.$executeRaw`
      INSERT INTO coach_profiles (
        "userId", bio, gender, "priceVisibility", "areaSido", "areaSigungu",
        "averageRating", "reviewCount", "bookingCount", "isVerified", "createdAt", "updatedAt"
      )
      VALUES (
        ${TEST_COACH_ID}::uuid,
        '테스트용 더미 코치입니다. 학생 홈 시드 용도.',
        'MALE',
        'PRIVATE',
        '서울특별시',
        '강남구',
        0, 0, 0, false, NOW(), NOW()
      )
      ON CONFLICT ("userId") DO NOTHING
    `;

    // 2. 모든 학생 계정 조회
    const students = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users WHERE role = 'STUDENT'
    `;
    if (students.length === 0) {
      return NextResponse.json(
        { ok: false, error: "role=STUDENT 인 사용자가 없습니다. 먼저 학생 계정으로 가입하세요." },
        { status: 404 },
      );
    }

    const lessons = buildLessons();
    let totalInserted = 0;

    for (const s of students) {
      // 2-1. 기존 더미 코치 레슨 삭제 (다른 코치 레슨은 보존)
      await prisma.$executeRaw`
        DELETE FROM lessons
        WHERE "studentId" = ${s.id}::uuid
          AND "coachId" = ${TEST_COACH_ID}::uuid
      `;

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
            ${TEST_COACH_ID}::uuid,
            ${s.id}::uuid,
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
      message: "학생 계정에 12종 상태 테스트 레슨을 시드했습니다.",
      coachId: TEST_COACH_ID,
      coachName: TEST_COACH_NAME,
      studentsSeeded: students.length,
      lessonsPerStudent: lessons.length,
      totalLessonsInserted: totalInserted,
      statuses: lessons.map((l) => l.status),
    });
  } catch (e) {
    console.error("[seed-test-student-lessons] error:", e);
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
