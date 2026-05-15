/**
 * lessons 테이블에 상태 케이스용 컬럼 추가 (idempotent)
 *
 * 단계 1 — 코치 홈 12종 상태 카드를 실 데이터로 렌더하기 위한 필드 확장.
 * 토큰 인증.
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ONE_TIME_TOKEN = "courtside-migrate-lesson-fields-2026-05-15-Mp4xJ8wQzN";

const ALTERS: string[] = [
  `ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "paymentStatus"       TEXT      NOT NULL DEFAULT 'PAID'`,
  `ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "lessonFormat"        TEXT      NOT NULL DEFAULT 'PRIVATE'`,
  `ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "roundNumber"         INTEGER`,
  `ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "totalRounds"         INTEGER`,
  `ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "originalScheduledAt" TIMESTAMP`,
  `ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "originalLessonId"    INTEGER`,
  `ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "parentLessonId"      INTEGER`,
  `ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "splitIndex"          INTEGER`,
  `ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "splitTotal"          INTEGER`,
];

const INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS "lessons_originalLessonId_idx" ON "lessons" ("originalLessonId")`,
  `CREATE INDEX IF NOT EXISTS "lessons_parentLessonId_idx"   ON "lessons" ("parentLessonId")`,
];

async function runMigration(): Promise<NextResponse> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: "DATABASE_URL or DIRECT_URL not set" }, { status: 500 });
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    const applied: string[] = [];
    for (const sql of ALTERS) {
      await prisma.$executeRawUnsafe(sql);
      applied.push(sql);
    }
    for (const sql of INDEXES) {
      await prisma.$executeRawUnsafe(sql);
      applied.push(sql);
    }

    // PostgREST 스키마 캐시 즉시 갱신
    await prisma.$executeRawUnsafe(`NOTIFY pgrst, 'reload schema'`);

    // 검증 — lessons 컬럼 목록
    const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string }>>(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'lessons'
      ORDER BY ordinal_position
    `);

    return NextResponse.json({
      ok: true,
      message: "lessons 컬럼 확장 + 스키마 캐시 갱신 완료",
      appliedStatementsCount: applied.length,
      columns: cols,
    });
  } catch (e) {
    console.error("[migrate-lesson-fields] error:", e);
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
