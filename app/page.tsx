import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BottomNav } from "@/components/bottom-nav";
import { CoachRequestForm, CoachRequestPending } from "@/components/coach-request-form";
import { StudentSplash } from "@/components/student-splash";
import { CoachHomeCalendar } from "@/components/coach/home-calendar";
import { StudentTestCases } from "@/components/student-test-cases";
import {
  StudentWeekMini,
  StudentWeekLessons,
  StudentResponseRequired,
  StudentPaymentNotice,
  type StudentLessonRow,
} from "@/components/student/lesson-list";
import { signOutAction } from "@/app/actions/sign-out";
import { randomQuote, timeGreeting, todayLabel } from "@/lib/quotes";
import { getGrandSlamState, type GrandSlamState } from "@/lib/grand-slam";

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

    // 본인 레슨 (이번 주 KST 월~일 범위 + CANCELLED 제외)
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const dow = nowKst.getUTCDay();
    const offsetToMon = (dow + 6) % 7;
    const monKst = new Date(nowKst);
    monKst.setUTCDate(monKst.getUTCDate() - offsetToMon);
    monKst.setUTCHours(0, 0, 0, 0);
    const weekStartUtcIso = new Date(monKst.getTime() - 9 * 60 * 60 * 1000).toISOString();
    const weekEndUtcIso = new Date(
      monKst.getTime() + 7 * 24 * 60 * 60 * 1000 - 9 * 60 * 60 * 1000,
    ).toISOString();

    const { data: studentLessons } = await admin
      .from("lessons")
      .select(
        "id, coachId, scheduledAt, durationMinutes, status, paymentStatus, lessonFormat, roundNumber, totalRounds, originalScheduledAt, splitIndex, splitTotal, notes",
      )
      .eq("studentId", user.id)
      .neq("status", "CANCELLED")
      .gte("scheduledAt", weekStartUtcIso)
      .lt("scheduledAt", weekEndUtcIso)
      .order("scheduledAt", { ascending: true });

    const lessons = (studentLessons ?? []) as StudentLessonRow[];

    // 응답 필요 (MAKEUP_PENDING) — 주간 범위와 무관하게 항상 노출
    const { data: actionLessons } = await admin
      .from("lessons")
      .select(
        "id, coachId, scheduledAt, durationMinutes, status, paymentStatus, lessonFormat, roundNumber, totalRounds, originalScheduledAt, splitIndex, splitTotal, notes",
      )
      .eq("studentId", user.id)
      .in("status", ["MAKEUP_PENDING"])
      .order("scheduledAt", { ascending: true });

    const allLessonsForNames = [...(actionLessons ?? []), ...lessons] as StudentLessonRow[];
    const coachIds = Array.from(new Set(allLessonsForNames.map((l) => l.coachId)));
    const coachNames: Record<string, string> = {};
    if (coachIds.length > 0) {
      const { data: coaches } = await admin
        .from("users")
        .select("id, realName, name")
        .in("id", coachIds);
      for (const c of (coaches ?? []) as Array<{ id: string; realName: string | null; name: string | null }>) {
        coachNames[c.id] = c.realName || c.name || "코치";
      }
    }

    // FR-16c 그랜드슬램 활성 시 학생 홈 상단 배너 자동 노출. 테이블 미존재 시 graceful fallback.
    let grandSlam: GrandSlamState = { mode: "NONE" };
    try {
      grandSlam = await getGrandSlamState();
    } catch {
      // FR-16 마이그레이션 미적용 시 무시
    }

    return (
      <StudentHome
        nickname={nickname}
        latestClaim={latestClaim}
        testMode={testMode === "scheduled" ? "scheduled" : null}
        weekLessons={lessons}
        actionLessons={(actionLessons ?? []) as StudentLessonRow[]}
        coachNames={coachNames}
        grandSlam={grandSlam}
      />
    );
  }

  // 코치: 매칭된 PENDING 학생 등록요청 카운트 (헤더 배너용)
  const { count: pendingClaimCount } = await admin
    .from("student_self_claims")
    .select("id", { count: "exact", head: true })
    .eq("matchedCoachUserId", user.id)
    .eq("status", "PENDING");

  // 등록된 학생 수 (CONFIRMED claim)
  const { count: studentCount } = await admin
    .from("student_self_claims")
    .select("studentUserId", { count: "exact", head: true })
    .eq("matchedCoachUserId", user.id)
    .eq("status", "CONFIRMED");

  // 이번 주(KST 월~일) 레슨 수 (CANCELLED 제외)
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dow = nowKst.getUTCDay();
  const offsetToMon = (dow + 6) % 7;
  const monKst = new Date(nowKst);
  monKst.setUTCDate(monKst.getUTCDate() - offsetToMon);
  monKst.setUTCHours(0, 0, 0, 0);
  const weekStartUtcIso = new Date(monKst.getTime() - 9 * 60 * 60 * 1000).toISOString();
  const weekEndUtcIso = new Date(monKst.getTime() + 7 * 24 * 60 * 60 * 1000 - 9 * 60 * 60 * 1000).toISOString();
  const { count: weeklyLessonCount } = await admin
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("coachId", user.id)
    .neq("status", "CANCELLED")
    .gte("scheduledAt", weekStartUtcIso)
    .lt("scheduledAt", weekEndUtcIso);

  return (
    <CoachHome
      nickname={nickname}
      pendingClaimCount={pendingClaimCount ?? 0}
      studentCount={studentCount ?? 0}
      weeklyLessonCount={weeklyLessonCount ?? 0}
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
  weekLessons = [],
  actionLessons = [],
  coachNames = {},
  grandSlam = { mode: "NONE" },
}: {
  nickname: string;
  latestClaim: LatestClaim;
  testMode: "scheduled" | null;
  weekLessons?: StudentLessonRow[];
  actionLessons?: StudentLessonRow[];
  coachNames?: Record<string, string>;
  grandSlam?: GrandSlamState;
}) {
  const greeting = timeGreeting();
  const date = todayLabel();
  const quote = randomQuote();
  // 이메일이 fallback 닉네임으로 노출되지 않도록 마스킹
  const displayName = nickname.includes("@") ? "회원" : nickname;

  // 테스트 모드 — 정상 스케줄 등록된 케이스
  if (testMode === "scheduled") {
    return (
      <main className="min-h-screen bg-bg pb-24">
        <div className="max-w-md mx-auto px-5 pt-6">
          <div className="min-w-0">
            <div className="text-xl font-extrabold text-ink truncate leading-tight">
              {displayName}님, {greeting}
            </div>
            <div className="mt-1 text-xs text-ink-3">{date}</div>
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
  // - PENDING + matched → 대기 카드 (알림 발송됨)
  // - PENDING + 미매칭 → 다시 신청 폼
  // - CONFIRMED → 연결된 코치 카드 (상태 전환 플로우 구현 전엔 도달 X)
  const showPendingMatched =
    latestClaim?.status === "PENDING" && !!latestClaim.matchedCoachUserId;
  const showRequestForm =
    !latestClaim ||
    (latestClaim.status === "PENDING" && !latestClaim.matchedCoachUserId) ||
    latestClaim.status === "REJECTED" ||
    latestClaim.status === "CANCELLED";
  const isConnected = latestClaim?.status === "CONFIRMED";
  const coachSectionTitle = showPendingMatched
    ? "코치 등록 진행 중"
    : showRequestForm
      ? "코치 등록"
      : "내 코치";

  return (
    <main className="min-h-screen bg-bg pb-24">
      <StudentSplash quote={quote} />
      <div className="max-w-md mx-auto px-5 pt-6">
        <div className="min-w-0">
          <div className="text-base font-bold text-ink truncate">
            {displayName}님, {greeting}
          </div>
          <div className="mt-1 text-xs text-ink-3">{date}</div>
        </div>

        {/* FR-16c 그랜드슬램 활성 배너 — 진행 중/임박(D-30 이내)에만 노출 */}
        {grandSlam.mode === "ACTIVE" && (
          <Link
            href="/my/grand-slam"
            className="mt-5 block rounded-2xl bg-gradient-to-br from-red-600 to-red-700 text-white p-3.5"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/15 rounded-full text-[9px] font-extrabold tracking-wider uppercase flex-none">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Live · Day {grandSlam.dayOfTournament}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold tracking-tight truncate">
                  {grandSlam.tournament.nameKo} 진행 중
                </div>
                <div className="mt-0.5 text-[11px] text-white/85 font-medium truncate">
                  오늘 한국 선수 경기 보러 가기 →
                </div>
              </div>
            </div>
          </Link>
        )}
        {grandSlam.mode === "UPCOMING" && grandSlam.daysUntil <= 30 && (
          <Link
            href="/my/grand-slam"
            className="mt-5 block rounded-2xl bg-gradient-to-br from-indigo-900 to-indigo-700 text-white p-3.5"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2 py-0.5 bg-white/15 rounded-full text-[9px] font-extrabold tracking-wider uppercase flex-none">
                D-{grandSlam.daysUntil}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold tracking-tight truncate">
                  {grandSlam.tournament.nameKo} 곧 시작!
                </div>
                <div className="mt-0.5 text-[11px] text-white/85 font-medium truncate">
                  중계 채널·시청 가이드 확인 →
                </div>
              </div>
            </div>
          </Link>
        )}

        <div className="mt-6">
          <h2 className="text-lg font-bold text-ink mb-2">{coachSectionTitle}</h2>
          {showPendingMatched && latestClaim ? (
            <CoachRequestPending
              claimId={latestClaim.id}
              coachName={latestClaim.claimedCoachName}
              notifiedAt={latestClaim.notifiedAt}
            />
          ) : showRequestForm ? (
            <CoachRequestForm />
          ) : isConnected && latestClaim ? (
            <div className="rounded-2xl border border-line bg-surface p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary-600 flex items-center justify-center flex-none text-lg font-bold">
                {latestClaim.claimedCoachName.slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-ink truncate">
                  {latestClaim.claimedCoachName} 코치
                </div>
                <div className="mt-0.5 text-[11px] text-ink-3">연결됨</div>
              </div>
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="준비 중"
                className="flex-none inline-flex items-center rounded-full border border-line bg-surface text-ink-3 text-xs font-semibold px-3 py-1.5 opacity-60 cursor-not-allowed"
              >
                메시지
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink-2">
              코치 연결 상태 확인 중
            </div>
          )}
        </div>

        {/* 결제 안내 — 미결제 있을 때만 노출 */}
        {weekLessons.length > 0 && (
          <div className="mt-4">
            <StudentPaymentNotice lessons={weekLessons} />
          </div>
        )}

        {/* 주간 미니 캘린더 + 이번 주 레슨 */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-ink">이번 주 레슨</h2>
            {weekLessons.length > 0 && (
              <span className="text-xs text-ink-3 font-medium">{weekLessons.length}건</span>
            )}
          </div>
          {weekLessons.length > 0 && (
            <div className="mb-3">
              <StudentWeekMini lessons={weekLessons} />
            </div>
          )}
          {weekLessons.length > 0 ? (
            <StudentWeekLessons lessons={weekLessons} coachNames={coachNames} />
          ) : (
            <div className="rounded-2xl border border-line bg-surface p-8 text-center">
              <p className="text-sm text-ink-2">이번 주 예정된 레슨이 없어요</p>
              <p className="mt-1 text-xs text-ink-3">
                {isConnected
                  ? "코치님이 레슨을 등록하면 여기에 표시돼요"
                  : "코치님이 회원님을 등록하면 여기에 표시돼요"}
              </p>
            </div>
          )}
        </div>

        {/* 응답 필요 */}
        <div className="mt-6">
          <h2 className="text-lg font-bold text-ink mb-2">응답 필요</h2>
          <StudentResponseRequired lessons={actionLessons} coachNames={coachNames} />
        </div>

        {/* FR-16a 오늘의 코트사이드 진입 카드 — 매일 새 콘텐츠 */}
        <Link
          href="/my/courtside"
          className="mt-6 block rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E3A5F] text-white p-4 active:scale-[0.99] transition"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center text-xl flex-none">
              ☀️
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold tracking-wider uppercase text-white/65">
                Today&apos;s Courtside
              </div>
              <div className="mt-1 text-base font-extrabold tracking-tight truncate">
                오늘의 코트사이드
              </div>
              <div className="mt-1 text-[11px] text-white/80 font-medium leading-relaxed">
                코트 컨디션 · 한국 선수 경기 · 어제 하이라이트
              </div>
            </div>
            <span className="text-white/60 text-base flex-none">›</span>
          </div>
        </Link>
      </div>

      <BottomNav role="STUDENT" active="/" />
    </main>
  );
}

function KpiCard({
  label,
  value,
  href,
  highlight = false,
  placeholder = false,
}: {
  label: string;
  value?: string;
  href?: string;
  highlight?: boolean;
  placeholder?: boolean;
}) {
  const content = (
    <div
      className={`rounded-xl border p-2.5 ${
        placeholder
          ? "border-line bg-soft/60"
          : highlight
            ? "border-amber-300 bg-amber-50"
            : "border-line bg-surface"
      }`}
    >
      <div
        className={`text-[10px] font-semibold ${
          placeholder ? "text-ink-3" : highlight ? "text-amber-700" : "text-ink-3"
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1 text-base font-extrabold ${
          placeholder ? "text-ink-3" : highlight ? "text-amber-700" : "text-ink"
        }`}
      >
        {placeholder ? <span className="text-xs font-medium text-ink-3">곧 제공</span> : value}
      </div>
    </div>
  );
  if (href && !placeholder) {
    return (
      <Link href={href} className="block active:scale-[0.98] transition">
        {content}
      </Link>
    );
  }
  return content;
}

function CoachHome({
  nickname,
  pendingClaimCount,
  studentCount,
  weeklyLessonCount,
  testMode = false,
  showDevButtons = false,
}: {
  nickname: string;
  pendingClaimCount: number;
  studentCount: number;
  weeklyLessonCount: number;
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

        {/* 운영 지표 — 6 카드 그리드 */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <KpiCard label="이번 주 레슨" value={`${weeklyLessonCount}건`} />
          <KpiCard label="등록 학생" value={`${studentCount}명`} />
          <KpiCard
            label="응답 대기"
            value={`${pendingClaimCount}건`}
            href="/coach/notifications"
            highlight={pendingClaimCount > 0}
          />
          <KpiCard label="이번 달 매출" placeholder />
          <KpiCard label="잔여 회차 임박" placeholder />
          <KpiCard label="이번 달 출석률" placeholder />
        </div>

        {/* 주간 캘린더 + 선택 날짜 레슨 (인터랙티브) */}
        <CoachHomeCalendar testMode={testMode} />
      </div>

      <BottomNav role="COACH" active="/" />
    </main>
  );
}
