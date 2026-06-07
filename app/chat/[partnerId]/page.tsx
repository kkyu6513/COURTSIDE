import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChatThread } from "@/components/chat/chat-thread";
import { markMessagesRead } from "@/app/actions/messages";

export const dynamic = "force-dynamic";

export default async function ChatThreadPage({
  params,
}: {
  params: { partnerId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = (user.app_metadata as { role?: string } | undefined)?.role;
  if (role !== "COACH" && role !== "STUDENT") redirect("/onboarding/role");

  const partnerId = params.partnerId;
  if (!/^[0-9a-fA-F-]{36}$/.test(partnerId)) notFound();

  const isCoach = role === "COACH";
  const admin = createAdminClient();
  const coachId = isCoach ? user.id : partnerId;
  const studentId = isCoach ? partnerId : user.id;

  // 권한 검증 — confirmed claim 으로 매칭된 상대인지
  const { data: claim } = await admin
    .from("student_self_claims")
    .select("id")
    .eq("studentUserId", studentId)
    .eq("matchedCoachUserId", coachId)
    .eq("status", "CONFIRMED")
    .maybeSingle();
  if (!claim) notFound();

  // 상대 이름
  const { data: partner } = await admin
    .from("users")
    .select("id, realName, name")
    .eq("id", partnerId)
    .maybeSingle();
  const partnerName = partner?.realName || partner?.name || "이름 미입력";

  // 메시지 로드 (오래된 순)
  const { data: messagesRaw } = await admin
    .from("coach_messages")
    .select("id, senderRole, senderId, content, createdAt, readAt")
    .eq("coachId", coachId)
    .eq("studentId", studentId)
    .order("createdAt", { ascending: true })
    .limit(500);

  const messages = (messagesRaw ?? []).map(
    (m: {
      id: number;
      senderRole: string;
      senderId: string | null;
      content: string;
      createdAt: string;
      readAt: string | null;
    }) => ({
      id: m.id,
      isMine: m.senderRole === role,
      content: m.content,
      createdAt: m.createdAt,
      readAt: m.readAt,
    }),
  );

  // 진입 시 본인에게 온 메시지 읽음 처리 (RSC 내에서 직접 호출)
  await markMessagesRead(partnerId);

  return (
    <main className="min-h-screen bg-bg flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col flex-1">
        {/* 헤더 */}
        <div className="flex items-center h-14 px-3 sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-line">
          <Link
            href="/chat"
            aria-label="뒤로가기"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-soft transition text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="flex-1 text-center min-w-0">
            <div className="text-sm font-bold text-ink truncate">{partnerName}</div>
            <div className="text-[10px] text-ink-3">{isCoach ? "수강생" : "코치"}</div>
          </div>
          <div className="w-10 h-10" />
        </div>

        <ChatThread
          partnerId={partnerId}
          partnerName={partnerName}
          initialMessages={messages}
        />
      </div>
    </main>
  );
}
