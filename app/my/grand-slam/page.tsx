import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";
import { getGrandSlamState, getAnnualCalendar } from "@/lib/grand-slam";
import {
  MOCK_GS_MATCHES,
  MOCK_KR_ENTRANTS,
  MOCK_BROADCAST,
  MOCK_AI_HIGHLIGHTS,
} from "@/lib/courtside-mock";

export const dynamic = "force-dynamic";

export default async function GrandSlamPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = (user.app_metadata as { role?: string } | undefined)?.role ?? "STUDENT";
  if (role === "COACH") redirect("/my");

  const [state, calendar] = await Promise.all([
    getGrandSlamState(),
    getAnnualCalendar(2026),
  ]);

  return (
    <main className="min-h-screen bg-bg pb-28">
      <header className="h-14 bg-surface border-b border-line sticky top-0 z-10">
        <div className="max-w-md mx-auto h-full px-2 flex items-center">
          <Link href="/my" aria-label="뒤로" className="w-10 h-10 flex items-center justify-center text-ink text-lg">
            ←
          </Link>
          <h1 className="flex-1 text-center text-base font-bold text-ink tracking-tight">
            그랜드슬램 가이드
          </h1>
          <span className="w-10" />
        </div>
      </header>

      {/* 히어로 */}
      {state.mode === "ACTIVE" && (
        <section className="bg-gradient-to-br from-red-600 to-red-700 text-white">
          <div className="max-w-md mx-auto px-5 py-5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 rounded-full text-[10px] font-extrabold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Live · Day {state.dayOfTournament}
            </span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight leading-tight">
              {state.tournament.nameKo}
            </h2>
            <p className="mt-1.5 text-xs text-white/85 font-semibold">
              📍 {state.tournament.city}
            </p>
            <p className="mt-3 text-[11px] text-white/85 font-semibold">
              {fmtMonthDay(state.tournament.startDate)} 시작 ·{" "}
              {fmtMonthDay(state.tournament.endDate)} 결승
            </p>
            <div className="mt-3 h-1 bg-white/18 rounded-full overflow-hidden">
              <div
                className="h-full bg-white"
                style={{
                  width: `${(state.dayOfTournament / state.totalDays) * 100}%`,
                }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[9px] text-white/70 font-semibold uppercase tracking-wider">
              <span>
                D-{state.dayOfTournament} / D-{state.totalDays}
              </span>
              <span>진행 중</span>
            </div>
          </div>
        </section>
      )}

      {state.mode === "UPCOMING" && (
        <section className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white">
          <div className="max-w-md mx-auto px-5 py-5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 rounded-full text-[10px] font-extrabold tracking-wider uppercase">
              Coming Soon
            </span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight leading-tight">
              {state.tournament.nameKo}
            </h2>
            <p className="mt-1.5 text-xs text-white/85 font-semibold">
              📍 {state.tournament.city}
            </p>
            <div className="mt-3 text-4xl font-black tracking-tight">
              D-{state.daysUntil}
            </div>
            <p className="mt-1.5 text-xs text-white/75 font-semibold">
              {fmtMonthDay(state.tournament.startDate)} 개막
            </p>
          </div>
        </section>
      )}

      {state.mode === "NONE" && (
        <section className="bg-soft border-b border-line">
          <div className="max-w-md mx-auto px-5 py-8 text-center">
            <p className="text-xs text-ink-3 font-medium">
              다음 그랜드슬램이 곧 열려요
            </p>
          </div>
        </section>
      )}

      <div className="max-w-md mx-auto px-4 pt-5 space-y-6">
        {state.mode === "ACTIVE" && (
          <>
            {/* 한국 선수 출전 */}
            <section>
              <SectionTitle title="한국 선수 출전" sub={state.tournament.nameKo} />
              <div className="grid grid-cols-2 gap-2">
                {MOCK_KR_ENTRANTS.map((e, i) => (
                  <div key={i} className="bg-surface border border-line rounded-xl p-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center text-lg">
                      🎾
                    </div>
                    <div className="mt-2 text-sm font-bold text-ink tracking-tight">{e.name}</div>
                    <div className="mt-0.5 text-[10px] text-ink-3 font-semibold">
                      {e.rank}
                    </div>
                    <div className="mt-2.5 pt-2.5 border-t border-line">
                      <span
                        className={`inline-block text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wider ${
                          e.alive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {e.alive ? "진행 중" : "탈락"}
                      </span>
                      <p className="mt-1.5 text-[10px] text-ink-2 font-semibold leading-snug">
                        {e.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 오늘의 주요 경기 */}
            <section>
              <SectionTitle title="오늘의 주요 경기" sub="한국시간 기준" />
              <ul className="space-y-2">
                {MOCK_GS_MATCHES.map((m, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 bg-surface border border-line rounded-xl p-3"
                  >
                    <div className="w-14 flex-none text-center pr-2.5 border-r border-line">
                      <div className="text-sm font-extrabold text-ink tracking-tight">
                        {m.scheduledKst.split(" ").pop()}
                      </div>
                      <div className="mt-0.5 text-[9px] text-ink-3 font-semibold tracking-wider">
                        {m.scheduledKst.split(" ").slice(0, -1).join(" ") || "오늘"}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-extrabold text-ink-3 tracking-wider uppercase">
                        {m.round} · {m.court}
                      </div>
                      <div className="mt-1 text-xs font-bold text-ink tracking-tight leading-snug">
                        {m.player1Country} {m.player1Name}
                        {m.player1Rank ? ` (${m.player1Rank})` : ""}
                        <span className="mx-1 text-ink-3 font-semibold">vs</span>
                        {m.player2Country} {m.player2Name}
                        {m.player2Rank ? ` (${m.player2Rank})` : ""}
                      </div>
                      <div className="mt-1 text-[10px] text-ink-2 font-semibold">
                        📺 {m.channel}
                      </div>
                    </div>
                    <span
                      className={`text-base ${m.isFavorite ? "text-amber-500" : "text-ink-3"}`}
                    >
                      {m.isFavorite ? "⭐" : "☆"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 p-2.5 bg-soft rounded-lg text-[10px] text-ink-2 font-medium leading-relaxed">
                🌍 <strong className="text-ink">한국시간 자동 변환</strong> — {state.tournament.city}와의 시차를 반영해 노출돼요.
              </div>
            </section>
          </>
        )}

        {/* 중계 채널 (그랜드슬램 활성/예정 모두 노출) */}
        {state.mode !== "NONE" && state.tournament.broadcastChannels.length > 0 && (
          <section>
            <SectionTitle title="중계 채널" sub="한국 송출" />
            <div className="grid grid-cols-2 gap-2">
              {MOCK_BROADCAST.map((b) => (
                <div key={b.name} className="bg-surface border border-line rounded-xl p-3 flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold text-white flex-none"
                    style={{ background: b.color }}
                  >
                    {b.logo}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-ink tracking-tight truncate">
                      {b.name}
                    </div>
                    <div className="text-[9px] text-ink-3 font-semibold mt-0.5">
                      {b.note}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AI 하이라이트 */}
        {state.mode === "ACTIVE" && (
          <section>
            <SectionTitle title="어제의 AI 하이라이트" sub="5분 요약" />
            <div className="space-y-2">
              {MOCK_AI_HIGHLIGHTS.map((h, i) => (
                <div
                  key={i}
                  className="bg-gradient-to-br from-orange-50 to-orange-200 rounded-xl p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-orange-900/10 text-orange-900 rounded tracking-wider">
                      {h.round}
                    </span>
                    <span className="text-[10px] text-orange-900 font-bold">⏱ {h.duration}</span>
                  </div>
                  <div className="mt-2.5 text-sm font-extrabold text-orange-900 tracking-tight leading-snug">
                    {h.title}
                  </div>
                  <p className="mt-2 text-[11px] text-orange-900/80 font-medium leading-relaxed">
                    {h.body}
                  </p>
                  <div className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-orange-900">
                    ▶ 영상 보기
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 연간 캘린더 */}
        <section>
          <SectionTitle title="2026 그랜드슬램 캘린더" sub="한 해 4대 메이저" />
          <div className="bg-surface border border-line rounded-xl px-4 py-3.5 divide-y divide-line">
            {calendar.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-soft flex-none">
                  🎾
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-ink tracking-tight">{t.name}</div>
                  <div className="text-[10px] text-ink-3 font-medium mt-0.5">
                    {fmtMonthDay(t.startDate)} ~ {fmtMonthDay(t.endDate)} · {t.city}
                  </div>
                </div>
                <CalendarPill status={t.status} daysUntil={t.daysUntil} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <BottomNav role="STUDENT" active="/my" />
    </main>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-2 px-0.5 mb-2.5">
      <span className="text-xs font-bold text-ink">{title}</span>
      {sub && <span className="text-[11px] text-ink-3 font-medium">{sub}</span>}
    </div>
  );
}

function CalendarPill({
  status,
  daysUntil,
}: {
  status: "PAST" | "NOW" | "FUTURE";
  daysUntil: number;
}) {
  if (status === "PAST") {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 bg-soft text-ink-3 rounded-full">
        종료
      </span>
    );
  }
  if (status === "NOW") {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 bg-red-600 text-white rounded-full">
        진행 중
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
      D-{daysUntil}
    </span>
  );
}

function fmtMonthDay(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
