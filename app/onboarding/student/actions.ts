"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
const VALID_AGE_GROUPS = [
  "TEENS",
  "TWENTIES",
  "THIRTIES",
  "FORTIES",
  "FIFTIES_PLUS",
] as const;

export async function submitStudentProfile(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const gender = formData.get("gender")?.toString();
  const ageGroup = formData.get("ageGroup")?.toString();
  const ntrpLevel = formData.get("ntrpLevel")?.toString();
  const areaSido = formData.get("areaSido")?.toString();
  const areaSigungu = formData.get("areaSigungu")?.toString()?.trim();

  // 검증
  if (
    !gender ||
    !VALID_GENDERS.includes(gender as (typeof VALID_GENDERS)[number])
  ) {
    throw new Error("성별을 선택해주세요");
  }
  if (
    !ageGroup ||
    !VALID_AGE_GROUPS.includes(ageGroup as (typeof VALID_AGE_GROUPS)[number])
  ) {
    throw new Error("연령대를 선택해주세요");
  }
  if (!ntrpLevel) throw new Error("NTRP 레벨을 선택해주세요");
  if (!areaSido) throw new Error("시·도를 선택해주세요");
  if (!areaSigungu) throw new Error("시·군·구를 입력해주세요");

  const admin = createAdminClient();

  const { error: insertError } = await admin.from("student_profiles").insert({
    userId: user.id,
    gender,
    ageGroup,
    ntrpLevel,
    preferredAreaSido: areaSido,
    preferredAreaSigungu: areaSigungu,
    preferredTimeSlots: [],
    updatedAt: new Date().toISOString(),
  });

  if (insertError) {
    console.error("[submitStudentProfile] insert error:", insertError);
    throw new Error(insertError.message);
  }

  revalidatePath("/");
  redirect("/");
}
