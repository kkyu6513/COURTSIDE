import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BottomNav } from "@/components/bottom-nav";
import { BackButton } from "@/components/back-button";
import { maskPhone } from "@/lib/masking";
import { ClaimActionCard } from "./claim-card";

type Claim = {
  id: number;
  studentUserId: string;
  claimedCoachName: string;
  claimedCoachPhone: string;
  status: string;
  createdAt: string;
  updatedAt: string | null;
};

type Student = {
  id: string;
  realName: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
};

function formatKstDateTime(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const m = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${m}월 ${day}일 ${hh}:${mm}`;
}

export default async function CoachNotificationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") redirect("/");

  const admin = createAdminClient();

  const { data: claimsRaw } = await admin
    .from("student_self_claims")
    .select("id, studentUserId, claimedCoachName, claimedCoachPhone, status, createdAt, updatedAt")
    .eq("matchedCoachUserId", user.id)
    .order("createdAt", { ascending: false });

  const claims = (claimsRaw ?? []) as Claim[];

  let studentMap = new Map<string, Student>();
  if (claims.length > 0) {
    const ids = Array.from(new Set(claims.map((c) => c.studentUserId)));
    const { data: students } = await admin
      .from("users")
      .select("id, realName, name, phone, email")
      .in("id", ids);
    studentMap = new Map((students as Student[] | null ?? []).map((s) => [s.id, s]));
  }

  const pending = claims.filter((c) => c.status === "PENDING");
  const processed = claims.filter((c) => c.status === "CONFIRMED" || c.status === "REJECTED");

  return (
    <main className="min-h-screen bg-bg pb-24">
      <div className="max-w-md mx-auto px-5 pt-6">
        <div className="flex items-center gap-2">
          <BackButton />
          <h1 className="text-xl font-bold text-ink">알림</h1>
        </div>

        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-ink">
              학생 등록 요청
              {pending.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold">
                  {pending.length}
                </span>
              )}
            </h2>
          </div>

          {pending.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-8 text-center">
              <div className="text-3xl">📭</div>
              <p className="mt-2 text-sm text-ink-2">대기 중인 학생 등록 요청이 없어요</p>
              <p className="mt-1 text-xs text-ink-3">
                학생이 본명·전화번호로 회원님께 신청하면 여기에 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((c) => {
                const s = studentMap.get(c.studentUserId);
                const studentName = s?.realName || s?.name || "이름 미입력";
                const studentPhone = s?.phone ? maskPhone(s.phone) : "전화번호 없음";
                return (
                  <ClaimActionCard
                    key={c.id}
                    claimId={c.id}
                    studentName={studentName}
                    studentPhone={studentPhone}
                    createdAtLabel={formatKstDateTime(c.createdAt)}
                    requestedCoachName={c.claimedCoachName}
                  />
                );
              })}
            </div>
          )}
        </section>

        {processed.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-bold text-ink mb-3">처리 완료</h2>
            <div className="space-y-3">
              {processed.map((c) => {
                const s = studentMap.get(c.studentUserId);
                const studentName = s?.realName || s?.name || "이름 미입력";
                const isAccepted = c.status === "CONFIRMED";
                return (
                  <div key={c.id} className="rounded-2xl border border-line bg-surface p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-ink">{studentName}</div>
                        <div className="mt-1 text-xs text-ink-3">
                          {formatKstDateTime(c.updatedAt ?? c.createdAt)}
                        </div>
                      </div>
                      <div
                        className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          isAccepted
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-soft text-ink-3"
                        }`}
                      >
                        {isAccepted ? "수락 완료" : "거절"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <BottomNav role="COACH" active="/coach/notifications" />
    </main>
  );
}
