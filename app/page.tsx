import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Sprint 1 — 카카오 로그인 테스트 단계
          </div>
        </div>
      </main>
    );
  }

  const nickname =
    (user.user_metadata?.nickname as string | undefined) ||
    user.email ||
    "사용자";

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md w-full">
        <h1 className="text-4xl font-bold tracking-tight text-ink">
          COURTSIDE
        </h1>
        <p className="mt-3 text-sm text-ink-2">로그인 성공! 🎉</p>

        <div className="mt-8 bg-surface border border-line rounded-xl p-5 text-left space-y-3">
          <div>
            <div className="text-xs text-ink-3">닉네임</div>
            <div className="mt-1 text-lg font-semibold text-ink">{nickname}</div>
          </div>
          <div className="pt-3 border-t border-line">
            <div className="text-xs text-ink-3">로그인 방식</div>
            <div className="mt-1 text-sm text-ink">
              {(user.user_metadata?.provider as string | undefined) === "kakao"
                ? "카카오"
                : "이메일"}
            </div>
          </div>
          <div className="pt-3 border-t border-line">
            <div className="text-xs text-ink-3">User ID</div>
            <div className="mt-1 text-xs font-mono break-all text-ink-2">
              {user.id}
            </div>
          </div>
        </div>

        <p className="mt-6 text-xs text-ink-3">
          다음 단계: 역할 선택 (학생/코치) + 프로필 등록
        </p>
      </div>
    </main>
  );
}
