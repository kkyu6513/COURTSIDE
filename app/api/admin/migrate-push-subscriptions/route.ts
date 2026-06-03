/**
 * push_subscriptions 테이블 마이그레이션 (일회성)
 *
 * 사용자별 웹 푸시 구독 정보 저장.
 * 한 사용자가 여러 기기/브라우저에서 구독 가능 → endpoint 기준 unique.
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ONE_TIME_TOKEN = "courtside-migrate-push-2026-06-15-Wd4kRzQpHn";

async function runMigration(): Promise<NextResponse> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: "DATABASE_URL or DIRECT_URL not set" }, { status: 500 });
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "push_subscriptions" (
        "id" SERIAL PRIMARY KEY,
        "userId" UUID NOT NULL,
        "endpoint" TEXT NOT NULL UNIQUE,
        "p256dh" TEXT NOT NULL,
        "auth" TEXT NOT NULL,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "lastUsedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "push_subscriptions_userId_idx"
      ON "push_subscriptions" ("userId")
    `);

    const verify = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`
      SELECT COUNT(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'push_subscriptions'
    `);

    return NextResponse.json({
      ok: true,
      message: "push_subscriptions 테이블 마이그레이션 완료",
      tableExists: verify.length > 0 && verify[0].count > 0,
    });
  } catch (e) {
    console.error("[migrate-push-subscriptions] error:", e);
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
