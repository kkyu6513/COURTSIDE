import { PrismaClient } from "@prisma/client";

/**
 * 전화번호가 최근 인증 완료된 상태인지 확인.
 * phone_verifications.verifiedAt이 존재하면 true.
 */
export async function isPhoneVerified(phone: string): Promise<boolean> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return false;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ verifiedAt: Date | null }>>(
      `SELECT "verifiedAt" FROM phone_verifications WHERE phone = $1 AND "verifiedAt" IS NOT NULL ORDER BY "verifiedAt" DESC LIMIT 1`,
      phone,
    );
    return !!rows[0]?.verifiedAt;
  } finally {
    await prisma.$disconnect();
  }
}
