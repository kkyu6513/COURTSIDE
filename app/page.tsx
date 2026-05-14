import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BottomNav } from "@/components/bottom-nav";
import { BackButton } from "@/components/back-button";
import { CoachRequestForm, CoachRequestPending } from "@/components/coach-request-form";
import { todayQuote, timeGreeting, todayLabel } from "@/lib/quotes";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold tracking-tight text-ink">COURTSIDE</h1>
          <p className="mt-3 text-sm text-ink-2">테니스 코치 SaaS</p>
          <Link
            href="/login"
            className="mt-10 inline-flex h-12 items-center justify-center rounded-xl bg-ink px-8 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            로그인하기
          </Link>
        </div>
      </main>
    );
  }

  const meta = user.app_metadata as { role?: string; plan?: string } | undefined;
  const role = meta?.role;
  if (!role) redirect("/onboarding/role");

  const admin = createAdminClient();
  if (role === "STUDENT") {
    const { data: studentProfile } = await admin
      .from("student_profiles")
      .select("id")
      .eq("userId", user.id)
      .maybeSingle();
    if (!studentProfile) redirect("/onboarding/student");
  } else if (role === "COACH") {
    if (!meta?.plan) redirect("/onboarding/coach/plan");
    const { data: coachProfile } = await admin
      .from("coach_profiles")
      .select("id")
      .eq("userId", user.id)
      .maybeSingle();
    if (!coachProfile) redirect("/onboarding/coach");
  }

  const nickname =
    (user.user_metadata?.nickname as string | undefined) ||
    user.email ||
    "사용자";

  if (role === "STUDENT") {
    // 학생 셀프 신청 조회 (가장 최근 1건)
    const { data: latestClaim } = await admin
      .from("student_self_claims")
      .select("id, claimedCoachName, status, notifiedAt, matchedCoachUserId")
      .eq("studentUserId", user.id)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    return <StudentHome nickname={nickname} latestClaim={latestClaim} />;
  }
  return <CoachHome nickname={nickname} />;
}

type LatestClaim = {
  id: number;
  claimedCoachName: string;
  status: string;
  notifiedAt: string | null;
  matchedCoachUserId: string | null;
} | null;

function StudentHome({
  nickname,
  latestClaim,
}: {
  nickname: string;
  latestClaim: LatestClaim;
}) {
  const greeting = timeGreeting();
  const date = todayLabel();
  const quote = todayQuote();

  // 상태 분기:
  // - latestClaim 없음 → 신청 폼
  // - PENDING + matched(matchedCoachUserId) → 대기 카드 (알림 발송됨)
  // - PENDING + 미매칭 → 다시 신청 폼 + 안내
  // - CONFIRMED → 정식 코치 카드 (추후 코치 등록 환경 마련 전에는 도달 X)
  const showPendingMatched = latestClaim?.status === "PENDING" && !!latestClaim.matchedCoachUserId;
  const showRequestForm = !latestClaim || (latestClaim.status === "PENDING" && !latestClaim.matchedCoachUserId) || latestClaim.status === "REJECTED";

  return (
    <main className="min-h-screen bg-bg pb-24">
      <div className="max-w-md mx-auto px-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <BackButton />
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-ink">{nickname}님, {greeting}</div>
            <div className="mt-1 text-xs text-ink-3">{date}</div>
          </div>
          <button type="button" aria-label="알림" className="flex-none w-10 h-10 flex items-center justify-center rounded-full bg-surface border border-line">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-50/40 p-4">
          <div className="text-sm text-ink leading-relaxed">“{quote.t}”</div>
          <div className="mt-1.5 text-xs text-emerald-700 font-semibold">{quote.by}</div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-bold text-ink mb-2">내 코치</h2>
          {showPendingMatched && latestClaim ? (
            <CoachRequestPending
              coachName={latestClaim.claimedCoachName}
              notifiedAt={latestClaim.notifiedAt}
            />
          ) : showRequestForm ? (
            <CoachRequestForm />
          ) : (
            <div className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink-2">
              코치 연결 상태 확인 중
            </div>
          )}
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-bold text-ink mb-2">이번 주 레슨</h2>
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <div className="text-3xl">📅</div>
            <p className="mt-2 text-sm text-ink-2">아직 예정된 레슨이 없어요</p>
            <p className="mt-1 text-xs text-ink-3">코치에게 등록되면 여기에 표시됩니다</p>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-bold text-ink mb-2">응답 필요</h2>
          <div className="rounded-2xl bg-soft p-5 text-center">
            <p className="text-sm text-ink-2">처리할 항목이 없어요</p>
          </div>
        </div>
      </div>

      <BottomNav role="STUDENT" active="/" />
    </main>
  );
}

function CoachHome({ nickname }: { nickname: string }) {
  const greeting = timeGreeting();
  const date = todayLabel();
  const quote = todayQuote();

  return (
    <main className="min-h-screen bg-bg pb-24">
      <div className="max-w-md mx-auto px-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <BackButton />
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-ink">{nickname} 코치님, {greeting}</div>
            <div className="mt-1 text-xs text-ink-3">{date}</div>
          </div>
          <button type="button" aria-label="알림" className="flex-none w-10 h-10 flex items-center justify-center rounded-full bg-surface border border-line">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-50/40 p-4">
          <div className="text-sm text-ink leading-relaxed">“{quote.t}”</div>
          <div className="mt-1.5 text-xs text-emerald-700 font-semibold">{quote.by}</div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-bold text-ink mb-2">나의 스케줄</h2>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs text-ink-2 leading-relaxed">
              등록한 가용 시간이 여기에 표시됩니다. 학생을 초대하고 레슨을 확정하면 일정이 자동으로 채워져요.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-bold text-ink mb-2">학생 관리</h2>
          <div className="rounded-2xl bg-soft p-8 text-center">
            <div className="text-3xl">🤝</div>
            <p className="mt-2 text-sm text-ink-2">아직 등록된 학생이 없어요</p>
            <p className="mt-1 text-xs text-ink-3">학생 초대 기능은 곳 제공됩니다</p>
          </div>
        </div>
      </div>

      <BottomNav role="COACH" active="/" />
    </main>
  );
}
