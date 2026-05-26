/**
 * 학생 홈 — 한국 ATP/WTA 선수 랭킹 카드 (#C3)
 *
 * 데이터: lib/korean-tennis.ts (Jeff Sackmann GitHub 데이터셋)
 * 매주 자동 업데이트, fetch 실패 시 fallback 리스트
 */

import { formatRankingDate, type KoreanTennisData, type RankedPlayer } from "@/lib/korean-tennis";

export function KoreanTennisCard({ data }: { data: KoreanTennisData }) {
  const hasAtp = data.atp.length > 0;
  const hasWta = data.wta.length > 0;
  if (!hasAtp && !hasWta) return null;

  return (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-ink flex items-center gap-1.5">
            🇰🇷 한국 테니스 랭킹
          </div>
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

      {hasAtp && (
        <TourSection title="ATP (남자)" players={data.atp} accent="text-sky-600" />
      )}
      {hasWta && (
        <TourSection title="WTA (여자)" players={data.wta} accent="text-rose-600" />
      )}

      <div className="px-4 py-2 text-[10px] text-ink-3 text-right">
        데이터: Jeff Sackmann tennis_atp / wta · 매주 갱신
      </div>
    </div>
  );
}

function TourSection({
  title,
  players,
  accent,
}: {
  title: string;
  players: RankedPlayer[];
  accent: string;
}) {
  return (
    <div className="px-4 pt-2 pb-1">
      <div className={`text-[11px] font-bold ${accent} mb-1.5`}>{title}</div>
      <ul className="divide-y divide-line/60">
        {players.map((p, idx) => (
          <li key={`${p.playerId}-${idx}`} className="py-2 flex items-center gap-3">
            <div className="w-9 text-center flex-none">
              {p.rank > 0 ? (
                <>
                  <div className="text-[9px] text-ink-3 leading-none">세계</div>
                  <div className="text-sm font-extrabold text-ink leading-none tabular-nums mt-0.5">
                    {p.rank}
                  </div>
                </>
              ) : (
                <div className="text-[9px] text-ink-3">—</div>
              )}
            </div>
            <div className="w-px h-8 bg-line flex-none" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-ink truncate">{p.name}</div>
              {p.name !== p.nameEn && (
                <div className="text-[10px] text-ink-3 truncate">{p.nameEn}</div>
              )}
            </div>
            {p.points > 0 && (
              <div className="flex-none text-right">
                <div className="text-[9px] text-ink-3 leading-none">포인트</div>
                <div className="text-xs font-semibold text-ink-2 leading-none tabular-nums mt-0.5">
                  {p.points.toLocaleString()}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
