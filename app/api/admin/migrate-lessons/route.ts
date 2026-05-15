/**
 * lessons 테이블 마이그레이션 라우트 (일회성)
 *
 * 동작: lessons 테이블이 없으면 생성. 있으면 skip.
 * 토큰 인증.
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ONE_TIME_TOKEN = "courtside-migrate-lessons-2026-05-15-Tk8nVpQwYz";

async function runMigration(): Promise<NextResponse> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: "DATABASE_URL or DIRECT_URL not set" }, { status: 500 });
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    // 1. lessons 테이블 생성 (IF NOT EXISTS)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "lessons" (
        "id" SERIAL PRIMARY KEY,
        "coachId" UUID NOT NULL,
        "studentId" UUID NOT NULL,
        "scheduledAt" TIMESTAMP NOT NULL,
        "durationMinutes" INTEGER NOT NULL DEFAULT 60,
        "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
        "notes" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // 2. 인덱스 추가 (IF NOT EXISTS)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "lessons_coachId_scheduledAt_idx"
      ON "lessons" ("coachId", "scheduledAt")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "lessons_studentId_scheduledAt_idx"
      ON "lessons" ("studentId", "scheduledAt")
    `);

    // 2b. 확장 컬럼 추가 (스키마 확장 후 추가된 필드들 — 이미 있으면 skip)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "lessons"
        ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
        ADD COLUMN IF NOT EXISTS "lessonFormat" TEXT NOT NULL DEFAULT 'PRIVATE',
        ADD COLUMN IF NOT EXISTS "roundNumber" INTEGER,
        ADD COLUMN IF NOT EXISTS "totalRounds" INTEGER,
        ADD COLUMN IF NOT EXISTS "originalScheduledAt" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "originalLessonId" INTEGER,
        ADD COLUMN IF NOT EXISTS "parentLessonId" INTEGER,
        ADD COLUMN IF NOT EXISTS "splitIndex" INTEGER,
        ADD COLUMN IF NOT EXISTS "splitTotal" INTEGER
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "lessons_originalLessonId_idx" ON "lessons" ("originalLessonId")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "lessons_parentLessonId_idx" ON "lessons" ("parentLessonId")
    `);

    // 3. PostgREST 스키마 캐시 즉시 갱신
    await prisma.$executeRawUnsafe(`NOTIFY pgrst, 'reload schema'`);

    // 4. 검증
    const verify = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'lessons'
    `);

    return NextResponse.json({
      ok: true,
      message: "lessons 테이블 마이그레이션 + 스키마 캐시 갱신 완료",
      tableExists: verify.length > 0,
    });
  } catch (e) {
    console.error("[migrate-lessons] error:", e);
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
