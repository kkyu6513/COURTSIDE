import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BottomNav } from "@/components/bottom-nav";
import { ComingSoon } from "@/components/coming-soon";
import { signOutAction } from "@/app/actions/sign-out";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meta = user.app_metadata as { role?: string; plan?: string } | undefined;
  const role = meta?.role;

  if (role === "COACH") {
    return <CoachMyPage userId={user.id} email={user.email ?? null} plan={meta?.plan ?? null} />;
  }

  // ───── 학생 마이 (기존 placeholder 유지) ─────
  const nickname =
    (user.user_metadata?.nickname as string | undefined) ||
    user.email ||
    "사용자";
  const displayName = nickname.includes("@") ? "회원" : nickname;

  return (
    <main className="min-h-screen bg-bg pb-24">
      <div className="max-w-md mx-auto px-5 pt-6">
        <h1 className="text-xl font-extrabold text-ink leading-tight">마이</h1>

        <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary-600 flex items-center justify-center flex-none text-lg font-bold">
              {displayName.slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-ink truncate">{displayName}</div>
              <div className="mt-0.5 text-[11px] text-ink-3">수강생 계정</div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <ComingSoon
            title="프로필 수정·환경설정 준비 중"
            description="개인 정보, 알림 설정, 결제 정보 등을 곧 관리하실 수 있어요."
          />
        </div>

        <div className="mt-6">
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full h-11 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition"
            >
              로그아웃
            </button>
          </form>
        </div>
      </div>
      <BottomNav role="STUDENT" active="/my" />
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 코치 마이페이지 (프로토타입 7-1 기반, 실데이터 연동)
// ──────────────────────────────────────────────────────────────────────────

async function CoachMyPage({
  userId,
  email,
  plan,
}: {
  userId: string;
  email: string | null;
  plan: string | null;
}) {
  const admin = createAdminClient();

  // 프로필 미완성 → 온보딩으로
  const { data: profile } = await admin
    .from("coach_profiles")
    .select("bio, areaSido, areaSigungu, experienceYears, averageRating, reviewCount, isVerified")
    .eq("userId", userId)
    .maybeSingle();
  if (!profile) redirect("/onboarding/coach");

  const { data: me } = await admin
    .from("users")
    .select("realName, name")
    .eq("id", userId)
    .maybeSingle();

  const displayName =
    me?.realName ||
    (me?.name && !me.name.includes("@") ? me.name : null) ||
    "코치";

  // ── 통계 3종 ──────────────────────────────────────────────
  // 이번 주(KST 월~일) 레슨 수 (CANCELLED 제외)
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

  const [{ count: weeklyLessonCount }, { count: studentCount }, { count: pendingClaimCount }] =
    await Promise.all([
      admin
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("coachId", userId)
        .neq("status", "CANCELLED")
        .gte("scheduledAt", weekStartUtcIso)
        .lt("scheduledAt", weekEndUtcIso),
      admin
        .from("student_self_claims")
        .select("studentUserId", { count: "exact", head: true })
        .eq("matchedCoachUserId", userId)
        .eq("status", "CONFIRMED"),
      admin
        .from("student_self_claims")
        .select("id", { count: "exact", head: true })
        .eq("matchedCoachUserId", userId)
        .eq("status", "PENDING"),
    ]);

  const isPro = plan === "MONTHLY" || plan === "YEARLY";
  const reviewCount = profile.reviewCount ?? 0;
  const rating = profile.averageRating ?? 0;
  const pending = pendingClaimCount ?? 0;

  return (
    <main className="min-h-screen bg-bg pb-24">
      <div className="max-w-md mx-auto">
        {/* 상단 헤더 */}
        <div className="flex items-center h-14 px-3 sticky top-0 z-10 bg-bg/85 backdrop-blur border-b border-line">
          <div className="w-10 h-10" />
          <h1 className="flex-1 text-center text-sm font-bold text-ink">마이페이지</h1>
          <div className="w-10 h-10" />
        </div>

        {/* 프로필 헤더 */}
        <div className="bg-surface px-5 pt-6 pb-7 text-center border-b border-line">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center text-white text-3xl font-extrabold">
            {displayName.slice(0, 1)}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-lg font-extrabold text-ink">{displayName} 코치</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                isPro
                  ? "bg-accent-purple-soft text-accent-purple"
                  : "bg-soft text-ink-3"
              }`}
            >
              {isPro ? "PRO" : "무료"}
            </span>
            {profile.isVerified && (
              <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700">
                인증
              </span>
            )}
          </div>
          {reviewCount > 0 ? (
            <div className="mt-1.5 text-sm font-semibold text-amber-500">
              ★ {rating.toFixed(1)}
              <span className="ml-1 text-xs font-medium text-ink-3">리뷰 {reviewCount}</span>
            </div>
          ) : (
            <div className="mt-1.5 text-xs text-ink-3">아직 받은 리뷰가 없어요</div>
          )}
        </div>

        {/* 통계 3종 */}
        <div className="grid grid-cols-3 gap-3 px-5 py-4">
          <StatBox value={weeklyLessonCount ?? 0} unit="건" label="이번주 레슨" color="text-primary-600" />
          <StatBox value={pending} unit="건" label="대기중 신청" color="text-accent-coral" />
          <StatBox value={studentCount ?? 0} unit="명" label="등록 학생" color="text-accent-purple" />
        </div>

        <div className="h-2 bg-bg" />

        {/* 메뉴 — 관리 */}
        <MenuGroup>
          <MenuItem href="/my/profile" icon="👤" label="내 프로필 관리" />
          <MenuItem href="/onboarding/coach/plan" icon="💎" label="구독 플랜" rightChip={isPro ? "PRO" : "무료"} />
          <MenuItem
            href="/coach/notifications"
            icon="📩"
            label="학생 등록 요청"
            count={pending}
          />
          <MenuItem href="/coach/schedule" icon="📅" label="전체 스케줄" />
        </MenuGroup>

        <div className="h-2 bg-bg" />

        {/* 메뉴 — 활동 (준비 중) */}
        <MenuGroup>
          <MenuItem icon="📢" label="공지사항 관리" comingSoon />
          <MenuItem icon="⭐" label="리뷰 현황" comingSoon />
          <MenuItem icon="📊" label="통계" rightChip="PRO" comingSoon />
        </MenuGroup>

        <div className="h-2 bg-bg" />

        {/* 메뉴 — 설정 */}
        <MenuGroup>
          <MenuItem icon="🔔" label="알림 설정" comingSoon />
          <MenuItem icon="⚙️" label="계정 관리" comingSoon />
        </MenuGroup>

        <div className="px-5 py-3 text-center text-[11px] text-ink-3">
          {email}
        </div>

        {/* 로그아웃 */}
        <div className="px-5 pb-6">
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full h-11 rounded-xl border border-line bg-surface text-sm font-semibold text-red-500 hover:bg-soft transition"
            >
              로그아웃
            </button>
          </form>
        </div>
      </div>

      <BottomNav role="COACH" active="/my" />
    </main>
  );
}

function StatBox({
  value,
  unit,
  label,
  color,
}: {
  value: number;
  unit: string;
  label: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-4 text-center">
      <div className={`text-2xl font-extrabold ${color}`}>
        {value}
        <span className="ml-0.5 text-xs font-bold text-ink-3">{unit}</span>
      </div>
      <div className="mt-1 text-[11px] font-semibold text-ink-3">{label}</div>
    </div>
  );
}

function MenuGroup({ children }: { children: React.ReactNode }) {
  return <div className="bg-surface divide-y divide-line">{children}</div>;
}

function MenuItem({
  href,
  icon,
  label,
  count = 0,
  rightChip,
  comingSoon = false,
}: {
  href?: string;
  icon: string;
  label: string;
  count?: number;
  rightChip?: string;
  comingSoon?: boolean;
}) {
  const inner = (
    <>
      <span className="w-7 text-center text-lg">{icon}</span>
      <span className="flex-1 text-sm font-medium text-ink">{label}</span>
      {comingSoon && (
        <span className="rounded-full bg-soft px-2 py-0.5 text-[10px] font-semibold text-ink-3">
          준비 중
        </span>
      )}
      {count > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent-coral text-white text-[11px] font-bold">
          {count}
        </span>
      )}
      {rightChip && !comingSoon && (
        <span className="rounded-full bg-accent-purple-soft px-2 py-0.5 text-[10px] font-bold text-accent-purple">
          {rightChip}
        </span>
      )}
      {!comingSoon && <span className="text-ink-3 text-lg leading-none">›</span>}
    </>
  );

  const className =
    "flex items-center gap-3 px-5 py-4 " +
    (comingSoon ? "opacity-60" : "hover:bg-soft transition active:bg-soft");

  if (comingSoon || !href) {
    return (
      <div className={className} aria-disabled={comingSoon}>
        {inner}
      </div>
    );
  }
  return (
    <Link href={href} className={className} prefetch={false}>
      {inner}
    </Link>
  );
}
