/**
 * lessons.paymentStatus 컬럼 default 'PAID' → 'UNPAID' 변경.
 * 기존 row 값은 보존, 신규 row만 UNPAID로 시작.
 *
 * 스펙(`docs/02-design/business-logic.md §3.7 결제 상태 정책`)과 일치시키는 일회성 마이그레이션.
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ONE_TIME_TOKEN = "courtside-payment-default-2026-05-15-Wt9xZqRk3p";

async function runMigration(): Promise<NextResponse> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    // 1. 컬럼 default 변경
    await prisma.$executeRawUnsafe(
      `ALTER TABLE lessons ALTER COLUMN "paymentStatus" SET DEFAULT 'UNPAID'`,
    );

    // 2. 검증 — 현재 default 확인
    const rows = await prisma.$queryRawUnsafe<Array<{ column_default: string }>>(
      `SELECT column_default FROM information_schema.columns
       WHERE table_name = 'lessons' AND column_name = 'paymentStatus'`,
    );
    return NextResponse.json({
      ok: true,
      message: "lessons.paymentStatus default → UNPAID",
      currentDefault: rows[0]?.column_default ?? null,
    });
  } catch (e) {
    console.error("[migrate-payment-default] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "마이그레이션 중 오류" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== ONE_TIME_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runMigration();
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== ONE_TIME_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runMigration();
}
