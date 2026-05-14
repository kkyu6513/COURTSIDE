import { PrismaClient } from "@prisma/client";

export type ActiveTerm = {
  termsId: number;
  code: string;
  title: string;
  isRequired: boolean;
  sortOrder: number;
  versionId: number;
  version: string;
  content: string;
};

/**
 * 활성 약관 목록 조회 (코드별 가장 최근 활성 버전 1건).
 * 서버 전용.
 */
export async function getActiveTerms(): Promise<ActiveTerm[]> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return [];
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const rows = await prisma.$queryRawUnsafe<ActiveTerm[]>(
      `SELECT t.id AS "termsId",
              t.code,
              t.title,
              t."isRequired",
              t."sortOrder",
              tv.id AS "versionId",
              tv.version,
              tv.content
       FROM terms t
       INNER JOIN terms_versions tv
         ON tv."termsId" = t.id AND tv."isActive" = true
       ORDER BY t."sortOrder" ASC`,
    );
    return rows;
  } catch (e) {
    console.error("[getActiveTerms] error:", e);
    return [];
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 사용자의 약관 동의 이력 저장 (server action 내부에서 호출).
 */
export async function saveUserTermsAgreements(
  userId: string,
  termsVersionIds: number[],
  ip: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (termsVersionIds.length === 0) return { ok: true };
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return { ok: false, error: "DB URL not set" };
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    for (const vid of termsVersionIds) {
      await prisma.$executeRaw`
        INSERT INTO user_terms_agreements ("userId", "termsVersionId", "agreedAt", ip)
        VALUES (${userId}::uuid, ${vid}, NOW(), ${ip})
        ON CONFLICT ("userId", "termsVersionId") DO NOTHING
      `;
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    await prisma.$disconnect();
  }
}
