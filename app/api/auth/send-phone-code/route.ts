import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { sendSms, buildPhoneVerifyMessage, generatePhoneCode } from "@/lib/notification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

const CODE_TTL_MS = 3 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_PER_HOUR = 5;

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const phone = body.phone?.replace(/[^\d]/g, "");
  if (!phone || phone.length < 10 || phone.length > 11) {
    return NextResponse.json({ error: "10~11자리 숫자로 입력해주세요" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `SELECT COUNT(*) AS cnt FROM phone_verifications WHERE phone = $1 AND "createdAt" > $2`,
      phone,
      oneHourAgo,
    );
    if (Number(recentCount[0]?.cnt ?? 0) >= MAX_PER_HOUR) {
      return NextResponse.json(
        { error: "이 번호의 요청이 너무 많아요. 1시간 후 다시 시도하거나 고객센터에 문의해 주세요." },
        { status: 429 },
      );
    }

    const last = await prisma.$queryRawUnsafe<Array<{ createdAt: Date }>>(
      `SELECT "createdAt" FROM phone_verifications WHERE phone = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      phone,
    );
    if (last[0]) {
      const elapsed = Date.now() - new Date(last[0].createdAt).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return NextResponse.json({ error: `${wait}초 후 다시 시도해주세요` }, { status: 429 });
      }
    }

    const code = generatePhoneCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    await prisma.$executeRawUnsafe(
      `INSERT INTO phone_verifications (phone, code, "expiresAt", ip, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      phone,
      code,
      expiresAt,
      ip,
    );

    const send = await sendSms(phone, buildPhoneVerifyMessage(code));

    if (!send.ok && !send.skipped) {
      return NextResponse.json({ error: `SMS 발송 실패: ${send.error}` }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      ttlSeconds: Math.floor(CODE_TTL_MS / 1000),
      sent: send.ok,
      devMode: !!send.skipped,
      ...(send.skipped ? { devCode: code } : {}),
    });
  } catch (e) {
    console.error("[send-phone-code] error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "발송 중 오류" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
