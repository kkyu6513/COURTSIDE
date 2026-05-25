import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BottomNav } from "@/components/bottom-nav";
import {
  buildMockWeather,
  MOCK_KR_MATCHES,
  MOCK_HIGHLIGHT,
  mockLocalTournaments,
} from "@/lib/courtside-mock";
import { ntrpToNumber } from "@/lib/string-change";
import { updateDailyPushTime } from "./actions";

export const dynamic = "force-dynamic";

const PUSH_OPTIONS = [
  { value: "06:00", label: "매일 오전 6:00" },
  { value: "07:00", label: "매일 오전 7:00" },
  { value: "08:00", label: "매일 오전 8:00 (추천)" },
  { value: "09:00", label: "매일 오전 9:00" },
  { value: "OFF", label: "받지 않기" },
] as const;

export default async function CourtsidePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = (user.app_metadata as { role?: string } | undefined)?.role ?? "STUDENT";
  if (role === "COACH") redirect("/my");

  const admin = createAdminClient();

  // 학생 프로필 (지역·NTRP) + dailyPushTime
  const [{ data: profile }, { data: userRow }] = await Promise.all([
    admin
      .from("student_profiles")
      .select("preferredAreaSigungu, preferredAreaSido, ntrpLevel")
      .eq("userId", user.id)
      .maybeSingle(),
    admin
      .from("users")
      .select("dailyPushTime, name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const region = profile?.preferredAreaSigungu ?? "강남구";
  const ntrp = profile?.ntrpLevel ? ntrpToNumber(profile.ntrpLevel) : 2.75;
  const pushTime = userRow?.dailyPushTime ?? "08:00";
  const greetName =
    userRow?.name ??
    (user.user_metadata?.nickname as string | undefined) ??
    "회원";

  // 데이터 (TODO: 실제 외부 API 연동)
  const weather = buildMockWeather(region);
  const krMatches = MOCK_KR_MATCHES;
  const highlight = MOCK_HIGHLIGHT;
  const tournaments = mockLocalTournaments(region, ntrp);

  const now = new Date();
  const wk = ["일", "월", "화", "수", "목", "금", "토"];
  const dateLabel = `${now.getMonth() + 1}월 ${now.getDate()}일 ${wk[now.getDay()]}요일`;

  return (
    <main className="min-h-screen bg-bg pb-28">
      {/* 헤더 */}
      <header className="bg-gradient-to-br from-[#0F172A] to-[#1E3A5F] text-white">
        <div className="max-w-md mx-auto px-5 pt-6 pb-5">
          <div className="flex items-center justify-between">
            <Link href="/my" aria-label="뒤로" className="w-8 h-8 -ml-1 flex items-center justify-center text-white/85 text-lg">
              ←
            </Link>
            <span className="text-[11px] font-bold tracking-[0.6px] uppercase text-white/65">
              Today&apos;s Courtside
            </span>
            <span className="w-8" />
          </div>
          <div className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">
            {dateLabel}
          </div>
          <div className="mt-1.5 text-xs text-white/75 font-medium">
            {greetName}님, 오늘도 코트로!
          </div>
          <details className="mt-3 group">
            <summary className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-full text-[10px] font-semibold text-white/85 cursor-pointer list-none">
              🔔 {pushTime === "OFF" ? "푸시 꺼짐" : `매일 ${pushTime}에 받아보기`} · 변경
            </summary>
            <form action={updateDailyPushTime} className="mt-3 bg-white/10 rounded-2xl p-3 space-y-1.5">
              {PUSH_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer hover:bg-white/5"
                >
                  <input
                    type="radio"
                    name="pushTime"
                    value={opt.value}
                    defaultChecked={pushTime === opt.value}
                    className="accent-white"
                  />
                  <span className="text-xs font-medium text-white">{opt.label}</span>
                </label>
              ))}
              <button
                type="submit"
                className="mt-2 w-full h-10 rounded-lg bg-white text-ink text-xs font-bold"
              >
                저장
              </button>
            </form>
          </details>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-3">
        {/* 1. 코트 컨디션 */}
        <section className="bg-surface border border-line rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
              🌤
            </span>
            <span className="text-xs font-bold text-ink">오늘 코트 컨디션</span>
            <span className="ml-auto text-[10px] font-semibold text-ink-3">{region}</span>
          </div>
          <div className="flex items-center gap-3.5">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-none ${
                weather.verdict === "GOOD"
                  ? "bg-emerald-50 text-emerald-600"
                  : weather.verdict === "CAUTION"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-red-50 text-red-600"
              }`}
            >
              {weather.verdict === "GOOD" ? "🟢" : weather.verdict === "CAUTION" ? "🟡" : "🔴"}
            </div>
            <div className="min-w-0">
              <div
                className={`text-base font-extrabold tracking-tight ${
                  weather.verdict === "GOOD"
                    ? "text-emerald-600"
                    : weather.verdict === "CAUTION"
                      ? "text-amber-600"
                      : "text-red-600"
                }`}
              >
                {weather.verdict === "GOOD"
                  ? "야외 테니스 가능"
                  : weather.verdict === "CAUTION"
                    ? "주의해서 운동하세요"
                    : "야외 운동 비추천"}
              </div>
              <div className="mt-1 text-xs text-ink-2 font-medium leading-relaxed">
                {weather.summary}
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-line grid grid-cols-3 gap-1.5">
            <Stat label="기온" value={`${weather.temperature}°C`} />
            <Stat label="풍속" value={`${weather.windSpeed} m/s`} />
            <Stat label="미세먼지" value={`${weather.pm10 < 51 ? "좋음" : "보통"} ${weather.pm10}`} />
          </div>
        </section>

        {/* 2. 한국 선수 경기 */}
        <section className="bg-surface border border-line rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-sm">
              🇰🇷
            </span>
            <span className="text-xs font-bold text-ink">오늘 한국 선수 경기</span>
            <span className="ml-auto text-[10px] font-semibold text-ink-3">
              {krMatches.length}경기
            </span>
          </div>
          {krMatches.length === 0 ? (
            <EmptyMini>오늘은 한국 선수 경기가 없어요</EmptyMini>
          ) : (
            <ul className="space-y-1.5">
              {krMatches.map((m) => (
                <li
                  key={m.playerName}
                  className="flex items-center gap-3 px-3 py-2.5 bg-surface border border-line rounded-xl"
                >
                  <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center text-sm flex-none">
                    🎾
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-ink truncate">
                      {m.playerName}
                    </div>
                    <div className="text-xs text-ink-2 font-medium mt-0.5 truncate">
                      vs {m.opponent} · {m.round}
                    </div>
                  </div>
                  <div className="text-right flex-none">
                    <div className="text-xs font-bold text-ink flex items-center gap-1 justify-end">
                      {m.isLive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      )}
                      {m.scheduledKst}
                    </div>
                    <div className="text-[10px] text-ink-3 font-semibold mt-0.5">
                      {m.channel}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 3. 어제 하이라이트 */}
        <section className="bg-surface border border-line rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-sm">
              🏆
            </span>
            <span className="text-xs font-bold text-ink">어제의 하이라이트</span>
            <span className="ml-auto text-[10px] font-semibold text-ink-3">AI 1분 요약</span>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-xl p-3.5">
            <div className="text-sm font-extrabold text-orange-900 leading-snug tracking-tight">
              {highlight.headline}
            </div>
            <p className="mt-2 text-xs text-orange-900/80 font-medium leading-relaxed">
              {highlight.body}
            </p>
            <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-orange-900">
              ▶ 영상 보기 (5분)
            </div>
          </div>
        </section>

        {/* 4. 동호인 대회 */}
        {tournaments.length > 0 && (
          <section className="bg-surface border border-line rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
                📅
              </span>
              <span className="text-xs font-bold text-ink">이번 주 우리 지역 대회</span>
              <span className="ml-auto text-[10px] font-semibold text-ink-3">
                {region} · NTRP {ntrp.toFixed(1)}
              </span>
            </div>
            <ul className="divide-y divide-line">
              {tournaments.map((t, i) => (
                <li key={i} className="flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0">
                  <span className="w-2 h-2 rounded-full bg-primary flex-none" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-ink truncate">{t.name}</div>
                    <div className="text-[10px] text-ink-3 font-medium mt-0.5">
                      {formatDateLabel(t.date)} · {t.venue} · {t.formatLabel}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full flex-none">
                    {t.ntrpRangeLabel}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 5. 다음 레슨 (현재 모크 — TODO: Lesson 테이블 연결) */}
        <Link
          href="/"
          className="block bg-gradient-to-br from-[#0F172A] to-[#334155] text-white rounded-2xl p-4"
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
            다음 레슨까지
          </div>
          <div className="mt-1.5 text-xl font-extrabold tracking-tight">
            예정된 레슨 없음
          </div>
          <div className="mt-1 text-xs text-white/85 font-medium">
            코치에게 등록을 요청해보세요
          </div>
        </Link>
      </div>

      <BottomNav role="STUDENT" active="/my" />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-ink-3">{label}</div>
      <div className="mt-0.5 text-xs font-bold text-ink">{value}</div>
    </div>
  );
}

function EmptyMini({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-3 text-center text-[11px] text-ink-3 font-medium">{children}</div>
  );
}

function formatDateLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const wk = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()}(${wk[d.getDay()]})`;
}
