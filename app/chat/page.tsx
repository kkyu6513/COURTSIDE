import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";
import { ComingSoon } from "@/components/coming-soon";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = (user.app_metadata as { role?: string } | undefined)?.role;

  return (
    <main className="min-h-screen bg-bg pb-24">
      <div className="max-w-md mx-auto px-5 pt-6">
        <h1 className="text-xl font-extrabold text-ink leading-tight">메시지</h1>
        <p className="mt-1 text-xs text-ink-3">
          코치·수강생과 1:1로 대화해요.
        </p>
        <div className="mt-6">
          <ComingSoon
            title="채팅 기능을 준비하고 있어요"
            description="조금만 기다려 주세요. 곧 만나보실 수 있어요."
          />
        </div>
      </div>
      <BottomNav role={role === "COACH" ? "COACH" : "STUDENT"} active="/chat" />
    </main>
  );
}
