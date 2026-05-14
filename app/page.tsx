import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  // 로그인 됐는데 역할 없음 - 온보딩
  const role = (user.app_metadata as { role?: string } | undefined)?.role;
  if (!role) {
    redirect("/onboarding/role");
  }

  const nickname =
    (user.user_metadata?.nickname as string | undefined) ||
    user.email ||
    "사용자";

  // 정상 홈
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md w-full">
        <h1 className="text-4xl font-bold tracking-tight text-ink">
          COURTSIDE
        </h1>
        <p className="mt-3 text-sm text-ink-2">환영해요, {nickname}님 🎾</p>

        <div className="mt-8 bg-surface border border-line rounded-xl p-5 text-left space-y-3">
          <div>
            <div className="text-xs text-ink-3">역할</div>
            <div className="mt-1 text-lg font-semibold text-ink">
              {role === "STUDENT" ? "🎾 학생" : role === "COACH" ? "👨‍🏫 코치" : role}
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
          다음 단계: 프로필 등록 (작업 중)
        </p>
      </div>
    </main>
  );
}
