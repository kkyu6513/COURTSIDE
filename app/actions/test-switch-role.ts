"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 임시 테스트용 — 현재 로그인 사용자의 role을 STUDENT/COACH로 강제 전환하고,
 * 해당 프로필이 없으면 기본값으로 자동 생성. 가입 폼을 거치지 않고 바로 홈 진입.
 */
export async function testSwitchRole(formData: FormData) {
  const role = formData.get("role")?.toString();
  if (role !== "STUDENT" && role !== "COACH") {
    throw new Error("Invalid role");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // 1. app_metadata: role + (코치는 plan=FREE)
  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata || {}),
      role,
      ...(role === "COACH" ? { plan: "FREE" } : {}),
    },
  });
  if (metaError) {
    console.error("[testSwitchRole] meta error:", metaError);
    throw new Error(`app_metadata 갱신 실패: ${metaError.message}`);
  }

  // 2. public.users role 동기화 (admin upsert)
  const nickname =
    (user.user_metadata?.nickname as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    "테스트";
  const { error: upsertError } = await admin.from("users").upsert(
    {
      id: user.id,
      email: user.email!,
      name: nickname,
      role,
      isActive: true,
      updatedAt: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (upsertError) {
    console.error("[testSwitchRole] users upsert error:", upsertError);
    // 치명적 아님 — 계속 진행
  }

  // 3. 프로필 자동 생성 (없으면)
  if (role === "COACH") {
    const { data: existing } = await admin
      .from("coach_profiles")
      .select("id")
      .eq("userId", user.id)
      .maybeSingle();
    if (!existing) {
      const { error: profileError } = await admin.from("coach_profiles").insert({
        userId: user.id,
        gender: "MALE",
        bio: "테스트 모드 자동 생성된 코치 프로필",
        areaSido: "서울특별시",
        areaSigungu: "강남구",
        priceVisibility: "PRIVATE",
        updatedAt: new Date().toISOString(),
      });
      if (profileError) {
        console.error("[testSwitchRole] coach_profile insert error:", profileError);
      }
    }
  } else {
    const { data: existing } = await admin
      .from("student_profiles")
      .select("id")
      .eq("userId", user.id)
      .maybeSingle();
    if (!existing) {
      const { error: profileError } = await admin.from("student_profiles").insert({
        userId: user.id,
        gender: "MALE",
        ageGroup: "TWENTIES",
        ntrpLevel: "",
        preferredAreaSido: "",
        preferredAreaSigungu: "",
        preferredTimeSlots: [],
        updatedAt: new Date().toISOString(),
      });
      if (profileError) {
        console.error("[testSwitchRole] student_profile insert error:", profileError);
      }
    }
  }

  revalidatePath("/");
  redirect("/");
}
