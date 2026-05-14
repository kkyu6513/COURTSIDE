"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
const VALID_PRICE_VIS = ["PUBLIC", "PRIVATE"] as const;

export async function submitCoachProfile(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const gender = formData.get("gender")?.toString();
  const bio = formData.get("bio")?.toString()?.trim();
  const areaSido = formData.get("areaSido")?.toString();
  const areaSigungu = formData.get("areaSigungu")?.toString()?.trim();
  const experienceYearsRaw = formData.get("experienceYears")?.toString();
  const lessonPriceRaw = formData.get("lessonPrice")?.toString();
  const priceVisibility = formData.get("priceVisibility")?.toString();

  // 검증
  if (
    !gender ||
    !VALID_GENDERS.includes(gender as (typeof VALID_GENDERS)[number])
  ) {
    throw new Error("성별을 선택해주세요");
  }
  if (!bio || bio.length < 10) {
    throw new Error("자기소개는 10자 이상 입력해주세요");
  }
  if (!areaSido) throw new Error("시·도를 선택해주세요");
  if (!areaSigungu) throw new Error("시·군·구를 입력해주세요");
  if (
    !priceVisibility ||
    !VALID_PRICE_VIS.includes(
      priceVisibility as (typeof VALID_PRICE_VIS)[number]
    )
  ) {
    throw new Error("가격 공개 여부를 선택해주세요");
  }

  const experienceYears = experienceYearsRaw
    ? Number(experienceYearsRaw)
    : null;
  const lessonPrice = lessonPriceRaw ? Number(lessonPriceRaw) : null;

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

  revalidatePath("/");
  redirect("/");
}
