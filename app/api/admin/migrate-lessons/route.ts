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

    // 3. 검증
    const verify = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'lessons'
    `);

    return NextResponse.json({
      ok: true,
      message: "lessons 테이블 마이그레이션 완료",
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
