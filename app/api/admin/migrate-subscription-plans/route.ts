/**
 * 일회성 마이그레이션 라우트 — subscription_plans 테이블 생성 + Coach SaaS 시드 (2026-05-14)
 *
 * 사용 후 즉시 삭제 예정. 토큰 매칭 안 되면 거부.
 *
 * 호출: POST /api/admin/migrate-subscription-plans?token=courtside-migrate-2026-05-14-aXZpL3uK9q
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ONE_TIME_TOKEN = "courtside-migrate-2026-05-14-aXZpL3uK9q";

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS subscription_plans (
    id                  SERIAL PRIMARY KEY,
    code                TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    price               INTEGER NOT NULL,
    "billingCycle"      TEXT NOT NULL,
    "isBest"            BOOLEAN NOT NULL DEFAULT false,
    discount            TEXT,
    "ctaText"           TEXT NOT NULL,
    "ctaStyle"          TEXT NOT NULL,
    "sortOrder"         INTEGER NOT NULL DEFAULT 0,
    "isActive"          BOOLEAN NOT NULL DEFAULT true,
    "studentLimit"      INTEGER,
    "alimtalkLimit"     INTEGER,
    "hasStats"          BOOLEAN NOT NULL DEFAULT false,
    "hasMemberSearch"   BOOLEAN NOT NULL DEFAULT false,
    "hasCsvExport"      BOOLEAN NOT NULL DEFAULT false,
    "hasPrioritySupport" BOOLEAN NOT NULL DEFAULT false,
    "hasAutoRegular"    BOOLEAN NOT NULL DEFAULT false,
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS subscription_plan_features (
    id         SERIAL PRIMARY KEY,
    "planId"   INTEGER NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    code       TEXT NOT NULL,
    label      TEXT NOT NULL,
    enabled    BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_plan_features_plan_sort ON subscription_plan_features("planId", "sortOrder")`,
  `DELETE FROM subscription_plan_features`,
  `DELETE FROM subscription_plans`,
  `SELECT setval(pg_get_serial_sequence('subscription_plans', 'id'), 1, false)`,
  `SELECT setval(pg_get_serial_sequence('subscription_plan_features', 'id'), 1, false)`,
  // FREE
  `INSERT INTO subscription_plans
    (code, name, price, "billingCycle", "isBest", discount, "ctaText", "ctaStyle", "sortOrder",
     "studentLimit", "alimtalkLimit", "hasStats", "hasMemberSearch", "hasCsvExport", "hasPrioritySupport", "hasAutoRegular")
   VALUES
    ('FREE', '무료', 0, 'monthly', false, NULL, '무료로 시작', 'secondary', 1,
     3, 30, false, false, false, false, false)`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'STUDENT_3', '학생 3명까지 관리', true, 1 FROM subscription_plans WHERE code='FREE'`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'SCHEDULE', '스케줄 등록', true, 2 FROM subscription_plans WHERE code='FREE'`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'CHAT', '1:1 채팅', true, 3 FROM subscription_plans WHERE code='FREE'`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'ALIMTALK_30', '알림톡 월 30건', true, 4 FROM subscription_plans WHERE code='FREE'`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'AUTO_REGULAR', '정기 레슨 자동 생성', false, 5 FROM subscription_plans WHERE code='FREE'`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'STATS', '통계 대시보드', false, 6 FROM subscription_plans WHERE code='FREE'`,
  // MONTHLY
  `INSERT INTO subscription_plans
    (code, name, price, "billingCycle", "isBest", discount, "ctaText", "ctaStyle", "sortOrder",
     "studentLimit", "alimtalkLimit", "hasStats", "hasMemberSearch", "hasCsvExport", "hasPrioritySupport", "hasAutoRegular")
   VALUES
    ('MONTHLY', '월간 PRO', 24900, 'monthly', true, '🔥 첫 3개월 ₩9,900 (60% 할인)',
     'PRO 시작하기', 'primary', 2,
     NULL, NULL, true, true, false, false, true)`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'STUDENT_UNLIMITED', '학생 무제한 관리', true, 1 FROM subscription_plans WHERE code='MONTHLY'`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'ALIMTALK_UNLIMITED', '알림톡 무제한 발송', true, 2 FROM subscription_plans WHERE code='MONTHLY'`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'AUTO_REGULAR', '정기 레슨 자동 생성', true, 3 FROM subscription_plans WHERE code='MONTHLY'`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'STATS', '통계 대시보드 (매출·출석·회차)', true, 4 FROM subscription_plans WHERE code='MONTHLY'`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'MEMBER_SEARCH', '회원 검색·정렬', true, 5 FROM subscription_plans WHERE code='MONTHLY'`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'PRO_BADGE', 'PRO 배지 부여', true, 6 FROM subscription_plans WHERE code='MONTHLY'`,
  // YEARLY
  `INSERT INTO subscription_plans
    (code, name, price, "billingCycle", "isBest", discount, "ctaText", "ctaStyle", "sortOrder",
     "studentLimit", "alimtalkLimit", "hasStats", "hasMemberSearch", "hasCsvExport", "hasPrioritySupport", "hasAutoRegular")
   VALUES
    ('YEARLY', '연간 PRO', 16900, 'monthly', false, '32% 할인 — 연 ₩202,800',
     '연간 플랜 선택', 'secondary', 3,
     NULL, NULL, true, true, true, true, true)`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'ALL_MONTHLY', '월간 PRO 전체 기능', true, 1 FROM subscription_plans WHERE code='YEARLY'`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'CSV_EXPORT', '레슨 이력 CSV 내보내기', true, 2 FROM subscription_plans WHERE code='YEARLY'`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'PRIORITY_SUPPORT', '우선 고객 지원 (카톡 1:1)', true, 3 FROM subscription_plans WHERE code='YEARLY'`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'VERIFY_PRIORITY', '인증 배지 우선 심사', true, 4 FROM subscription_plans WHERE code='YEARLY'`,
  `INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder")
   SELECT id, 'ANNUAL_BADGE', 'ANNUAL 배지 부여', true, 5 FROM subscription_plans WHERE code='YEARLY'`,
];

async function runMigration(): Promise<NextResponse> {
  // DIRECT_URL이 있으면 pgbouncer 우회. 없으면 DATABASE_URL.
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
        results.push({ ok: true, statement: stmt.slice(0, 80).replace(/\s+/g, " ") + "..." });
      } catch (e) {
        results.push({
          ok: false,
          statement: stmt.slice(0, 80).replace(/\s+/g, " ") + "...",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const plans = await prisma.$queryRawUnsafe<
      Array<{ code: string; name: string; price: number; feature_count: bigint }>
    >(`
      SELECT p.code, p.name, p.price,
        (SELECT COUNT(*) FROM subscription_plan_features WHERE "planId" = p.id) AS feature_count
      FROM subscription_plans p
      ORDER BY p."sortOrder"
    `);

    return NextResponse.json({
      ok: true,
      results,
      plans: plans.map((p) => ({ ...p, feature_count: Number(p.feature_count) })),
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
