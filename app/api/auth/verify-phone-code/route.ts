import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  let body: { phone?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const phone = body.phone?.replace(/[^\d]/g, "");
  const code = body.code?.replace(/[^\d]/g, "");

  if (!phone || !code || code.length !== 6) {
    return NextResponse.json({ error: "6자리 인증번호를 입력해주세요" }, { status: 400 });
  }

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: number; code: string; expiresAt: Date; verifiedAt: Date | null; attemptCount: number }>
    >(
      `SELECT id, code, "expiresAt", "verifiedAt", "attemptCount" FROM phone_verifications WHERE phone = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      phone,
    );

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "먼저 인증번호를 요청해주세요" }, { status: 400 });
    }

    if (row.verifiedAt) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    if (row.attemptCount >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: "시도 횟수를 초과했어요. 인증번호를 다시 요청해주세요." }, { status: 429 });
    }

    if (new Date() > new Date(row.expiresAt)) {
      return NextResponse.json({ error: "인증번호가 만료되었어요. 다시 요청해주세요." }, { status: 400 });
    }

    if (row.code !== code) {
      await prisma.$executeRawUnsafe(
        `UPDATE phone_verifications SET "attemptCount" = "attemptCount" + 1, "updatedAt" = NOW() WHERE id = $1`,
        row.id,
      );
      const left = MAX_ATTEMPTS - (row.attemptCount + 1);
      return NextResponse.json(
        { error: left > 0 ? `인증번호가 일치하지 않아요 (남은 시도: ${left}회)` : "시도 횟수를 초과했어요. 인증번호를 다시 요청해주세요." },
        { status: 400 },
      );
    }

    await prisma.$executeRawUnsafe(
      `UPDATE phone_verifications SET "verifiedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
      row.id,
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[verify-phone-code] error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "검증 중 오류" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
