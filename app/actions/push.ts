"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };

/**
 * 클라이언트에서 PushManager.subscribe() 결과를 서버에 저장.
 * 같은 endpoint면 upsert (lastUsedAt 갱신).
 */
export async function registerPushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  if (!input.endpoint || !input.p256dh || !input.auth) {
    return { ok: false, error: "구독 정보가 올바르지 않습니다" };
  }

  const admin = createAdminClient();

  // endpoint 기준 upsert — 같은 기기 재구독 시 갱신
  const { data: existing } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", input.endpoint)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("push_subscriptions")
      .update({
        userId: user.id,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        lastUsedAt: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      console.error("[registerPushSubscription] update error:", error);
      return { ok: false, error: "구독 갱신 실패" };
    }
    return { ok: true };
  }

  const { error } = await admin.from("push_subscriptions").insert({
    userId: user.id,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    userAgent: input.userAgent ?? null,
  });
  if (error) {
    console.error("[registerPushSubscription] insert error:", error);
    return { ok: false, error: "구독 저장 실패" };
  }
  return { ok: true };
}

export async function unregisterPushSubscription(endpoint: string): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const admin = createAdminClient();
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true };
}
