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
  const phoneRaw = formData.get("phone")?.toString()?.trim();

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

  // 전화번호 정규화 (숫자만)
  const phone = phoneRaw?.replace(/[^\d]/g, "");
  if (!phone || phone.length < 10 || phone.length > 11) {
    throw new Error("전화번호는 10~11자리 숫자로 입력해주세요");
  }

  const admin = createAdminClient();

  // 1. student_profiles insert (NTRP/지역은 추후 입력)
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

  // 2. users 테이블의 phone 업데이트 (코치 초대 매칭용) - fire-and-forget
  admin
    .from("users")
    .update({ phone, updatedAt: new Date().toISOString() })
    .eq("id", user.id)
    .then(({ error }) => {
      if (error)
        console.error("[submitStudentProfile] phone update error:", error);
    });

  revalidatePath("/");
  redirect("/");
}
