"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveUserTermsAgreements } from "@/lib/terms";

const VALID_GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

async function getRequiredTermVersionIds(): Promise<number[]> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return [];
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ versionId: number }>>(
      `SELECT tv.id AS "versionId"
       FROM terms t INNER JOIN terms_versions tv ON tv."termsId" = t.id AND tv."isActive" = true
       WHERE t."isRequired" = true`,
    );
    return rows.map((r) => r.versionId);
  } finally {
    await prisma.$disconnect();
  }
}

async function getMarketingVersionId(): Promise<number | null> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return null;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ versionId: number }>>(
      `SELECT tv.id AS "versionId"
       FROM terms t INNER JOIN terms_versions tv ON tv."termsId" = t.id AND tv."isActive" = true
       WHERE t.code = 'MARKETING_CONSENT'`,
    );
    return rows[0]?.versionId ?? null;
  } finally {
    await prisma.$disconnect();
  }
}

export async function submitCoachProfile(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");

  const realName = formData.get("realName")?.toString()?.trim();
  // 생년월일은 폼에서 일시 숨김 — 추후 마이페이지에서 입력
  const birthDate = formData.get("birthDate")?.toString()?.trim() || null;
  const gender = formData.get("gender")?.toString();
  const bio = formData.get("bio")?.toString()?.trim();
  const areaSido = formData.get("areaSido")?.toString();
  const areaSigungu = formData.get("areaSigungu")?.toString()?.trim();
  const experienceYearsRaw = formData.get("experienceYears")?.toString();
  const agreedRaw = formData.get("agreedTermVersionIds")?.toString() ?? "";
  const agreedIds = agreedRaw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!realName) throw new Error("이름을 입력해주세요");
  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new Error("생년월일을 올바른 형식으로 입력해주세요");
  }
  if (!gender || !VALID_GENDERS.includes(gender as (typeof VALID_GENDERS)[number])) {
    throw new Error("성별을 선택해주세요");
  }
  if (!bio || bio.length < 10) throw new Error("자기소개는 10자 이상 입력해주세요");
  if (!areaSido) throw new Error("시·도를 선택해주세요");
  if (!areaSigungu) throw new Error("시·군·구를 입력해주세요");

  const required = await getRequiredTermVersionIds();
  if (!required.every((id) => agreedIds.includes(id))) {
    throw new Error("필수 약관에 동의해주세요");
  }

  const experienceYears = experienceYearsRaw ? Number(experienceYearsRaw) : null;

  // 가격/공개여부는 UI에서 일시 숨김
  const lessonPrice = null;
  const priceVisibility = "PRIVATE";

  const admin = createAdminClient();

  const { error: insertError } = await admin.from("coach_profiles").insert({
    userId: user.id,
    gender,
    bio,
    areaSido,
    areaSigungu,
    experienceYears,
    lessonPrice,
    priceVisibility,
    updatedAt: new Date().toISOString(),
  });
  if (insertError) {
    console.error("[submitCoachProfile] insert error:", insertError);
    throw new Error(insertError.message);
  }

  // 마케팅 동의 여부
  const marketingVid = await getMarketingVersionId();
  const marketingConsented = !!(marketingVid && agreedIds.includes(marketingVid));

  // users 컴럼 업데이트 (fire-and-forget)
  admin
    .from("users")
    .update({
      realName,
      birthDate,
      marketingConsent: marketingConsented,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", user.id)
    .then(({ error }) => {
      if (error) console.error("[submitCoachProfile] users update error:", error);
    });

  // 약관 동의 이력
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const saveRes = await saveUserTermsAgreements(user.id, agreedIds, ip);
  if (!saveRes.ok) console.error("[submitCoachProfile] terms save error:", saveRes.error);

  revalidatePath("/");
}
