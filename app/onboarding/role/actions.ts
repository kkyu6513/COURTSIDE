"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function selectRole(formData: FormData) {
  const role = formData.get("role")?.toString();
  const force = formData.get("force")?.toString() === "1";

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

  // 1. 가장 중요 — app_metadata에 role 저장 (세션 인식용)
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

  // 2. public.users 동기화는 fire-and-forget (대기 X, 빠른 응답)
  const nickname =
    (user.user_metadata?.nickname as string | undefined) || null;

  admin
    .from("users")
    .upsert({
      id: user.id,
      email: user.email!,
      name: nickname,
      role,
      updatedAt: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) console.error("[selectRole] upsert users error:", error);
    });

  revalidatePath("/");

  // 3. 역할별 다음 단계로 분기 (테스트용 force=1 우회 시 그대로 전달)
  const suffix = force ? "?force=1" : "";
  if (role === "STUDENT") {
    redirect(`/onboarding/student${suffix}`);
  } else {
    // 코치: 플랜 선택 → 프로필 등록 (3-step)
    redirect(`/onboarding/coach/plan${suffix}`);
  }
}
