/**
 * 일회성 마이그레이션 라우트 — users.realName/birthDate 컴럼 + Terms/TermsVersion/UserTermsAgreement 테이블 + 약관 seed
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ONE_TIME_TOKEN = "courtside-terms-2026-05-14-Rk9wXt7vMpQz";

const TOU_CONTENT = `# 이용약관

제1조 (목적) 본 약관은 COURTSIDE(이하 "회사")가 제공하는 코치 SaaS 서비스(이하 "서비스")의 이용과 관련한 제반 사항을 규정함을 목적으로 합니다.

제2조 (서비스 이용) 회원은 회사가 제공하는 서비스를 제3자에게 양도·대여·담보 제공 등을 할 수 없으며, 최종 이용자는 본인으로 제한됩니다.

제3조 (계정 관리) 회원은 자신의 계정 정보(카카오 소셜 로그인, 전화번호 인증 등)을 안전하게 관리해야 하며, 계정 도용·방치로 인한 피해는 회사가 책임지지 않습니다.

제4조 (서비스 제공 범위) 회사는 코치 프로필·스케줄·레슨 관리·채팅·알림톡·결제 제공 등의 기능을 제공합니다. 일부 기능은 유료 구독 회원(PRO)에게만 제공될 수 있습니다.

제5조 (서비스 이용 제한) 다음 경우 서비스 이용이 제한될 수 있습니다: 타인 정보 도용, 결제 부정, 운영 방해, 허위 정보 등록, 법령 위반.

제6조 (계약의 해지) 회원은 언제든 마이페이지에서 탈퇴를 신청할 수 있으며, 탈퇴 시 개인정보는 처리방침에 따라 파기됩니다.

제7조 (책임 제한) 코치-학생 간 레슨 결제·관계는 당사자 간 직접 이루어지며, 회사는 이와 관련된 직접적 손해 발생 시 중개 서비스 제공자로서의 합리적 범위 내에서만 책임을 부담합니다.

제8조 (약관의 개정) 회사는 필요 시 약관을 개정할 수 있으며, 개정 시 시행일 7일 이전에 공지합니다. 계속 이용 시 개정 약관에 동의한 것으로 간주합니다.

제9조 (준거법) 본 약관은 대한민국 법령을 준거법으로 하며, 분쟁 시 서울중앙지방법원을 관할 법원으로 합니다.

부칙: 본 약관은 2026년 5월 14일부터 시행됩니다.`;

const PRIVACY_CONTENT = `# 개인정보 처리방침

COURTSIDE(이하 "회사")는 개인정보보호법을 준수하며 회원의 개인정보를 다음과 같이 수집·이용·보관합니다.

## 1. 수집하는 개인정보 항목

- 필수: 이름(실명), 생년월일, 전화번호, 이메일, 카카오 소셜아이디, 성별, 연령대
- 선택: NTRP 레벨, 레슨 목표, 선호 시간대, 프로필 이미지
- 자동 수집: 접속 로그, 이용 기록, IP 주소, 기기 정보

## 2. 수집·이용 목적

- 회원 가입 및 관리 (본인 확인, 서비스 제공)
- 코치-학생 매칭·레슨 수행·일정 관리
- 알림톡·SMS·이메일 발송 (서비스 안내)
- 결제 제공 및 부정 이용 방지
- 분쟁 해결 및 민원 처리

## 3. 보유·이용 기간

원칙적으로 회원 탈퇴 시 지체 없이 파기. 다음 경우 예외:

- 계약/청약 철회, 대금결제 및 재화 공급 기록: 5년 (전자상거래법)
- 소비자 불만 또는 분쟁처리 기록: 3년 (전자상거래법)
- 웹사이트 방문 기록: 3개월 (통신비밀보호법)

## 4. 제3자 제공

원칙적으로 제공하지 않으며, 아래 경우에 한해 제공합니다:

- 회원 사전 동의 시
- 수사·재판 대응 등 법령 의무 이행 시

## 5. 개인정보 처리 위탁

회사는 서비스 제공을 위해 다음과 같이 개인정보를 위탁하고 있습니다:

- Supabase (DB 운영, 인증)
- Solapi (SMS·알림톡 발송)
- Vercel (서버 운영)
- 토스페이먼츠 (결제 처리)

## 6. 이용자 권리

회원은 언제든 개인정보 조회·수정·삭제를 요청할 수 있으며, 이는 마이페이지 또는 고객센터를 통해 가능합니다.

## 7. 마스킹·안전 조치

회사는 이름·전화번호·이메일 등 개인식별정보를 타 회원 당사자·관리자 디폴트 화면에서 마스킹하여 노출하며, 본인 또는 직접 연결된 코치에게만 원본을 노출합니다.

## 8. 개인정보 보호책임자

- 이메일: privacy@courtside.local (서비스 자체 고객센터를 통해 문의)

부칙: 본 처리방침은 2026년 5월 14일부터 시행됩니다.`;

const MARKETING_CONTENT = `# 마케팅 수신 동의 (선택)

COURTSIDE는 회원님께 도움이 될 수 있는 이벤트·프로모션·서비스 이용 팁 정보를 알림톡, SMS, 이메일로 보내드리고자 합니다.

## 동의 재항

- 수집 항목: 전화번호, 이메일
- 이용 목적: 이벤트·절액·신장 안내
- 보유 기간: 동의 철회 시까지

## 철회 방법

언제든 마이페이지 → 알림 설정에서 마케팅 수신을 끌 수 있습니다. 동의를 거부하셔도 서비스 이용에 제한이 없습니다.

부칙: 본 동의는 선택 항목입니다.`;

const STATEMENTS: { sql: string; params?: unknown[] }[] = [
  { sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS "realName" TEXT` },
  { sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS "birthDate" DATE` },
  {
    sql: `CREATE TABLE IF NOT EXISTS terms (
      id          SERIAL PRIMARY KEY,
      code        TEXT UNIQUE NOT NULL,
      title       TEXT NOT NULL,
      "isRequired" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder"  INTEGER NOT NULL DEFAULT 0,
      "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS terms_versions (
      id             SERIAL PRIMARY KEY,
      "termsId"      INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
      version        TEXT NOT NULL,
      content        TEXT NOT NULL,
      "effectiveDate" DATE NOT NULL,
      "isActive"     BOOLEAN NOT NULL DEFAULT false,
      "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  },
  { sql: `CREATE INDEX IF NOT EXISTS idx_terms_versions ON terms_versions("termsId", "isActive")` },
  {
    sql: `CREATE TABLE IF NOT EXISTS user_terms_agreements (
      id              SERIAL PRIMARY KEY,
      "userId"        UUID NOT NULL,
      "termsVersionId" INTEGER NOT NULL REFERENCES terms_versions(id) ON DELETE CASCADE,
      "agreedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip              TEXT,
      UNIQUE("userId", "termsVersionId")
    )`,
  },
  { sql: `CREATE INDEX IF NOT EXISTS idx_uta_user ON user_terms_agreements("userId")` },
  // Seed Terms
  {
    sql: `INSERT INTO terms (code, title, "isRequired", "sortOrder") VALUES
      ('TERMS_OF_USE', '이용약관', true, 1),
      ('PRIVACY_POLICY', '개인정보 처리방침', true, 2),
      ('MARKETING_CONSENT', '마케팅 수신 동의', false, 3)
      ON CONFLICT (code) DO NOTHING`,
  },
];

async function runMigration(): Promise<NextResponse> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: "DATABASE_URL or DIRECT_URL not set" }, { status: 500 });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const results: { ok: boolean; statement: string; error?: string }[] = [];

  try {
    for (const { sql, params } of STATEMENTS) {
      try {
        if (params) await prisma.$executeRawUnsafe(sql, ...params);
        else await prisma.$executeRawUnsafe(sql);
        results.push({ ok: true, statement: sql.slice(0, 80).replace(/\s+/g, " ") + "..." });
      } catch (e) {
        results.push({ ok: false, statement: sql.slice(0, 80).replace(/\s+/g, " ") + "...", error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Seed TermsVersion content (각 코드별 v1.0)
    const seedVersions: { code: string; content: string }[] = [
      { code: "TERMS_OF_USE", content: ${JSON.stringify(TOU_CONTENT)} },
      { code: "PRIVACY_POLICY", content: ${JSON.stringify(PRIVACY_CONTENT)} },
      { code: "MARKETING_CONSENT", content: ${JSON.stringify(MARKETING_CONTENT)} },
    ];

    for (const sv of seedVersions) {
      try {
        await prisma.$executeRaw`
          INSERT INTO terms_versions ("termsId", version, content, "effectiveDate", "isActive")
          SELECT id, '1.0', ${sv.content}, '2026-05-14'::date, true
          FROM terms WHERE code = ${sv.code}
          AND NOT EXISTS (SELECT 1 FROM terms_versions tv WHERE tv."termsId" = terms.id AND tv.version = '1.0')
        `;
        results.push({ ok: true, statement: `seed version: ${sv.code} v1.0` });
      } catch (e) {
        results.push({ ok: false, statement: `seed version: ${sv.code} v1.0`, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const verify = await prisma.$queryRawUnsafe<Array<{ code: string; cnt: bigint }>>(
      `SELECT t.code, COUNT(tv.id) AS cnt
       FROM terms t LEFT JOIN terms_versions tv ON tv."termsId" = t.id AND tv."isActive" = true
       GROUP BY t.code`,
    );

    return NextResponse.json({
      ok: true,
      results,
      activeVersions: verify.map((v) => ({ code: v.code, count: Number(v.cnt) })),
    });
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
