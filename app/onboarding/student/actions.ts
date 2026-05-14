"use server";

import { revalidatePath } from "next/cache";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms, buildStudentClaimMessage } from "@/lib/notification";
import { saveUserTermsAgreements } from "@/lib/terms";
import { headers } from "next/headers";

const VALID_GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
const VALID_AGE_GROUPS = ["TEENS", "TWENTIES", "THIRTIES", "FORTIES", "FIFTIES_PLUS"] as const;

async function isPhoneVerified(phone: string): Promise<boolean> {
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

export async function submitStudentProfile(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");

  const realName = formData.get("realName")?.toString()?.trim();
  const birthDate = formData.get("birthDate")?.toString()?.trim();
  const gender = formData.get("gender")?.toString();
  const ageGroup = formData.get("ageGroup")?.toString();
  const phoneRaw = formData.get("phone")?.toString()?.trim();
  const phoneVerifiedFlag = formData.get("phoneVerified")?.toString() === "1";
  const claimedCoachNameRaw = formData.get("claimedCoachName")?.toString()?.trim();
  const claimedCoachPhoneRaw = formData.get("claimedCoachPhone")?.toString()?.trim();
  const agreedRaw = formData.get("agreedTermVersionIds")?.toString() ?? "";
  const agreedIds = agreedRaw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!realName) throw new Error("이름을 입력해주세요");
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new Error("생년월일을 올바른 형식으로 입력해주세요");
  }
  if (!gender || !VALID_GENDERS.includes(gender as (typeof VALID_GENDERS)[number])) {
    throw new Error("성별을 선택해주세요");
  }
  if (!ageGroup || !VALID_AGE_GROUPS.includes(ageGroup as (typeof VALID_AGE_GROUPS)[number])) {
    throw new Error("연령대를 선택해주세요");
  }

  const phone = phoneRaw?.replace(/[^\d]/g, "");
  if (!phone || phone.length < 10 || phone.length > 11) {
    throw new Error("전화번호는 10~11자리 숫자로 입력해주세요");
  }
  if (!phoneVerifiedFlag || !(await isPhoneVerified(phone))) {
    throw new Error("전화번호 본인 인증을 완료해주세요");
  }

  // 필수 약관 동의 검증
  const required = await getRequiredTermVersionIds();
  if (!required.every((id) => agreedIds.includes(id))) {
    throw new Error("필수 약관에 동의해주세요");
  }

  const claimedCoachName = claimedCoachNameRaw || null;
  const claimedCoachPhone = claimedCoachPhoneRaw?.replace(/[^\d]/g, "") || null;
  if (claimedCoachPhone && (claimedCoachPhone.length < 10 || claimedCoachPhone.length > 11)) {
    throw new Error("코치 전화번호는 10~11자리 숫자로 입력해주세요");
  }

  const admin = createAdminClient();

  // student_profiles insert (NTRP/지역은 나중에)
  const { error: insertError } = await admin.from("student_profiles").insert({
    userId: user.id,
    gender,
    ageGroup,
    ntrpLevel: "",
    preferredAreaSido: "",
    preferredAreaSigungu: "",
    preferredTimeSlots: [],
    updatedAt: new Date().toISOString(),
  });
  if (insertError) {
    console.error("[submitStudentProfile] insert error:", insertError);
    throw new Error(insertError.message);
  }

  // users 테이블의 realName / birthDate / phone / marketingConsent 업데이트
  const marketingCode = "MARKETING_CONSENT";
  // marketingConsent 여부 — 약관 명칭으로 판정 제거 (서버에서 다시 쿼리)
  const url2 = process.env.DIRECT_URL || process.env.DATABASE_URL;
  let marketingConsented = false;
  if (url2) {
    const prisma = new PrismaClient({ datasources: { db: { url: url2 } } });
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ versionId: number }>>(
        `SELECT tv.id AS "versionId"
         FROM terms t INNER JOIN terms_versions tv ON tv."termsId" = t.id AND tv."isActive" = true
         WHERE t.code = $1`,
        marketingCode,
      );
      const mvid = rows[0]?.versionId;
      if (mvid && agreedIds.includes(mvid)) marketingConsented = true;
    } finally {
      await prisma.$disconnect();
    }
  }

  admin
    .from("users")
    .update({
      realName,
      birthDate,
      phone,
      marketingConsent: marketingConsented,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", user.id)
    .then(({ error }) => {
      if (error) console.error("[submitStudentProfile] users update error:", error);
    });

  // 약관 동의 이력 저장
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const saveRes = await saveUserTermsAgreements(user.id, agreedIds, ip);
  if (!saveRes.ok) console.error("[submitStudentProfile] terms save error:", saveRes.error);

  // 학생 셀프 신청 (코치 정보 입력 시)
  if (claimedCoachName && claimedCoachPhone) {
    const { data: candidates } = await admin
      .from("users")
      .select("id, name, phone, role")
      .eq("phone", claimedCoachPhone)
      .eq("role", "COACH");
    const matched = candidates?.[0];

    const { data: claim, error: claimError } = await admin
      .from("student_self_claims")
      .insert({
        studentUserId: user.id,
        claimedCoachName,
        claimedCoachPhone,
        matchedCoachUserId: matched?.id ?? null,
        status: "PENDING",
        updatedAt: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (claimError) {
      console.error("[submitStudentProfile] claim insert error:", claimError);
    } else if (matched && claim) {
      const studentName = realName || user.email || "신규 학생";
      sendSms(claimedCoachPhone, buildStudentClaimMessage(studentName)).then(async (res) => {
        const update: Record<string, unknown> = { notifyAttempts: 1, updatedAt: new Date().toISOString() };
        if (res.ok) update.notifiedAt = new Date().toISOString();
        else if ("error" in res) update.notifyLastError = res.error;
        else if (res.skipped) update.notifyLastError = `SKIPPED: ${res.reason}`;
        await admin.from("student_self_claims").update(update).eq("id", claim.id);
      });
    }
  }

  revalidatePath("/");
}
