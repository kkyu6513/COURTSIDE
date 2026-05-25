import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { BottomNav } from "@/components/bottom-nav";
import {
  stringChangeStatus,
  stringChangeIntervalDays,
  ntrpToNumber,
  type StringStatus,
} from "@/lib/string-change";
import { logStringChange } from "./actions";

export const dynamic = "force-dynamic";

export default async function MyRacketPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = (user.app_metadata as { role?: string } | undefined)?.role ?? "STUDENT";
  if (role === "COACH") redirect("/my");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("student_profiles")
    .select("ntrpLevel")
    .eq("userId", user.id)
    .maybeSingle();
  const ntrp = profile?.ntrpLevel ? ntrpToNumber(profile.ntrpLevel) : 3.0;
  const intervalDays = stringChangeIntervalDays(ntrp);
  const intervalWeeks = (intervalDays / 7).toFixed(1).replace(/\.0$/, "");

  const userRacket = await prisma.userRacket.findFirst({
    where: { userId: user.id, isActive: true },
    include: {
      racket: { include: { proPlayers: { where: { isActive: true }, take: 5 } } },
    },
  });

  // 미등록 상태
  if (!userRacket) {
    return (
      <main className="min-h-screen bg-bg pb-28">
        <TopNav title="내 라켓" />
        <div className="max-w-md mx-auto px-5 pt-16 text-center">
          <div className="text-5xl opacity-50">🎾</div>
          <h1 className="mt-4 text-base font-bold text-ink tracking-tight">
            내 라켓을 등록해보세요
          </h1>
          <p className="mt-2 text-xs text-ink-3 font-medium leading-relaxed">
            매일 새 소식을 받아볼 수 있어요
            <br />
            같은 라켓 프로 선수 경기 결과 · 신모델 · 할인 · 스트링 교체 알림
          </p>
          <Link
            href="/my/racket/register"
            className="inline-flex items-center gap-1.5 mt-6 px-6 py-3 bg-ink text-white rounded-full text-sm font-bold"
          >
            + 라켓 등록하기
          </Link>
        </div>
        <BottomNav role="STUDENT" active="/my" />
      </main>
    );
  }

  const { status, daysLeft } = stringChangeStatus(
    userRacket.lastStringChangeDate ?? null,
    ntrp
  );
  const lastChangeLabel = userRacket.lastStringChangeDate
    ? `${userRacket.lastStringChangeDate.getMonth() + 1}월 ${userRacket.lastStringChangeDate.getDate()}일`
    : "미입력";

  const proPlayers = userRacket.racket.proPlayers;

  return (
    <main className="min-h-screen bg-bg pb-28">
      <TopNav title="내 라켓" actionHref="/my/racket/register" actionLabel="변경" />

      {/* 히어로 */}
      <section className="bg-gradient-to-br from-[#1E3A5F] to-[#475569] text-white">
        <div className="max-w-md mx-auto px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-white/12 flex items-center justify-center text-3xl flex-none">
              🎾
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold tracking-wider uppercase text-white/65">
                {userRacket.racket.brand}
              </div>
              <div className="mt-0.5 text-lg font-extrabold tracking-tight leading-tight">
                {userRacket.racket.model}
              </div>
              <div className="mt-1 text-xs text-white/75 font-medium">
                {userRacket.racket.releaseYear ?? ""} 모델
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/15 grid grid-cols-3 gap-2">
            <HeroStat
              label="헤드"
              value={userRacket.racket.headSize ? `${userRacket.racket.headSize} sq in` : "-"}
            />
            <HeroStat
              label="무게"
              value={userRacket.racket.weight ? `${userRacket.racket.weight} g` : "-"}
            />
            <HeroStat
              label="텐션"
              value={userRacket.stringTension ? `${userRacket.stringTension} lbs` : "-"}
            />
          </div>
        </div>
      </section>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-5">
        {/* 스트링 교체 D-day */}
        <section className="bg-surface border-2 border-line rounded-2xl p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-8 h-8 rounded-lg bg-soft flex items-center justify-center text-sm">
              🪡
            </span>
            <span className="text-xs font-bold text-ink">스트링 교체</span>
            <StringBadge status={status} daysLeft={daysLeft} />
          </div>
          <p className="text-xs text-ink-2 font-medium leading-relaxed">
            마지막 교체 <strong className="text-ink font-bold">{lastChangeLabel}</strong>
            <br />
            NTRP {ntrp.toFixed(1)} 기준 권장 주기는{" "}
            <strong className="text-ink font-bold">{intervalWeeks}주</strong>예요
          </p>

          {/* 진행률 바 */}
          {userRacket.lastStringChangeDate && (
            <>
              <ProgressBar status={status} progressPct={getProgressPct(daysLeft, intervalDays)} />
            </>
          )}

          {/* 교체 기록 폼 (details로 토글) */}
          <details className="mt-3 group">
            <summary className="w-full h-10 rounded-lg border border-line-strong bg-surface text-ink text-xs font-bold cursor-pointer flex items-center justify-center list-none">
              + 스트링 교체 기록
            </summary>
            <form action={logStringChange} className="mt-3 space-y-2.5">
              <FormField label="교체일">
                <input
                  type="date"
                  name="changeDate"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full h-10 px-3 border border-line rounded-lg text-sm font-medium text-ink"
                />
              </FormField>
              <FormField label="텐션 (lbs · 선택)">
                <input
                  type="number"
                  name="tension"
                  min={30}
                  max={70}
                  placeholder="예: 54"
                  defaultValue={userRacket.stringTension ?? ""}
                  className="w-full h-10 px-3 border border-line rounded-lg text-sm font-medium text-ink"
                />
              </FormField>
              <FormField label="스트링 (선택)">
                <input
                  type="text"
                  name="stringType"
                  placeholder="예: Luxilon 4G 125"
                  defaultValue={userRacket.stringType ?? ""}
                  className="w-full h-10 px-3 border border-line rounded-lg text-sm font-medium text-ink"
                />
              </FormField>
              <FormField label="메모 (선택)">
                <input
                  type="text"
                  name="memo"
                  placeholder="느낌·메모"
                  className="w-full h-10 px-3 border border-line rounded-lg text-sm font-medium text-ink"
                />
              </FormField>
              <button
                type="submit"
                className="w-full h-11 rounded-lg bg-ink text-white text-sm font-bold"
              >
                기록 저장
              </button>
            </form>
          </details>
        </section>

        {/* 같은 라켓 프로 선수 */}
        {proPlayers.length > 0 && (
          <section>
            <SectionTitle title="같은 라켓 프로 선수" sub={`${proPlayers.length}명 사용 중`} />
            <ul className="space-y-2">
              {proPlayers.map((p) => (
                <li key={p.id} className="flex items-center gap-3 bg-surface border border-line rounded-xl p-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center text-lg flex-none">
                    🎾
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-ink truncate">
                      {p.nameKo ?? p.name}
                      {p.atpRank && (
                        <span className="ml-1.5 text-[10px] text-ink-3 font-semibold">
                          ({p.tour} {p.atpRank}위)
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-ink-3 font-medium">
                      {p.country}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-ink-3 font-medium">
              ⓘ 경기 결과·하이라이트는 오늘의 코트사이드에서 받아볼 수 있어요
            </p>
          </section>
        )}
      </div>

      <BottomNav role="STUDENT" active="/my" />
    </main>
  );
}

function TopNav({
  title,
  actionHref,
  actionLabel,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <header className="h-14 bg-surface border-b border-line sticky top-0 z-10">
      <div className="max-w-md mx-auto h-full px-2 flex items-center">
        <Link href="/my" aria-label="뒤로" className="w-10 h-10 flex items-center justify-center text-ink text-lg">
          ←
        </Link>
        <h1 className="flex-1 text-center text-base font-bold text-ink tracking-tight">{title}</h1>
        {actionHref ? (
          <Link href={actionHref} className="w-16 text-right pr-2 text-xs font-semibold text-ink-2">
            {actionLabel}
          </Link>
        ) : (
          <span className="w-10" />
        )}
      </div>
    </header>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-white/60">{label}</div>
      <div className="mt-0.5 text-xs font-bold text-white">{value}</div>
    </div>
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

function StringBadge({ status, daysLeft }: { status: StringStatus; daysLeft: number }) {
  const cls =
    status === "OVERDUE"
      ? "bg-red-100 text-red-700"
      : status === "WARN"
        ? "bg-amber-100 text-amber-700"
        : "bg-emerald-50 text-emerald-700";
  const label =
    status === "OVERDUE"
      ? `${Math.abs(daysLeft)}일 초과`
      : status === "WARN"
        ? `D-${daysLeft} 임박`
        : `여유 ${daysLeft}일`;
  return (
    <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}

function ProgressBar({ status, progressPct }: { status: StringStatus; progressPct: number }) {
  const gradient =
    status === "OVERDUE"
      ? "from-red-400 to-red-600"
      : status === "WARN"
        ? "from-amber-300 to-amber-500"
        : "from-emerald-300 to-emerald-500";
  return (
    <div className="mt-3 h-1.5 bg-soft rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${gradient} rounded-full`}
        style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
      />
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-ink-2 mb-1">{label}</label>
      {children}
    </div>
  );
}

function getProgressPct(daysLeft: number, intervalDays: number): number {
  // 사용한 비율 = (interval - daysLeft) / interval * 100
  const used = ((intervalDays - daysLeft) / intervalDays) * 100;
  return Math.min(100, Math.max(0, used));
}
