import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md w-full">
        <h1 className="text-4xl font-bold tracking-tight text-ink">
          COURTSIDE
        </h1>
        <p className="mt-3 text-sm text-ink-2">로그인 성공!</p>

        <div className="mt-8 text-left bg-surface border border-line rounded-xl p-4 space-y-2">
          <div>
            <div className="text-xs text-ink-3">이메일</div>
            <div className="text-sm text-ink mt-1 break-all">{user.email}</div>
          </div>
          <div className="pt-2 border-t border-line">
            <div className="text-xs text-ink-3">User ID</div>
            <div className="text-xs text-ink-2 mt-1 break-all font-mono">
              {user.id}
            </div>
          </div>
        </div>

        <p className="mt-6 text-xs text-ink-3">
          다음 단계: 역할 선택 + 프로필 등록 (작업 중)
        </p>
      </div>
    </main>
  );
}
