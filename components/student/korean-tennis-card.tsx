/**
 * 학생 홈 — ATP/WTA 랭킹 카드 (#C3)
 * 4 섹션: ATP 한국 Top5 / ATP 전체 Top5 / WTA 한국 Top5 / WTA 전체 Top5
 */

import { flagEmoji, formatRankingDate, type RankedPlayer, type TennisRankings } from "@/lib/korean-tennis";

export function KoreanTennisCard({ data }: { data: TennisRankings }) {
  const hasAny =
    data.atp.top5.length > 0 ||
    data.atp.koreanTop5.length > 0 ||
    data.wta.top5.length > 0 ||
    data.wta.koreanTop5.length > 0;
  if (!hasAny) return null;

  return (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-ink">ATP / WTA 랭킹</div>
          <div className="mt-0.5 text-[10px] text-ink-3">
            {data.source === "live" ? formatRankingDate(data.rankingDate) : "최근 등록 선수"}
            {" · 주간 자동 갱신"}
          </div>
        </div>
        {data.source === "fallback" && (
          <span className="flex-none text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
            오프라인
          </span>
        )}
      </div>

      {/* ATP */}
      <div className="px-4 pt-2">
        <div className="text-[11px] font-bold text-sky-600">ATP (남자)</div>
        <div className="mt-1.5 grid grid-cols-1 gap-3">
          <SubSection title="🇰🇷 한국 Top 5" players={data.atp.koreanTop5} emptyText="최근 한국 ATP 랭커 데이터가 없어요" />
          <SubSection title="🌐 전체 Top 5" players={data.atp.top5} emptyText="ATP 데이터 불러올 수 없음" />
        </div>
      </div>

      <div className="mx-4 my-3 h-px bg-line/70" />

      {/* WTA */}
      <div className="px-4 pb-2">
        <div className="text-[11px] font-bold text-rose-600">WTA (여자)</div>
        <div className="mt-1.5 grid grid-cols-1 gap-3">
          <SubSection title="🇰🇷 한국 Top 5" players={data.wta.koreanTop5} emptyText="최근 한국 WTA 랭커 데이터가 없어요" />
          <SubSection title="🌐 전체 Top 5" players={data.wta.top5} emptyText="WTA 데이터 불러올 수 없음" />
        </div>
      </div>

      <div className="px-4 py-2 text-[10px] text-ink-3 text-right border-t border-line/60">
        데이터: Jeff Sackmann tennis_atp / wta · 매주 갱신
      </div>
    </div>
  );
}

function SubSection({
  title,
  players,
  emptyText,
}: {
  title: string;
  players: RankedPlayer[];
  emptyText: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-ink-3 mb-1">{title}</div>
      {players.length === 0 ? (
        <div className="rounded-lg bg-soft px-3 py-2.5 text-[11px] text-ink-3 text-center">
          {emptyText}
        </div>
      ) : (
        <ul className="rounded-lg bg-soft/60 overflow-hidden divide-y divide-line/50">
          {players.map((p, idx) => (
            <PlayerRow key={`${p.playerId}-${idx}`} player={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PlayerRow({ player: p }: { player: RankedPlayer }) {
  return (
    <li className="px-3 py-2 flex items-center gap-2.5">
      <div className="w-8 text-center flex-none">
        {p.rank > 0 ? (
          <div className="text-sm font-extrabold text-ink leading-none tabular-nums">
            {p.rank}
          </div>
        ) : (
          <div className="text-[10px] text-ink-3">—</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-ink truncate flex items-center gap-1.5">
          <span className="flex-none text-[12px] leading-none">{flagEmoji(p.countryCode) || "🏳️"}</span>
          <span className="truncate">{p.name}</span>
        </div>
        {p.name !== p.nameEn && (
          <div className="text-[10px] text-ink-3 truncate">{p.nameEn}</div>
        )}
      </div>
      {p.points > 0 && (
        <div className="flex-none text-right">
          <div className="text-[9px] text-ink-3 leading-none">pts</div>
          <div className="text-[11px] font-semibold text-ink-2 leading-none tabular-nums mt-0.5">
            {p.points.toLocaleString()}
          </div>
        </div>
      )}
    </li>
  );
}
