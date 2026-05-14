"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function selectRole(formData: FormData) {
  const role = formData.get("role")?.toString();

  if (role !== "STUDENT" && role !== "COACH") {
    throw new Error("Invalid role");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();

  // 1. Supabase auth user의 app_metadata.role 설정 (세션 인식용)
  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata || {}),
      role,
    },
  });

  if (metaError) {
    console.error("[selectRole] app_metadata error:", metaError);
    throw new Error(metaError.message);
  }

  // 2. public.users 테이블에도 동기화
  const nickname =
    (user.user_metadata?.nickname as string | undefined) || null;

  const { error: upsertError } = await admin.from("users").upsert({
    id: user.id,
    email: user.email!,
    name: nickname,
    role,
    updatedAt: new Date().toISOString(),
  });

  if (upsertError) {
    console.error("[selectRole] upsert users error:", upsertError);
  }

  revalidatePath("/");

  // 3. 역할별 프로필 등록 페이지로 분기
  if (role === "STUDENT") {
    redirect("/onboarding/student");
  } else {
    redirect("/onboarding/coach");
  }
}
