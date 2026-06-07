/**
 * coach_messages 테이블에 양방향 메시지 지원 컬럼 추가
 *
 * - senderRole: COACH | STUDENT (누가 보냈는지)
 * - senderId: 발신자 user.id (FK 없음, soft 참조)
 *
 * 기존 row 는 senderRole='COACH', senderId=coachId 로 backfill.
 * 코드 호환을 유지하면서 양방향 대화 가능.
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ONE_TIME_TOKEN = "courtside-migrate-message-sender-2026-06-07-Wq8nBpJzKx";

async function runMigration(): Promise<NextResponse> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: "DATABASE_URL or DIRECT_URL not set" }, { status: 500 });
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    // 1. senderRole / senderId 컬럼 추가 (IF NOT EXISTS)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "coach_messages"
      ADD COLUMN IF NOT EXISTS "senderRole" TEXT NOT NULL DEFAULT 'COACH'
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "coach_messages"
      ADD COLUMN IF NOT EXISTS "senderId" UUID
    `);

    // 2. 기존 row backfill — 코치가 보낸 것으로 처리 (senderId=coachId)
    await prisma.$executeRawUnsafe(`
      UPDATE "coach_messages"
      SET "senderId" = "coachId"
      WHERE "senderId" IS NULL
    `);

    // 3. 대화방 조회용 복합 인덱스 — (coachId, studentId, createdAt DESC)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "coach_messages_pair_createdAt_idx"
      ON "coach_messages" ("coachId", "studentId", "createdAt" DESC)
    `);

    // PostgREST 스키마 캐시 즉시 리로드
    await prisma.$executeRawUnsafe(`NOTIFY pgrst, 'reload schema'`);

    // 검증 — 컬럼 목록
    const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'coach_messages'
      ORDER BY ordinal_position
    `);

    return NextResponse.json({
      ok: true,
      message: "coach_messages 양방향 컬럼 추가 + backfill 완료",
      columns: cols.map((c) => c.column_name),
    });
  } catch (e) {
    console.error("[migrate-message-sender] error:", e);
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
