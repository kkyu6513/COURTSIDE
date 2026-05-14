/**
 * 일회성 테스트 시드 라우트 — 더미 코치 "홍길동 / 01012345678" 생성
 * 학생 홈의 코치 등록 요청 기능 매칭 성공 케이스 검증용.
 *
 * 사용 후 삭제 예정. 토큰 매칭 안 되면 401.
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ONE_TIME_TOKEN = "courtside-seed-test-coach-2026-05-14-Zx9wKpQrT4";

// 고정 UUID (재실행해도 동일 행 하나만 존재 보장)
const TEST_COACH_USER_ID = "00000000-0000-4000-8000-000000000001";
const TEST_COACH_NAME = "홍길동";
const TEST_COACH_PHONE = "01012345678";
const TEST_COACH_EMAIL = "hong-test@courtside.local";

async function runSeed(): Promise<NextResponse> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json(
      { error: "DATABASE_URL or DIRECT_URL not set" },
      { status: 500 },
    );
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    // 1. users 테이블에 더미 코치 삽입 (ON CONFLICT 업서트)
    const userResult = await prisma.$executeRaw`
      INSERT INTO users (id, email, name, "realName", phone, role, "isActive", "createdAt", "updatedAt")
      VALUES (
        ${TEST_COACH_USER_ID}::uuid,
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

    // 2. coach_profiles 삽입 (선택, 그러나 일관성 위해 추가)
    const profileResult = await prisma.$executeRaw`
      INSERT INTO coach_profiles (
        "userId", bio, gender, "priceVisibility", "areaSido", "areaSigungu",
        "averageRating", "reviewCount", "bookingCount", "isVerified", "createdAt", "updatedAt"
      )
      VALUES (
        ${TEST_COACH_USER_ID}::uuid,
        '테스트용 더미 코치입니다. 매칭 검증 용도.',
        'MALE',
        'PRIVATE',
        '서울특별시',
        '강남구',
        0, 0, 0, false, NOW(), NOW()
      )
      ON CONFLICT ("userId") DO NOTHING
    `;

    // 3. 확인 조회
    const verify = await prisma.$queryRaw<
      Array<{ id: string; name: string | null; phone: string | null; role: string | null }>
    >`
      SELECT id, name, phone, role::text AS role
      FROM users WHERE id = ${TEST_COACH_USER_ID}::uuid
    `;

    return NextResponse.json({
      ok: true,
      message: "테스트 코치 (홍길동 / 01012345678) 시드 완료",
      userInsertedRows: userResult,
      profileInsertedRows: profileResult,
      verify: verify[0],
    });
  } catch (e) {
    console.error("[seed-test-coach] error:", e);
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
