/**
 * 일회성 마이그레이션 라우트 — student_self_claims 테이블 생성 (2026-05-14)
 *
 * 사용 후 즉시 삭제 예정. 토큰 매칭 안 되면 거부.
 *
 * 호출: POST /api/admin/migrate-student-self-claims?token=courtside-claims-2026-05-14-bM4qV7zRsT
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ONE_TIME_TOKEN = "courtside-claims-2026-05-14-bM4qV7zRsT";

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS student_self_claims (
    id                   SERIAL PRIMARY KEY,
    "studentUserId"      UUID NOT NULL,
    "claimedCoachName"   TEXT NOT NULL,
    "claimedCoachPhone"  TEXT NOT NULL,
    "matchedCoachUserId" UUID,
    status               TEXT NOT NULL DEFAULT 'PENDING',
    "notifiedAt"         TIMESTAMPTZ,
    "notifyAttempts"     INTEGER NOT NULL DEFAULT 0,
    "notifyLastError"    TEXT,
    "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_claims_student ON student_self_claims("studentUserId")`,
  `CREATE INDEX IF NOT EXISTS idx_claims_matched ON student_self_claims("matchedCoachUserId")`,
  `CREATE INDEX IF NOT EXISTS idx_claims_phone ON student_self_claims("claimedCoachPhone")`,
];

async function runMigration(): Promise<NextResponse> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json(
      { error: "DATABASE_URL or DIRECT_URL not set" },
      { status: 500 },
    );
  }

  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });

  const results: { ok: boolean; statement: string; error?: string }[] = [];

  try {
    for (const stmt of STATEMENTS) {
      try {
        await prisma.$executeRawUnsafe(stmt);
        results.push({
          ok: true,
          statement: stmt.slice(0, 80).replace(/\s+/g, " ") + "...",
        });
      } catch (e) {
        results.push({
          ok: false,
          statement: stmt.slice(0, 80).replace(/\s+/g, " ") + "...",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const verify = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_tables WHERE tablename = 'student_self_claims'`,
    );

    return NextResponse.json({
      ok: true,
      results,
      tableExists: verify.length > 0,
    });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== ONE_TIME_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runMigration();
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== ONE_TIME_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runMigration();
}
