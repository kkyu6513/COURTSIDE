import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BottomNav } from "@/components/bottom-nav";
import { BackButton } from "@/components/back-button";
import { CoachRequestForm, CoachRequestPending } from "@/components/coach-request-form";
import { StudentSplash } from "@/components/student-splash";
import { CoachHomeCalendar } from "@/components/coach/home-calendar";
import { StudentHomeLessons } from "@/components/student/student-home-lessons";
import { StudentTestCases } from "@/components/student-test-cases";
import { signOutAction } from "@/app/actions/sign-out";
import { randomQuote, timeGreeting, todayLabel } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams?: { test?: string; as?: string; debug?: string };
}) {
  const testMode = searchParams?.test;
  const asStudent = searchParams?.as === "student";
  const showDevButtons = searchParams?.debug === "1";
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

  // 코치 계정이 ?as=student 로 학생 홈 미리보기 — 테스트 뷰만 강제 렌더
  if (asStudent) {
    return (
      <StudentHome
        nickname={nickname}
        latestClaim={null}
        testMode="scheduled"
      />
    );
  }

  if (role === "STUDENT") {
    // 학생 셀프 신청 조회 (가장 최근 1건)
    const { data: latestClaim } = await admin
      .from("student_self_claims")
      .select("id, claimedCoachName, status, notifiedAt, matchedCoachUserId")
      .eq("studentUserId", user.id)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    return (
      <StudentHome
        nickname={nickname}
        latestClaim={latestClaim}
        testMode={testMode === "scheduled" ? "scheduled" : null}
      />
    );
  }

  // 코치: 매칭된 PENDING 학생 등록요청 카운트 (헤더 배너용)
  const { count: pendingClaimCount } = await admin
    .from("student_self_claims")
    .select("id", { count: "exact", head: true })
    .eq("matchedCoachUserId", user.id)
    .eq("status", "PENDING");

  return (
    <CoachHome
      nickname={nickname}
      pendingClaimCount={pendingClaimCount ?? 0}
      testMode={testMode === "lessons"}
      showDevButtons={showDevButtons}
    />
  );
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
  testMode,
}: {
  nickname: string;
  latestClaim: LatestClaim;
  testMode: "scheduled" | null;
}) {
  const greeting = timeGreeting();
  const date = todayLabel();
  const quote = randomQuote();

  // 테스트 모드 — 정상 스케줄 등록된 케이스
  if (testMode === "scheduled") {
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

          <div className="mt-6">
            <StudentTestCases />
          </div>
        </div>
        <BottomNav role="STUDENT" active="/" />
      </main>
    );
  }

  // 상태 분기:
  // - latestClaim 없음 → 신청 폼
  // - PENDING + matched(matchedCoachUserId) → 대기 카드 (알림 발송됨)
  // - PENDING + 미매칭 → 다시 신청 폼 + 안내
  // - CONFIRMED → 정식 코치 카드 (추후 코치 등록 환경 마련 전에는 도달 X)
  const showPendingMatched = latestClaim?.status === "PENDING" && !!latestClaim.matchedCoachUserId;
  const showRequestForm = !latestClaim || (latestClaim.status === "PENDING" && !latestClaim.matchedCoachUserId) || latestClaim.status === "REJECTED";

  return (
    <main className="min-h-screen bg-bg pb-24">
      <StudentSplash quote={quote} />
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
          <StudentHomeLessons />
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

const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];

function getKstParts(d: Date) {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
    dow: kst.getUTCDay(),
    raw: kst,
  };
}

function thisWeekDates(now: Date = new Date()) {
  // 한국 기준 주: 월요일 시작 ~ 일요일 종료 (프로토타입 컨벤션)
  const today = getKstParts(now);
  // 월요일까지의 차이 (월=1 ... 일=0)
  const offsetToMon = (today.dow + 6) % 7;
  const monKst = new Date(today.raw);
  monKst.setUTCDate(monKst.getUTCDate() - offsetToMon);
  const days: { day: number; dowKor: string; isToday: boolean; iso: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monKst);
    d.setUTCDate(d.getUTCDate() + i);
    days.push({
      day: d.getUTCDate(),
      dowKor: DOW_KOR[d.getUTCDay()],
      isToday: d.getUTCDate() === today.day && d.getUTCMonth() === today.raw.getUTCMonth(),
      iso: d.toISOString().slice(0, 10),
    });
  }
  return days;
}

function CoachHome({
  nickname,
  pendingClaimCount,
  testMode = false,
  showDevButtons = false,
}: {
  nickname: string;
  pendingClaimCount: number;
  testMode?: boolean;
  showDevButtons?: boolean;
}) {
  // 이메일이 fallback 닉네임으로 넘어왔을 때 헤더에 노출되지 않도록 마스킹
  const displayName = nickname.includes("@") ? "코치" : nickname;

  return (
    <main className="min-h-screen bg-bg pb-24">
      <div className="max-w-md mx-auto px-5 pt-6">
        {/* 헤더 — 타이틀 좌측 + 전체 스케줄 관리 우측 */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-extrabold text-ink leading-tight truncate">
                나의 스케줄
              </h1>
              {testMode && (
                <span className="flex-none text-[10px] font-semibold text-ink-3 bg-soft px-2 py-0.5 rounded-full">
                  테스트 데이터
                </span>
              )}
            </div>
            <div className="mt-1.5 text-xs text-ink-3 truncate">
              안녕하세요, {displayName} 코치님
            </div>
          </div>
          <Link
            href="/coach/schedule"
            prefetch={false}
            className="flex-none inline-flex items-center rounded-full bg-primary text-white text-xs font-semibold px-4 py-2 shadow-sm hover:opacity-90 transition active:scale-[0.98]"
          >
            전체 스케줄
          </Link>
        </div>

        {/* 디버그 영역 — ?debug=1 쿼리에서만 노출 */}
        {showDevButtons && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/?as=student"
              className="inline-flex items-center rounded-full border border-line bg-surface text-ink-2 text-[11px] font-semibold px-3 py-1.5 hover:bg-soft transition"
            >
              [DEV] 학생 홈 미리보기
            </Link>
            <Link
              href="/onboarding/role?force=1"
              className="inline-flex items-center rounded-full border border-line bg-surface text-ink-2 text-[11px] font-semibold px-3 py-1.5 hover:bg-soft transition"
            >
              [DEV] 역할 선택
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center rounded-full border border-line bg-surface text-ink-2 text-[11px] font-semibold px-3 py-1.5 hover:bg-soft transition"
              >
                [DEV] 로그아웃
              </button>
            </form>
          </div>
        )}

        {/* PENDING 배너 */}
        {pendingClaimCount > 0 && (
          <Link
            href="/coach/notifications"
            className="mt-4 flex items-center gap-3 rounded-xl border-[1.5px] border-amber-300 bg-amber-50 px-3.5 py-3 transition active:scale-[0.99]"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-amber-700">
                새로운 학생 등록 요청이 {pendingClaimCount}건 있어요
              </div>
              <div className="mt-0.5 text-[11px] text-amber-700/80">
                수강생이 회원님의 응답을 기다리고 있어요. 빠른 확인을 부탁드려요.
              </div>
            </div>
            <span className="text-amber-700 text-base flex-none">›</span>
          </Link>
        )}

        {/* 주간 캘린더 + 선택 날짜 레슨 (인터랙티브) */}
        <CoachHomeCalendar testMode={testMode} />
      </div>

      <BottomNav role="COACH" active="/" />
    </main>
  );
}
