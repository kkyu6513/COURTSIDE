/**
 * 일회성 테스트 시드 라우트 — 코치 알림 페이지 검증용 가짜 학생 등록요청 생성
 *
 * 동작:
 * - 호출자(로그인된 코치)의 user.id를 matchedCoachUserId로 사용
 * - 가짜 학생 user(랜덤 이름·전화) + PENDING student_self_claim row 추가
 * - 호출 시마다 새 claim 1건 생성
 *
 * 사용 후 삭제 예정. 토큰 + 코치 세션 이중 인증.
 */

import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ONE_TIME_TOKEN = "courtside-seed-test-claim-2026-05-15-Lp4mQzV9bR";

const FAKE_NAMES = [
  "김연우",
  "이태희",
  "박지민",
  "최서연",
  "정도윤",
  "한지수",
  "윤민재",
  "강하은",
  "송재훈",
  "임수아",
];

function randomKoreanPhone(): string {
  const tail = String(Math.floor(10_000_000 + Math.random() * 89_999_999));
  return `010${tail}`;
}

async function runSeed(coachUserId: string, coachName: string): Promise<NextResponse> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json(
      { error: "DATABASE_URL or DIRECT_URL not set" },
      { status: 500 },
    );
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    const studentId = randomUUID();
    const studentName = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
    const studentPhone = randomKoreanPhone();
    const studentEmail = `seed-student-${studentId.slice(0, 8)}@test.local`;

    // 1. 가짜 학생 users 행 (FK 없음 — 기존 seed-test-coach와 동일 패턴)
    await prisma.$executeRaw`
      INSERT INTO users (id, email, name, "realName", phone, role, "isActive", "createdAt", "updatedAt")
      VALUES (
        ${studentId}::uuid,
        ${studentEmail},
        ${studentName},
        ${studentName},
        ${studentPhone},
        'STUDENT',
        true,
        NOW(),
        NOW()
      )
    `;

    // 2. student_self_claims PENDING + 본인 코치 매칭
    const rows = await prisma.$queryRaw<Array<{ id: number }>>`
      INSERT INTO student_self_claims (
        "studentUserId", "claimedCoachName", "claimedCoachPhone",
        "matchedCoachUserId", status, "createdAt", "updatedAt"
      )
      VALUES (
        ${studentId}::uuid,
        ${coachName},
        '01000000000',
        ${coachUserId}::uuid,
        'PENDING',
        NOW(),
        NOW()
      )
      RETURNING id
    `;

    return NextResponse.json({
      ok: true,
      message: "가짜 학생 등록요청 생성 완료 — /coach/notifications에서 확인하세요",
      claimId: rows[0]?.id,
      student: {
        id: studentId,
        name: studentName,
        phone: studentPhone,
      },
    });
  } catch (e) {
    console.error("[seed-test-claim] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "시드 중 오류" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function authorize(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== ONE_TIME_TOKEN) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "코치로 로그인된 상태에서 호출하세요" }, { status: 401 }) };
  }

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") {
    return { error: NextResponse.json({ error: "코치 계정만 호출 가능" }, { status: 403 }) };
  }

  const coachName =
    (user.user_metadata?.nickname as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    "테스트 코치";

  return { user, coachName };
}

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if (auth.error) return auth.error;
  return runSeed(auth.user!.id, auth.coachName!);
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (auth.error) return auth.error;
  return runSeed(auth.user!.id, auth.coachName!);
}
