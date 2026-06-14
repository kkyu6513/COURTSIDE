/**
 * coach_invites 테이블 마이그레이션
 *
 * 코치가 수강생을 직접 등록할 때 발급되는 초대 코드.
 * 학생이 이 코드로 가입하면 자동으로 해당 코치와 매칭됨.
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ONE_TIME_TOKEN = "courtside-migrate-coach-invites-2026-06-14-Vp9xTjBnQz";

async function runMigration(): Promise<NextResponse> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: "DATABASE_URL or DIRECT_URL not set" }, { status: 500 });
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "coach_invites" (
        "id" SERIAL PRIMARY KEY,
        "code" TEXT NOT NULL UNIQUE,
        "coachId" UUID NOT NULL,
        "studentName" TEXT NOT NULL,
        "studentPhone" TEXT,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "usedAt" TIMESTAMP,
        "usedByUserId" UUID
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "coach_invites_coachId_createdAt_idx"
      ON "coach_invites" ("coachId", "createdAt" DESC)
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "coach_invites_code_idx"
      ON "coach_invites" ("code")
    `);

    await prisma.$executeRawUnsafe(`NOTIFY pgrst, 'reload schema'`);

    const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'coach_invites'
      ORDER BY ordinal_position
    `);

    return NextResponse.json({
      ok: true,
      message: "coach_invites 테이블 생성 완료",
      columns: cols.map((c) => c.column_name),
    });
  } catch (e) {
    console.error("[migrate-coach-invites] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "마이그레이션 중 오류" },
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
  return runMigration();
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== ONE_TIME_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runMigration();
}
