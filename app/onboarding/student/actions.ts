"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms, buildStudentClaimMessage } from "@/lib/notification";

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

export async function submitStudentProfile(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const gender = formData.get("gender")?.toString();
  const ageGroup = formData.get("ageGroup")?.toString();
  const phoneRaw = formData.get("phone")?.toString()?.trim();
  const phoneVerifiedFlag = formData.get("phoneVerified")?.toString() === "1";
  const claimedCoachNameRaw = formData.get("claimedCoachName")?.toString()?.trim();
  const claimedCoachPhoneRaw = formData.get("claimedCoachPhone")?.toString()?.trim();

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

  const claimedCoachName = claimedCoachNameRaw || null;
  const claimedCoachPhone = claimedCoachPhoneRaw?.replace(/[^\d]/g, "") || null;

  if (claimedCoachPhone && (claimedCoachPhone.length < 10 || claimedCoachPhone.length > 11)) {
    throw new Error("코치 전화번호는 10~11자리 숫자로 입력해주세요");
  }

  const admin = createAdminClient();

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

  admin.from("users").update({ phone, updatedAt: new Date().toISOString() }).eq("id", user.id).then(({ error }) => {
    if (error) console.error("[submitStudentProfile] phone update error:", error);
  });

  if (claimedCoachName && claimedCoachPhone) {
    const { data: candidates } = await admin.from("users").select("id, name, phone, role").eq("phone", claimedCoachPhone).eq("role", "COACH");
    const matched = candidates?.[0];

    const claimRow = {
      studentUserId: user.id,
      claimedCoachName,
      claimedCoachPhone,
      matchedCoachUserId: matched?.id ?? null,
      status: "PENDING",
      updatedAt: new Date().toISOString(),
    };

    const { data: claim, error: claimError } = await admin.from("student_self_claims").insert(claimRow).select("id").single();

    if (claimError) {
      console.error("[submitStudentProfile] claim insert error:", claimError);
    } else if (matched && claim) {
      const studentName = (user.user_metadata?.nickname as string | undefined) || user.email || "신규 학생";
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
  redirect("/");
}
