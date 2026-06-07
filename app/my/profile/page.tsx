import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskPhone } from "@/lib/masking";
import { ProfileForm, type CoachProfileInitial } from "./profile-form";

export const dynamic = "force-dynamic";

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  // DB는 date(yyyy-MM-dd) 또는 ISO 문자열 — 앞 10자리만 사용
  const s = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
}

export default async function CoachProfileEditPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meta = user.app_metadata as { role?: string } | undefined;
  if (meta?.role !== "COACH") redirect("/");

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("coach_profiles")
    .select("gender, bio, areaSido, areaSigungu, experienceYears")
    .eq("userId", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding/coach");

  const { data: me } = await admin
    .from("users")
    .select("realName, birthDate, phone, email")
    .eq("id", user.id)
    .maybeSingle();

  const initial: CoachProfileInitial = {
    realName: me?.realName ?? "",
    birthDate: toDateInput(me?.birthDate),
    gender: profile.gender ?? "",
    bio: profile.bio ?? "",
    areaSido: profile.areaSido ?? "",
    areaSigungu: profile.areaSigungu ?? "",
    experienceYears:
      profile.experienceYears === null || profile.experienceYears === undefined
        ? ""
        : String(profile.experienceYears),
    phone: me?.phone ? maskPhone(me.phone) : "",
    email: me?.email ?? user.email ?? "",
  };

  return (
    <main className="min-h-screen bg-bg pb-10">
      <div className="max-w-md mx-auto">
        <div className="flex items-center h-14 px-3 sticky top-0 z-10 bg-bg/85 backdrop-blur border-b border-line">
          <Link
            href="/my"
            aria-label="뒤로가기"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-soft transition text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="flex-1 text-center text-sm font-bold text-ink">내 프로필 관리</h1>
          <div className="w-10 h-10" />
        </div>

        <div className="px-5">
          <ProfileForm initial={initial} />
        </div>
      </div>
    </main>
  );
}
