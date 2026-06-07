import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BottomNav } from "@/components/bottom-nav";

export const dynamic = "force-dynamic";

type MsgRow = {
  id: number;
  coachId: string;
  studentId: string;
  senderRole: string;
  senderId: string | null;
  content: string;
  createdAt: string;
  readAt: string | null;
};

type Partner = {
  partnerId: string;
  name: string;
  lastContent: string;
  lastAt: string;
  unread: number;
  isFromMe: boolean;
};

function formatRelative(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = now - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}일 전`;
  const kst = new Date(t + 9 * 60 * 60 * 1000);
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
}

export default async function ChatPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = (user.app_metadata as { role?: string } | undefined)?.role;
  if (role !== "COACH" && role !== "STUDENT") redirect("/onboarding/role");

  const admin = createAdminClient();
  const isCoach = role === "COACH";

  // 1. 대화 매칭 — confirmed claim 의 모든 상대 (메시지 없어도 보이게)
  const claimQuery = isCoach
    ? admin
        .from("student_self_claims")
        .select("studentUserId")
        .eq("matchedCoachUserId", user.id)
        .eq("status", "CONFIRMED")
    : admin
        .from("student_self_claims")
        .select("matchedCoachUserId")
        .eq("studentUserId", user.id)
        .eq("status", "CONFIRMED");
  const { data: claims } = await claimQuery;
  const partnerIds: string[] = (claims ?? [])
    .map((c: Record<string, string | null>) =>
      isCoach ? c.studentUserId : c.matchedCoachUserId,
    )
    .filter((v: string | null): v is string => !!v);

  // 2. 본인 관련 메시지 모두 (최신 200건)
  const filter = isCoach ? { coachId: user.id } : { studentId: user.id };
  let msgQuery = admin
    .from("coach_messages")
    .select("id, coachId, studentId, senderRole, senderId, content, createdAt, readAt")
    .order("createdAt", { ascending: false })
    .limit(200);
  if (isCoach) msgQuery = msgQuery.eq("coachId", user.id);
  else msgQuery = msgQuery.eq("studentId", user.id);
  const { data: messages } = await msgQuery;
  const msgs = (messages ?? []) as MsgRow[];

  // 3. partner 별로 집계
  const partnerMap = new Map<string, Partner>();
  for (const pid of partnerIds) {
    partnerMap.set(pid, {
      partnerId: pid,
      name: "",
      lastContent: "",
      lastAt: "",
      unread: 0,
      isFromMe: false,
    });
  }
  for (const m of msgs) {
    const partnerId = isCoach ? m.studentId : m.coachId;
    let p = partnerMap.get(partnerId);
    if (!p) {
      p = { partnerId, name: "", lastContent: "", lastAt: "", unread: 0, isFromMe: false };
      partnerMap.set(partnerId, p);
    }
    if (!p.lastAt) {
      p.lastContent = m.content;
      p.lastAt = m.createdAt;
      p.isFromMe = m.senderRole === role;
    }
    const oppositeRole = isCoach ? "STUDENT" : "COACH";
    if (m.senderRole === oppositeRole && !m.readAt) p.unread += 1;
  }

  // 4. partner 이름 조회
  const allIds = Array.from(partnerMap.keys());
  if (allIds.length > 0) {
    const { data: users } = await admin
      .from("users")
      .select("id, realName, name")
      .in("id", allIds);
    for (const u of (users ?? []) as Array<{ id: string; realName: string | null; name: string | null }>) {
      const p = partnerMap.get(u.id);
      if (p) p.name = u.realName || u.name || "이름 미입력";
    }
  }

  // 5. 정렬 — 최근 메시지 우선, 메시지 없는 매칭은 뒤
  const partners = Array.from(partnerMap.values()).sort((a, b) => {
    if (a.lastAt && !b.lastAt) return -1;
    if (!a.lastAt && b.lastAt) return 1;
    return b.lastAt.localeCompare(a.lastAt);
  });

  return (
    <main className="min-h-screen bg-bg pb-24">
      <div className="max-w-md mx-auto px-5 pt-6">
        <h1 className="text-xl font-extrabold text-ink leading-tight">메시지</h1>
        <p className="mt-1 text-xs text-ink-3">
          {isCoach ? "수강생" : "코치"}와 1:1로 대화해요.
        </p>

        {partners.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="text-sm text-ink-2">
              {isCoach ? "아직 매칭된 수강생이 없어요" : "아직 매칭된 코치가 없어요"}
            </p>
            <p className="mt-1 text-[11px] text-ink-3">
              {isCoach
                ? "수강생이 등록 요청을 보내고 수락하면 여기에 표시돼요."
                : "코치에게 등록 요청을 보내고 수락받으면 여기에 표시돼요."}
            </p>
          </div>
        ) : (
          <ul className="mt-4 rounded-2xl border border-line bg-surface overflow-hidden divide-y divide-line/70">
            {partners.map((p) => {
              const initial = (p.name || "?").slice(0, 1);
              const hasMsg = !!p.lastAt;
              return (
                <li key={p.partnerId}>
                  <Link
                    href={`/chat/${p.partnerId}`}
                    className="block px-4 py-3 hover:bg-soft transition active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-base flex-none">
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-bold text-ink truncate">{p.name || "이름 미입력"}</div>
                          {hasMsg && (
                            <div className="flex-none text-[10px] text-ink-3 whitespace-nowrap">
                              {formatRelative(p.lastAt)}
                            </div>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-2 truncate">
                          {hasMsg ? (
                            <>
                              {p.isFromMe && <span className="text-ink-3">나: </span>}
                              {p.lastContent}
                            </>
                          ) : (
                            <span className="text-ink-3">대화를 시작해 보세요</span>
                          )}
                        </div>
                      </div>
                      {p.unread > 0 && (
                        <span className="flex-none min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {p.unread}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <BottomNav role={role} active="/chat" />
    </main>
  );
}
