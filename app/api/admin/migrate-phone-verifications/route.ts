/**
 * 일회성 마이그레이션 라우트 — phone_verifications 테이블 생성 (2026-05-14)
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ONE_TIME_TOKEN = "courtside-phoneverif-2026-05-14-Hk8nP3qLwR";

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS phone_verifications (
    id            SERIAL PRIMARY KEY,
    phone         TEXT NOT NULL,
    code          TEXT NOT NULL,
    "expiresAt"   TIMESTAMPTZ NOT NULL,
    "verifiedAt"  TIMESTAMPTZ,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    ip            TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_phoneverif_phone_created ON phone_verifications(phone, "createdAt")`,
];

async function runMigration(): Promise<NextResponse> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: "DATABASE_URL or DIRECT_URL not set" }, { status: 500 });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const results: { ok: boolean; statement: string; error?: string }[] = [];

  try {
    for (const stmt of STATEMENTS) {
      try {
        await prisma.$executeRawUnsafe(stmt);
        results.push({ ok: true, statement: stmt.slice(0, 80).replace(/\s+/g, " ") + "..." });
      } catch (e) {
        results.push({ ok: false, statement: stmt.slice(0, 80).replace(/\s+/g, " ") + "...", error: e instanceof Error ? e.message : String(e) });
      }
    }

    const verify = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_tables WHERE tablename = 'phone_verifications'`,
    );

    return NextResponse.json({ ok: true, results, tableExists: verify.length > 0 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== ONE_TIME_TOKEN) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runMigration();
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== ONE_TIME_TOKEN) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runMigration();
}
