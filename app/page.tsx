import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BottomNav } from "@/components/bottom-nav";
import { todayQuote, timeGreeting, todayLabel } from "@/lib/quotes";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 비로그인 - 랜딩
  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold tracking-tight text-ink">
            COURTSIDE
          </h1>
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

  const meta = user.app_metadata as
    | { role?: string; plan?: string }
    | undefined;
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
    return <StudentHome nickname={nickname} />;
  }
  return <CoachHome nickname={nickname} />;
}

function StudentHome({ nickname }: { nickname: string }) {
  const greeting = timeGreeting();
  const date = todayLabel();
  const quote = todayQuote();

  return (
    <main className="min-h-screen bg-bg pb-24">
      <div className="max-w-md mx-auto px-5 pt-6">
        {/* 헤더 */}
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-base font-bold text-ink">
              {nickname}님, {greeting}
            </div>
            <div className="mt-1 text-xs text-ink-3">{date}</div>
          </div>
          <button
            type="button"
            aria-label="알림"
            className="flex-none w-10 h-10 flex items-center justify-center rounded-full bg-surface border border-line"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
        </div>

        {/* 명언 */}
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-50/40 p-4">
          <div className="text-sm text-ink leading-relaxed">“{quote.t}”</div>
          <div className="mt-1.5 text-xs text-emerald-700 font-semibold">{quote.by}</div>
        </div>

        {/* 코치 카드 (빈 상태) */}
        <div className="mt-6">
          <h2 className="text-sm font-bold text-ink mb-2">내 코치</h2>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-soft flex items-center justify-center text-xl">🎾</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink">아직 연결된 코치가 없어요</div>
                <p className="mt-0.5 text-xs text-ink-2 leading-relaxed">
                  레슨받으실 코치님께 가입 사실을 알려주세요.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 이번 주 레슨 (빈 상태) */}
        <div className="mt-6">
          <h2 className="text-sm font-bold text-ink mb-2">이번 주 레슨</h2>
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <div className="text-3xl">📅</div>
            <p className="mt-2 text-sm text-ink-2">아직 예정된 레슨이 없어요</p>
            <p className="mt-1 text-xs text-ink-3">코치에게 등록되면 여기에 표시됩니다</p>
          </div>
        </div>

        {/* 응답 필요 (빈 상태) */}
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
        {/* 헤더 */}
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-base font-bold text-ink">
              {nickname} 코치님, {greeting}
            </div>
            <div className="mt-1 text-xs text-ink-3">{date}</div>
          </div>
          <button
            type="button"
            aria-label="알림"
            className="flex-none w-10 h-10 flex items-center justify-center rounded-full bg-surface border border-line"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
        </div>

        {/* 명언 */}
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-50/40 p-4">
          <div className="text-sm text-ink leading-relaxed">“{quote.t}”</div>
          <div className="mt-1.5 text-xs text-emerald-700 font-semibold">{quote.by}</div>
        </div>

        {/* 나의 스케줄 */}
        <div className="mt-6">
          <h2 className="text-sm font-bold text-ink mb-2">나의 스케줄</h2>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs text-ink-2 leading-relaxed">
              등록한 가용 시간이 여기에 표시됩니다. 학생을 초대하고 레슨을 확정하면
              일정이 자동으로 채워져요.
            </p>
          </div>
        </div>

        {/* 학생 관리 (빈 상태) */}
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
