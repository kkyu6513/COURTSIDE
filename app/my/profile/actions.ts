"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

export async function updateCoachProfile(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") throw new Error("코치 계정만 수정할 수 있어요");

  const realName = formData.get("realName")?.toString()?.trim();
  const birthDate = formData.get("birthDate")?.toString()?.trim() || null;
  const gender = formData.get("gender")?.toString();
  const bio = formData.get("bio")?.toString()?.trim();
  const areaSido = formData.get("areaSido")?.toString();
  const areaSigungu = formData.get("areaSigungu")?.toString()?.trim();
  const experienceYearsRaw = formData.get("experienceYears")?.toString()?.trim();

  if (!realName) throw new Error("이름을 입력해주세요");
  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new Error("생년월일을 올바른 형식으로 입력해주세요");
  }
  if (!gender || !VALID_GENDERS.includes(gender as (typeof VALID_GENDERS)[number])) {
    throw new Error("성별을 선택해주세요");
  }
  if (!bio || bio.length < 10) throw new Error("자기소개는 10자 이상 입력해주세요");
  if (!areaSido) throw new Error("활동 지역(시·도)을 선택해주세요");
  if (!areaSigungu) throw new Error("활동 지역(시·군·구)을 선택해주세요");

  let experienceYears: number | null = null;
  if (experienceYearsRaw) {
    const n = Number(experienceYearsRaw);
    if (!Number.isFinite(n) || n < 0 || n > 50) {
      throw new Error("경력은 0~50년 사이로 입력해주세요");
    }
    experienceYears = Math.trunc(n);
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error: profileError } = await admin
    .from("coach_profiles")
    .update({
      gender,
      bio,
      areaSido,
      areaSigungu,
      experienceYears,
      updatedAt: now,
    })
    .eq("userId", user.id);
  if (profileError) {
    console.error("[updateCoachProfile] coach_profiles update error:", profileError);
    throw new Error(profileError.message);
  }

  const { error: userError } = await admin
    .from("users")
    .update({
      realName,
      birthDate,
      updatedAt: now,
    })
    .eq("id", user.id);
  if (userError) {
    console.error("[updateCoachProfile] users update error:", userError);
    throw new Error(userError.message);
  }

  revalidatePath("/my");
  revalidatePath("/my/profile");
}
