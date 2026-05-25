/**
 * 테스트용 가입자 목록 — 로그인 화면에서 진입 가능.
 * 운영 노출은 비권장. 추후 토큰/관리자 권한으로 보호 예정.
 */

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskPhone } from "@/lib/masking";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  email: string | null;
  name: string | null;
  realName: string | null;
  phone: string | null;
  role: string | null;
  createdAt: string;
};

function formatKstDate(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export default async function DevUsersPage() {
  const admin = createAdminClient();

  const { data: usersRaw } = await admin
    .from("users")
    .select("id, email, name, realName, phone, role, createdAt")
    .in("role", ["STUDENT", "COACH"])
    .order("createdAt", { ascending: false })
    .limit(200);

  const users = (usersRaw ?? []) as Row[];
  const students = users.filter((u) => u.role === "STUDENT");
  const coaches = users.filter((u) => u.role === "COACH");

  return (
    <main className="min-h-screen bg-bg pb-12">
      <div className="max-w-md mx-auto">
        <div className="flex items-center h-14 px-3 sticky top-0 z-10 bg-bg/85 backdrop-blur border-b border-line">
          <Link
            href="/login"
            aria-label="뒤로가기"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-soft transition text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="flex-1 text-center min-w-0">
            <div className="text-sm font-bold text-ink truncate">가입자 목록</div>
            <div className="text-[10px] text-ink-3 truncate">
              테스트용 · 코치 {coaches.length}명 · 학생 {students.length}명
            </div>
          </div>
          <div className="w-10 h-10" />
        </div>

        <div className="px-5 pt-4 space-y-6">
          <Section title={`코치 (${coaches.length})`} users={coaches} emptyText="아직 등록된 코치가 없어요" />
          <Section title={`학생 (${students.length})`} users={students} emptyText="아직 등록된 학생이 없어요" />
        </div>

        <p className="mt-8 px-5 text-[11px] text-ink-3 leading-relaxed">
          ⚠ 이 화면은 개발/테스트용이에요. 운영 출시 전 권한 보호 또는 제거가 필요합니다.
        </p>
      </div>
    </main>
  );
}

function Section({ title, users, emptyText }: { title: string; users: Row[]; emptyText: string }) {
  return (
    <div>
      <h2 className="text-sm font-bold text-ink mb-2">{title}</h2>
      {users.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <p className="text-sm text-ink-2">{emptyText}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface overflow-hidden divide-y divide-line/70">
          {users.map((u) => (
            <UserRow key={u.id} u={u} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({ u }: { u: Row }) {
  const displayName = u.realName || u.name || "이름 미입력";
  const initial = displayName.slice(0, 1);
  const isCoach = u.role === "COACH";
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-none font-bold text-sm ${isCoach ? "bg-primary/15 text-primary" : "bg-soft text-ink-2"}`}>
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-ink truncate">
          {displayName}
          <span className="ml-1.5 inline-block text-[10px] font-semibold text-ink-3 align-middle">
            {isCoach ? "코치" : "학생"}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-ink-3 truncate">
          {u.phone ? maskPhone(u.phone) : "전화번호 없음"}
          {u.email && (
            <>
              {" · "}
              {u.email}
            </>
          )}
        </div>
      </div>
      <div className="flex-none text-[10px] text-ink-3 whitespace-nowrap">
        {formatKstDate(u.createdAt)}
      </div>
    </div>
  );
}
