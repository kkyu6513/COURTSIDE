import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BottomNav } from "@/components/bottom-nav";
import { BackButton } from "@/components/back-button";
import { CoachRequestForm, CoachRequestPending } from "@/components/coach-request-form";
import { StudentSplash } from "@/components/student-splash";
import { randomQuote, timeGreeting, todayLabel } from "@/lib/quotes";

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

  // 코치: 매칭된 PENDING 학생 등록요청 카운트 (헤더 배너용)
  const { count: pendingClaimCount } = await admin
    .from("student_self_claims")
    .select("id", { count: "exact", head: true })
    .eq("matchedCoachUserId", user.id)
    .eq("status", "PENDING");

  return <CoachHome nickname={nickname} pendingClaimCount={pendingClaimCount ?? 0} />;
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
  const quote = randomQuote();

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
}: {
  nickname: string;
  pendingClaimCount: number;
}) {
  const today = getKstParts(new Date());
  const week = thisWeekDates();
  const todayLabel = `📅 오늘 · ${today.month}월 ${today.day}일 (${DOW_KOR[today.dow]})`;

  return (
    <main className="min-h-screen bg-bg pb-24">
      <div className="max-w-md mx-auto px-5 pt-6">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xl font-extrabold text-ink leading-tight">나의 스케줄</div>
            <div className="mt-1.5 text-xs text-ink-3">안녕하세요, {nickname} 코치님</div>
          </div>
          <button
            type="button"
            disabled
            className="flex-none inline-flex items-center gap-1 rounded-full bg-primary text-white text-xs font-semibold px-3.5 py-1.5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            title="곧 제공 예정"
          >
            <span>📋</span>
            <span>전체 스케줄 관리</span>
          </button>
        </div>

        {/* PENDING 배너 */}
        {pendingClaimCount > 0 && (
          <Link
            href="/coach/notifications"
            className="mt-4 flex items-center gap-2.5 rounded-xl border-[1.5px] border-amber-300 bg-amber-50 px-3.5 py-3 transition active:scale-[0.99]"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-lg flex-none">
              ⏳
            </div>
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

        {/* 선택 날짜 */}
        <div className="mt-5 flex items-center justify-between">
          <div className="text-sm font-bold text-ink">{todayLabel}</div>
        </div>

        {/* 주간 미니 캘린더 */}
        <div className="mt-2 flex gap-1.5">
          {week.map((d) => (
            <div
              key={d.iso}
              className={`flex-1 text-center py-2 rounded-xl transition ${
                d.isToday ? "bg-primary text-white shadow-[0_4px_12px_rgba(45,212,191,0.35)]" : "bg-soft"
              }`}
            >
              <div className={`text-[10px] ${d.isToday ? "text-white/85" : "text-ink-3"}`}>
                {d.dowKor}
              </div>
              <div className={`text-sm font-semibold mt-0.5 ${d.isToday ? "text-white" : "text-ink"}`}>
                {d.day}
              </div>
              <div className="flex gap-1 justify-center mt-1 h-1.5" aria-hidden />
            </div>
          ))}
        </div>

        {/* 오늘 레슨 (빈 상태) */}
        <div className="mt-6">
          <div className="rounded-2xl border border-line bg-surface p-10 text-center">
            <div className="text-3xl">📅</div>
            <p className="mt-3 text-sm text-ink-2">오늘 예정된 레슨이 없어요</p>
            <p className="mt-1 text-xs text-ink-3">
              스케줄을 등록하거나 학생을 받으면 여기에 표시됩니다.
            </p>
          </div>
        </div>
      </div>

      <BottomNav role="COACH" active="/" />
    </main>
  );
}
