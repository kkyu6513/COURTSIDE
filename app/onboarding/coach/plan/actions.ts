"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_PLANS = ["FREE", "MONTHLY", "YEARLY"] as const;
type Plan = (typeof VALID_PLANS)[number];

export async function selectPlan(formData: FormData) {
  const plan = formData.get("plan")?.toString() as Plan | undefined;
  const force = formData.get("force")?.toString() === "1";

  if (!plan || !VALID_PLANS.includes(plan)) {
    throw new Error("Invalid plan");
  }

  // MVP: 유료 플랜 결제 미연동 — FREE만 허용
  if (plan !== "FREE") {
    throw new Error(
      "유료 플랜 결제는 곧 출시됩니다. 가입 후 마이페이지에서 업그레이드하세요.",
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const meta = user.app_metadata as
    | { role?: string; plan?: string }
    | undefined;
  if (meta?.role !== "COACH") redirect("/onboarding/role");

  const admin = createAdminClient();

  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata || {}),
      plan,
    },
  });

  if (metaError) {
    console.error("[selectPlan] app_metadata error:", metaError);
    throw new Error(metaError.message);
  }

  revalidatePath("/");
  redirect(force ? "/onboarding/coach?force=1" : "/onboarding/coach");
}
