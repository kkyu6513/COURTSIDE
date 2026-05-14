import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // 로그인 됐는데 역할 없음 - 역할 선택
  const meta = user.app_metadata as
    | { role?: string; plan?: string }
    | undefined;
  const role = meta?.role;
  if (!role) {
    redirect("/onboarding/role");
  }

  // 역할은 있는데 프로필 미등록 - 프로필 등록 페이지
  const admin = createAdminClient();
  if (role === "STUDENT") {
    const { data: studentProfile } = await admin
      .from("student_profiles")
      .select("id")
      .eq("userId", user.id)
      .maybeSingle();
    if (!studentProfile) redirect("/onboarding/student");
  } else if (role === "COACH") {
    // 코치는 플랜 선택 → 프로필 등록 순서
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

  // 정상 홈 (가입 + 프로필 완료)
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md w-full">
        <h1 className="text-4xl font-bold tracking-tight text-ink">
          COURTSIDE
        </h1>
        <p className="mt-3 text-sm text-ink-2">환영해요, {nickname}님 🎾</p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          가입 + 프로필 등록 완료
        </div>

        <div className="mt-8 bg-surface border border-line rounded-xl p-5 text-left space-y-3">
          <div>
            <div className="text-xs text-ink-3">역할</div>
            <div className="mt-1 text-lg font-semibold text-ink">
              {role === "STUDENT"
                ? "🎾 학생"
                : role === "COACH"
                  ? "👨‍🏫 코치"
                  : role}
            </div>
          </div>
          <div className="pt-3 border-t border-line">
            <div className="text-xs text-ink-3">닉네임</div>
            <div className="mt-1 text-sm text-ink">{nickname}</div>
          </div>
          <div className="pt-3 border-t border-line">
            <div className="text-xs text-ink-3">User ID</div>
            <div className="mt-1 text-xs font-mono break-all text-ink-2">
              {user.id}
            </div>
          </div>
        </div>

        <p className="mt-6 text-xs text-ink-3">
          다음 단계: {role === "COACH" ? "스케줄 등록" : "코치 둘러보기"} (작업 중)
        </p>
      </div>
    </main>
  );
}
