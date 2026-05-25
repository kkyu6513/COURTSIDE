import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";
import { ComingSoon } from "@/components/coming-soon";
import { signOutAction } from "@/app/actions/sign-out";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = (user.app_metadata as { role?: string } | undefined)?.role;
  const nickname =
    (user.user_metadata?.nickname as string | undefined) ||
    user.email ||
    "사용자";
  const displayName = nickname.includes("@") ? (role === "COACH" ? "코치" : "회원") : nickname;

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
              <div className="mt-0.5 text-[11px] text-ink-3">
                {role === "COACH" ? "코치 계정" : "수강생 계정"}
              </div>
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
      <BottomNav role={role === "COACH" ? "COACH" : "STUDENT"} active="/my" />
    </main>
  );
}
