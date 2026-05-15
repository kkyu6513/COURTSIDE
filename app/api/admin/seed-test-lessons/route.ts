/**
 * 코치 홈 12종 상태 카드 테스트 데이터 시드 (홍길동 코치 기준)
 *
 * - test coach: 00000000-0000-4000-8000-000000000001 (홍길동)
 * - 12명의 더미 학생을 users 테이블에 추가
 * - lessons 테이블에 14건의 다양한 상태 케이스 삽입
 *
 * 재실행 안전 (ON CONFLICT, 기존 동일 (coachId, scheduledAt, studentId) 묶음은 삭제 후 재삽입)
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ONE_TIME_TOKEN = "courtside-seed-test-lessons-2026-05-15-Lq7vBnRyKx";

const COACH_ID = "00000000-0000-4000-8000-000000000001"; // 홍길동

// 12명의 더미 학생
const STUDENTS: Array<{ id: string; name: string }> = [
  { id: "20000000-0000-4000-8000-000000000001", name: "박민호" },
  { id: "20000000-0000-4000-8000-000000000002", name: "최영수" },
  { id: "20000000-0000-4000-8000-000000000003", name: "강민서" },
  { id: "20000000-0000-4000-8000-000000000004", name: "이민호" },
  { id: "20000000-0000-4000-8000-000000000005", name: "박수진" },
  { id: "20000000-0000-4000-8000-000000000006", name: "김영희" },
  { id: "20000000-0000-4000-8000-000000000007", name: "정다은" },
  { id: "20000000-0000-4000-8000-000000000008", name: "박지수" },
  { id: "20000000-0000-4000-8000-000000000009", name: "한지원" },
  { id: "20000000-0000-4000-8000-00000000000A", name: "김태호" },
  { id: "20000000-0000-4000-8000-00000000000B", name: "이수진" },
  { id: "20000000-0000-4000-8000-00000000000C", name: "한지우" },
  { id: "20000000-0000-4000-8000-00000000000D", name: "최준혁" },
];

// 오늘 날짜의 시각 (KST 기준)을 ISO 문자열로 — 시드 시점 NOW 기준 동일 일자 사용
function todayAt(hour: number, minute: number): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCHours(hour, minute, 0, 0);
  // 다시 UTC로 변환
  const utc = new Date(kst.getTime() - 9 * 60 * 60 * 1000);
  return utc.toISOString();
}

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

const LESSONS: LessonSeed[] = [
  // 1. PENDING — 박민호 09:15 신청
  {
    studentIdx: 0,
    scheduledAt: todayAt(10, 0),
    durationMinutes: 60,
    status: "PENDING",
    paymentStatus: "NONE",
    lessonFormat: "PRIVATE",
    notes: "정규 1:1 · 화·목 10:00 희망",
  },
  // 2. COMPLETED — 최영수 09:00
  {
    studentIdx: 1,
    scheduledAt: todayAt(9, 0),
    durationMinutes: 60,
    status: "COMPLETED",
    paymentStatus: "PAID",
    lessonFormat: "PRIVATE",
    roundNumber: 5,
    totalRounds: 8,
  },
  // 3. ABSENT — 강민서 09:30
  {
    studentIdx: 2,
    scheduledAt: todayAt(9, 30),
    durationMinutes: 60,
    status: "ABSENT",
    paymentStatus: "PAID",
    lessonFormat: "GROUP",
    roundNumber: 3,
    totalRounds: 8,
  },
  // 4. IN_PROGRESS — 이민호 10:00
  {
    studentIdx: 3,
    scheduledAt: todayAt(10, 0),
    durationMinutes: 60,
    status: "IN_PROGRESS",
    paymentStatus: "PAID",
    lessonFormat: "PRIVATE",
    roundNumber: 6,
    totalRounds: 8,
  },
  // 5. UPCOMING — 박수진 13:00 그룹
  {
    studentIdx: 4,
    scheduledAt: todayAt(13, 0),
    durationMinutes: 60,
    status: "CONFIRMED",
    paymentStatus: "PAID",
    lessonFormat: "GROUP",
    roundNumber: 2,
    totalRounds: 4,
  },
  // 6. UPCOMING — 김영희 14:00 1:1
  {
    studentIdx: 5,
    scheduledAt: todayAt(14, 0),
    durationMinutes: 60,
    status: "CONFIRMED",
    paymentStatus: "PAID",
    lessonFormat: "PRIVATE",
    roundNumber: 4,
    totalRounds: 8,
  },
  // 7. UPCOMING — 정다은 15:00 1:1
  {
    studentIdx: 6,
    scheduledAt: todayAt(15, 0),
    durationMinutes: 60,
    status: "CONFIRMED",
    paymentStatus: "PAID",
    lessonFormat: "PRIVATE",
    roundNumber: 7,
    totalRounds: 8,
  },
  // 8. RESCHEDULE_REQUESTED — 박지수 16:00 1:1
  {
    studentIdx: 7,
    scheduledAt: todayAt(16, 0),
    durationMinutes: 60,
    status: "RESCHEDULE_REQUESTED",
    paymentStatus: "PAID",
    lessonFormat: "PRIVATE",
    roundNumber: 3,
    totalRounds: 8,
  },
  // 9. RESCHEDULE_COMPLETED — 한지원 16:00 ← 10:00 1:1
  {
    studentIdx: 8,
    scheduledAt: todayAt(16, 0),
    durationMinutes: 60,
    status: "RESCHEDULE_COMPLETED",
    paymentStatus: "PAID",
    lessonFormat: "PRIVATE",
    roundNumber: 5,
    totalRounds: 8,
    originalScheduledAt: todayAt(10, 0),
  },
  // 10. MAKEUP_PENDING — 강민서 16:30 그룹 보강 (일정 선택중)
  {
    studentIdx: 2,
    scheduledAt: todayAt(16, 30),
    durationMinutes: 60,
    status: "MAKEUP_PENDING",
    paymentStatus: "NONE",
    lessonFormat: "GROUP",
    notes: "보강",
  },
  // 11. MAKEUP_CONFIRMED — 김태호 17:00 1:1 보강확정
  {
    studentIdx: 9,
    scheduledAt: todayAt(17, 0),
    durationMinutes: 60,
    status: "MAKEUP_CONFIRMED",
    paymentStatus: "NONE",
    lessonFormat: "PRIVATE",
    notes: "보강",
  },
  // 12. MAKEUP_REQUESTED — 이수진 17:30 1:1 보강요청
  {
    studentIdx: 10,
    scheduledAt: todayAt(17, 30),
    durationMinutes: 60,
    status: "MAKEUP_REQUESTED",
    paymentStatus: "NONE",
    lessonFormat: "PRIVATE",
    notes: "보강 요청",
  },
  // 13. MERGE — 이수진 10:00 1:1 통합 (40분)
  {
    studentIdx: 10,
    scheduledAt: todayAt(11, 30),
    durationMinutes: 40,
    status: "MERGE",
    paymentStatus: "PAID",
    lessonFormat: "PRIVATE",
    notes: "통합 (원 회차 2건)",
  },
  // 14. SPLIT — 박지수 14:00 1:1 분할 (20분, 1/2)
  {
    studentIdx: 7,
    scheduledAt: todayAt(14, 30),
    durationMinutes: 20,
    status: "SPLIT",
    paymentStatus: "PAID",
    lessonFormat: "PRIVATE",
    splitIndex: 1,
    splitTotal: 2,
    notes: "분할 (그룹 2건 중 1)",
  },
  // 15. UPCOMING + UNPAID — 한지우 18:00 그룹 미결제
  {
    studentIdx: 11,
    scheduledAt: todayAt(18, 0),
    durationMinutes: 60,
    status: "CONFIRMED",
    paymentStatus: "UNPAID",
    lessonFormat: "GROUP",
    roundNumber: 1,
    totalRounds: 4,
  },
  // 16. UPCOMING + EXTERNAL — 최준혁 19:00 1:1 외부결제
  {
    studentIdx: 12,
    scheduledAt: todayAt(19, 0),
    durationMinutes: 60,
    status: "CONFIRMED",
    paymentStatus: "EXTERNAL",
    lessonFormat: "PRIVATE",
    roundNumber: 2,
    totalRounds: 10,
  },
];

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

    // 2. 기존 test lessons 정리 (test coach 의 오늘 데이터)
    const todayStart = todayAt(0, 0);
    const todayEnd = todayAt(23, 59);
    await prisma.$executeRaw`
      DELETE FROM lessons
      WHERE "coachId" = ${COACH_ID}::uuid
        AND "scheduledAt" >= ${todayStart}::timestamp
        AND "scheduledAt" <= ${todayEnd}::timestamp
    `;

    // 3. lessons 일괄 insert
    let inserted = 0;
    for (const l of LESSONS) {
      const student = STUDENTS[l.studentIdx];
      await prisma.$executeRaw`
        INSERT INTO lessons (
          "coachId", "studentId", "scheduledAt", "durationMinutes",
          "status", "paymentStatus", "lessonFormat",
          "roundNumber", "totalRounds",
          "originalScheduledAt", "splitIndex", "splitTotal",
          "notes", "createdAt", "updatedAt"
        ) VALUES (
          ${COACH_ID}::uuid,
          ${student.id}::uuid,
          ${l.scheduledAt}::timestamp,
          ${l.durationMinutes},
          ${l.status},
          ${l.paymentStatus},
          ${l.lessonFormat},
          ${l.roundNumber ?? null},
          ${l.totalRounds ?? null},
          ${l.originalScheduledAt ?? null}::timestamp,
          ${l.splitIndex ?? null},
          ${l.splitTotal ?? null},
          ${l.notes ?? null},
          NOW(),
          NOW()
        )
      `;
      inserted += 1;
    }

    // 4. 검증
    const count = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM lessons
      WHERE "coachId" = ${COACH_ID}::uuid
        AND "scheduledAt" >= ${todayStart}::timestamp
        AND "scheduledAt" <= ${todayEnd}::timestamp
    `;

    return NextResponse.json({
      ok: true,
      message: "test lessons 시드 완료",
      studentsUpserted: STUDENTS.length,
      lessonsInserted: inserted,
      lessonsTodayInDb: Number(count[0]?.count ?? 0),
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
