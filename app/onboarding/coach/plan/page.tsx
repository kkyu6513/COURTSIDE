import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { selectPlan } from "./actions";
import { OnboardingHeader } from "@/components/onboarding-form";
import { PlanSubmitButton } from "./submit-button";

type Plan = {
  id: "FREE" | "MONTHLY" | "YEARLY";
  name: string;
  price: number;
  billingCycle: string;
  isBest: boolean;
  discount: string | null;
  ctaText: string;
  ctaStyle: "primary" | "secondary";
  features: string[];
  comingSoon?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "FREE",
    name: "무료",
    price: 0,
    billingCycle: "/월",
    isBest: false,
    discount: null,
    ctaText: "무료로 시작",
    ctaStyle: "secondary",
    features: ["프로필 기본 노출", "월 5건 신청 수신"],
  },
  {
    id: "MONTHLY",
    name: "월간 PRO",
    price: 29900,
    billingCycle: "/월",
    isBest: true,
    discount: null,
    ctaText: "PRO 시작하기",
    ctaStyle: "primary",
    features: [
      "검색 상위 노출",
      "무제한 신청 수신",
      "통계 대시보드",
      "PRO 배지 부여",
    ],
    comingSoon: true,
  },
  {
    id: "YEARLY",
    name: "연간 PRO",
    price: 19900,
    billingCycle: "/월",
    isBest: false,
    discount: "33% 할인 — 연 ₩238,800",
    ctaText: "연간 플랜 선택",
    ctaStyle: "secondary",
    features: [
      "월간 PRO 전체 기능",
      "인증 배지 우선 심사",
      "ANNUAL 배지 부여",
    ],
    comingSoon: true,
  },
];

export default async function CoachPlanSelectPage() {
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
  const { data: existing } = await admin
    .from("coach_profiles")
    .select("id")
    .eq("userId", user.id)
    .maybeSingle();

  if (existing) redirect("/");

  return (
    <main className="min-h-screen bg-bg pb-12">
      <div className="max-w-md mx-auto px-6 pt-4">
        <OnboardingHeader backHref="/onboarding/role" step={2} total={3} />

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-ink">
            코치님, 플랜을 선택하세요
          </h1>
          <p className="mt-1.5 text-sm text-ink-2">언제든 변경할 수 있어요</p>
        </div>

        <div className="mt-8 space-y-4">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-ink-3">
          유료 플랜 결제는 곧 출시됩니다. 가입 후 마이페이지 → 구독 플랜에서
          업그레이드할 수 있어요.
        </p>
      </div>
    </main>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const popular = plan.isBest;
  return (
    <div
      className={`relative rounded-2xl border bg-surface p-5 ${
        popular ? "border-ink shadow-md" : "border-line"
      }`}
    >
      {popular && (
        <div className="absolute -top-3 left-5 inline-flex h-6 items-center rounded-full bg-ink px-3 text-[10px] font-bold tracking-wide text-white">
          BEST
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <div className="text-base font-bold text-ink">{plan.name}</div>
        {plan.comingSoon && (
          <span className="rounded-full bg-soft px-2 py-0.5 text-[10px] font-semibold text-ink-2">
            결제 준비 중
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-extrabold text-ink">
          ₩{plan.price.toLocaleString()}
        </span>
        <span className="text-xs text-ink-3">{plan.billingCycle}</span>
      </div>

      {plan.discount && (
        <div className="mt-1.5 text-xs font-semibold text-red-500">
          🔥 {plan.discount}
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {plan.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-sm text-ink-2"
          >
            <svg
              className="mt-0.5 h-4 w-4 flex-none text-emerald-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4l2.3 2.3 6.3-6.3a1 1 0 0 1 1.4 0Z"
                clipRule="evenodd"
              />
            </svg>
            {f}
          </li>
        ))}
      </ul>

      <form action={selectPlan} className="mt-5">
        <input type="hidden" name="plan" value={plan.id} />
        <PlanSubmitButton
          variant={plan.ctaStyle}
          disabled={plan.comingSoon}
          label={plan.comingSoon ? "결제 준비 중" : plan.ctaText}
        />
      </form>
    </div>
  );
}
