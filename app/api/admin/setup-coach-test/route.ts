/**
 * 일회성 테스트 셋업 라우트 — 한 번 호출로 코치 + 가짜 학생 등록요청 일괄 생성
 *
 * 동작:
 * 1. 로그인된 현재 user → role=COACH로 전환 (app_metadata + public.users)
 * 2. coach_profiles 없으면 자동 생성 (기본값)
 * 3. 가짜 학생 2건 + matched PENDING claim 2건 생성
 *
 * 사용 후 라우트 삭제 예정. 토큰 인증.
 */

import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ONE_TIME_TOKEN = "courtside-setup-coach-test-2026-05-15-Hk7nMpRsTw";

const FAKE_STUDENTS = [
  { name: "김연우", coach: "박지훈 코치" },
  { name: "이태희", coach: "최서연 코치" },
];

function randomKoreanPhone(): string {
  const tail = String(Math.floor(10_000_000 + Math.random() * 89_999_999));
  return `010${tail}`;
}

async function runSetup(userId: string, userEmail: string, userName: string): Promise<NextResponse> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json(
      { error: "DATABASE_URL or DIRECT_URL not set" },
      { status: 500 },
    );
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const admin = createAdminClient();

  try {
    // 1. supabase auth app_metadata에 role=COACH + plan=FREE 설정 (세션에 반영)
    const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { role: "COACH", plan: "FREE" },
    });
    if (metaError) {
      return NextResponse.json({ error: `app_metadata: ${metaError.message}` }, { status: 500 });
    }

    // 2. public.users 행 upsert + role=COACH
    await prisma.$executeRaw`
      INSERT INTO users (id, email, name, "realName", role, "isActive", "createdAt", "updatedAt")
      VALUES (
        ${userId}::uuid,
        ${userEmail},
        ${userName},
        ${userName},
        'COACH',
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        role = 'COACH',
        name = COALESCE(EXCLUDED.name, users.name),
        "realName" = COALESCE(EXCLUDED."realName", users."realName"),
        "updatedAt" = NOW()
    `;

    // 3. coach_profiles 없으면 생성
    await prisma.$executeRaw`
      INSERT INTO coach_profiles (
        "userId", bio, gender, "priceVisibility", "areaSido", "areaSigungu",
        "averageRating", "reviewCount", "bookingCount", "isVerified", "createdAt", "updatedAt"
      )
      VALUES (
        ${userId}::uuid,
        '테스트 셋업으로 자동 생성된 코치 프로필입니다.',
        'MALE',
        'PRIVATE',
        '서울특별시',
        '강남구',
        0, 0, 0, false, NOW(), NOW()
      )
      ON CONFLICT ("userId") DO NOTHING
    `;

    // 4. 가짜 학생 user 2건 + claim 2건 생성
    const created: Array<{ studentName: string; studentPhone: string; claimId: number }> = [];
    for (const fake of FAKE_STUDENTS) {
      const studentId = randomUUID();
      const studentPhone = randomKoreanPhone();
      const studentEmail = `seed-student-${studentId.slice(0, 8)}@test.local`;

      await prisma.$executeRaw`
        INSERT INTO users (id, email, name, "realName", phone, role, "isActive", "createdAt", "updatedAt")
        VALUES (
          ${studentId}::uuid,
          ${studentEmail},
          ${fake.name},
          ${fake.name},
          ${studentPhone},
          'STUDENT',
          true,
          NOW(),
          NOW()
        )
      `;

      const rows = await prisma.$queryRaw<Array<{ id: number }>>`
        INSERT INTO student_self_claims (
          "studentUserId", "claimedCoachName", "claimedCoachPhone",
          "matchedCoachUserId", status, "createdAt", "updatedAt"
        )
        VALUES (
          ${studentId}::uuid,
          ${fake.coach},
          '01000000000',
          ${userId}::uuid,
          'PENDING',
          NOW(),
          NOW()
        )
        RETURNING id
      `;
      created.push({
        studentName: fake.name,
        studentPhone,
        claimId: rows[0]?.id ?? -1,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "코치 테스트 셋업 완료 — /coach/notifications에서 확인하세요",
      coach: {
        userId,
        role: "COACH",
        plan: "FREE",
      },
      claims: created,
      next: "/coach/notifications",
      note: "세션 갱신을 위해 로그아웃 후 다시 로그인해주세요. 또는 페이지를 새로고침하면 새 role이 반영됩니다.",
    });
  } catch (e) {
    console.error("[setup-coach-test] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "셋업 중 오류" },
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
    return {
      error: NextResponse.json(
        { error: "먼저 카카오 로그인하세요. 학생/코치 어떤 역할이든 한 번만 로그인되면 됩니다." },
        { status: 401 },
      ),
    };
  }

  const userName =
    (user.user_metadata?.nickname as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    "테스트 코치";

  return { userId: user.id, userEmail: user.email!, userName };
}

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if (auth.error) return auth.error;
  return runSetup(auth.userId!, auth.userEmail!, auth.userName!);
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (auth.error) return auth.error;
  return runSetup(auth.userId!, auth.userEmail!, auth.userName!);
}
