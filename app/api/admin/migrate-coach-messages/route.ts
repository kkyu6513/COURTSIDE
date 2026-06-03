/**
 * coach_messages 테이블 마이그레이션 (일회성)
 *
 * 코치 → 학생 인앱 메시지(읽기 전용 정보 메시지)
 * 예: 가능 시간 안내, 일정 공지 등
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ONE_TIME_TOKEN = "courtside-migrate-coach-messages-2026-06-15-Mq9zPtKxBd";

async function runMigration(): Promise<NextResponse> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: "DATABASE_URL or DIRECT_URL not set" }, { status: 500 });
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "coach_messages" (
        "id" SERIAL PRIMARY KEY,
        "coachId" UUID NOT NULL,
        "studentId" UUID NOT NULL,
        "content" TEXT NOT NULL,
        "kind" TEXT NOT NULL DEFAULT 'AVAILABILITY',
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "readAt" TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "coach_messages_studentId_createdAt_idx"
      ON "coach_messages" ("studentId", "createdAt" DESC)
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "coach_messages_coachId_createdAt_idx"
      ON "coach_messages" ("coachId", "createdAt" DESC)
    `);

    // PostgREST 스키마 캐시 리로드 (실패해도 무시)
    try {
      const admin = createAdminClient();
      await admin.rpc("pgrst_reload" as never);
    } catch {
      /* 스키마 캐시 자동 갱신은 PostgREST가 곧 처리 */
    }

    const verify = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`
      SELECT COUNT(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'coach_messages'
    `);

    return NextResponse.json({
      ok: true,
      message: "coach_messages 테이블 마이그레이션 완료",
      tableExists: verify.length > 0 && verify[0].count > 0,
    });
  } catch (e) {
    console.error("[migrate-coach-messages] error:", e);
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
