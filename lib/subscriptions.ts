import { createAdminClient } from "@/lib/supabase/admin";

export type PlanFeature = {
  code: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
};

export type Plan = {
  id: number;
  code: string; // FREE | MONTHLY | YEARLY
  name: string;
  price: number;
  billingCycle: string; // monthly | yearly
  isBest: boolean;
  discount: string | null;
  ctaText: string;
  ctaStyle: "primary" | "secondary";
  sortOrder: number;
  isActive: boolean;
  studentLimit: number | null;
  alimtalkLimit: number | null;
  hasStats: boolean;
  hasMemberSearch: boolean;
  hasCsvExport: boolean;
  hasPrioritySupport: boolean;
  hasAutoRegular: boolean;
  features: PlanFeature[];
};

/**
 * 활성화된 플랜 목록을 정책값 + 카드 표시용 features 까지 한 번에 조회.
 * 어드민(또는 Supabase Studio)에서 데이터를 바꾸면 즉시 반영됨.
 */
export async function getActivePlans(): Promise<Plan[]> {
  const admin = createAdminClient();

  const { data: plans, error } = await admin
    .from("subscription_plans")
    .select("*")
    .eq("isActive", true)
    .order("sortOrder", { ascending: true });

  if (error) {
    console.error("[getActivePlans] error:", error);
    return [];
  }
  if (!plans?.length) return [];

  const planIds = plans.map((p) => p.id);
  const { data: features } = await admin
    .from("subscription_plan_features")
    .select("*")
    .in("planId", planIds)
    .order("sortOrder", { ascending: true });

  const grouped = new Map<number, PlanFeature[]>();
  for (const f of features ?? []) {
    const arr = grouped.get(f.planId) ?? [];
    arr.push({
      code: f.code,
      label: f.label,
      enabled: f.enabled,
      sortOrder: f.sortOrder,
    });
    grouped.set(f.planId, arr);
  }

  return plans.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    price: p.price,
    billingCycle: p.billingCycle,
    isBest: p.isBest,
    discount: p.discount,
    ctaText: p.ctaText,
    ctaStyle: p.ctaStyle as "primary" | "secondary",
    sortOrder: p.sortOrder,
    isActive: p.isActive,
    studentLimit: p.studentLimit,
    alimtalkLimit: p.alimtalkLimit,
    hasStats: p.hasStats,
    hasMemberSearch: p.hasMemberSearch,
    hasCsvExport: p.hasCsvExport,
    hasPrioritySupport: p.hasPrioritySupport,
    hasAutoRegular: p.hasAutoRegular,
    features: grouped.get(p.id) ?? [],
  }));
}

export async function getPlanByCode(code: string): Promise<Plan | null> {
  const plans = await getActivePlans();
  return plans.find((p) => p.code === code) ?? null;
}
