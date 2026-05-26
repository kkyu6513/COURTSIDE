/**
 * 한국 ATP / WTA 선수 랭킹 자동 수집.
 *
 * 데이터 소스: Jeff Sackmann tennis_atp / tennis_wta GitHub 데이터셋
 *   - 매주 자동 업데이트 (오랜 기간 운영, 학계·통계 사이트 표준)
 *   - GitHub raw URL → CDN 안정성
 *   - 무료, 키 불필요
 *   - 라이선스: CC BY-NC-SA 4.0
 *
 * 안정성 보강:
 *   1) players.csv 는 매우 큼(80k+ rows) — 30일 캐시 + KOR 필터링 후 메모리 저장
 *   2) rankings_current.csv 는 작음(수천 rows) — 24h 캐시
 *   3) 두 fetch 모두 try/catch + 실패 시 정적 fallback 리스트 사용
 *   4) 한국명은 정적 매핑(영문→한글), 누락이면 영문 그대로 노출
 */

const ATP_PLAYERS_URL = "https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/atp_players.csv";
const ATP_RANKINGS_URL = "https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/atp_rankings_current.csv";
const WTA_PLAYERS_URL = "https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/wta_players.csv";
const WTA_RANKINGS_URL = "https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/wta_rankings_current.csv";

// 영문 풀네임 → 한국명 매핑. 데이터셋에 한글이 없어 정적 보강.
// 새 선수 등장 시 여기만 추가하면 됨 (랭킹/통계는 그대로 자동).
const KO_NAME_MAP: Record<string, string> = {
  // ATP
  "Soonwoo Kwon": "권순우",
  "Soon Woo Kwon": "권순우",
  "Hyeon Chung": "정현",
  "Duckhee Lee": "이덕희",
  "Duck Hee Lee": "이덕희",
  "Seong Chan Hong": "홍성찬",
  "Seongchan Hong": "홍성찬",
  "Uisung Park": "박의성",
  "Ui Sung Park": "박의성",
  "Junseong Kim": "김준성",
  "Jun Seong Kim": "김준성",
  "Hong Chung": "정홍",
  "Kihoon Lee": "이기훈",
  "Ki Hoon Lee": "이기훈",
  "Min Kyu Song": "송민규",
  "Minkyu Song": "송민규",
  // WTA
  "Su Jeong Jang": "장수정",
  "Sujeong Jang": "장수정",
  "Dabin Kim": "김다빈",
  "Da Bin Kim": "김다빈",
  "Na Lae Han": "한나래",
  "Nalae Han": "한나래",
  "Jin A Lee": "이진아",
  "Jina Lee": "이진아",
  "Park So Hyun": "박소현",
  "So Hyun Park": "박소현",
};

export type RankedPlayer = {
  rank: number;
  points: number;
  name: string;        // 한국명 우선, 없으면 영문
  nameEn: string;
  playerId: string;
};

export type KoreanTennisData = {
  rankingDate: string | null; // YYYYMMDD
  atp: RankedPlayer[];
  wta: RankedPlayer[];
  source: "live" | "fallback";
};

// fetch 실패 시 정적 fallback (대표 선수 — 실랭킹은 미표시)
const FALLBACK_DATA: KoreanTennisData = {
  rankingDate: null,
  atp: [
    { rank: 0, points: 0, name: "권순우", nameEn: "Soonwoo Kwon", playerId: "" },
    { rank: 0, points: 0, name: "홍성찬", nameEn: "Seong Chan Hong", playerId: "" },
    { rank: 0, points: 0, name: "이덕희", nameEn: "Duckhee Lee", playerId: "" },
  ],
  wta: [
    { rank: 0, points: 0, name: "장수정", nameEn: "Su Jeong Jang", playerId: "" },
  ],
  source: "fallback",
};

/** CSV 한 줄 파싱 — 단순 콤마 split. 값에 콤마 없는 깔끔한 데이터셋이라 OK. */
function parseCsvLine(line: string): string[] {
  return line.split(",").map((s) => s.trim());
}

/** players.csv → KOR 선수만 추출 (player_id → 영문 이름) */
async function fetchKoreanPlayerMap(
  url: string,
  revalidateSec: number,
): Promise<Map<string, string>> {
  const res = await fetch(url, { next: { revalidate: revalidateSec } });
  if (!res.ok) throw new Error(`players fetch failed: ${res.status}`);
  const text = await res.text();
  const lines = text.split("\n");
  // header: player_id,name_first,name_last,hand,dob,ioc,height,wikidata_id
  const map = new Map<string, string>();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 6) continue;
    const [playerId, nameFirst, nameLast, , , ioc] = cols;
    if (ioc === "KOR" && playerId) {
      const en = `${nameFirst} ${nameLast}`.trim();
      map.set(playerId, en);
    }
  }
  return map;
}

/** rankings_current.csv → 한국 선수 랭킹 추출 + 정렬 + Top N */
async function fetchKoreanRankings(
  rankingsUrl: string,
  koreanIdMap: Map<string, string>,
  limit: number,
  revalidateSec: number,
): Promise<{ rankingDate: string | null; players: RankedPlayer[] }> {
  const res = await fetch(rankingsUrl, { next: { revalidate: revalidateSec } });
  if (!res.ok) throw new Error(`rankings fetch failed: ${res.status}`);
  const text = await res.text();
  const lines = text.split("\n");
  // header: ranking_date,rank,player,points,tours
  const out: RankedPlayer[] = [];
  let rankingDate: string | null = null;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 4) continue;
    const [rDate, rankStr, playerId, pointsStr] = cols;
    if (!koreanIdMap.has(playerId)) continue;
    const rank = parseInt(rankStr, 10);
    const points = parseInt(pointsStr, 10) || 0;
    if (!Number.isFinite(rank)) continue;
    if (!rankingDate && rDate) rankingDate = rDate;
    const nameEn = koreanIdMap.get(playerId) ?? "";
    const name = KO_NAME_MAP[nameEn] ?? nameEn;
    out.push({ rank, points, name, nameEn, playerId });
  }
  out.sort((a, b) => a.rank - b.rank);
  return { rankingDate, players: out.slice(0, limit) };
}

/**
 * 한국 ATP/WTA 선수 랭킹을 한 번에 가져옴.
 * - players.csv: 30일 캐시 (선수 명단 변동 매우 적음)
 * - rankings_current.csv: 24h 캐시 (주 1회 갱신이지만 안전 마진)
 * - 두 tour 병렬 fetch, 한 쪽 실패해도 다른 쪽은 살림
 */
export async function fetchKoreanTennis(opts?: {
  limit?: number;
}): Promise<KoreanTennisData> {
  const limit = opts?.limit ?? 5;
  const PLAYERS_TTL = 30 * 24 * 60 * 60; // 30일
  const RANKINGS_TTL = 24 * 60 * 60;     // 24시간

  try {
    const [atpRes, wtaRes] = await Promise.allSettled([
      (async () => {
        const ids = await fetchKoreanPlayerMap(ATP_PLAYERS_URL, PLAYERS_TTL);
        return fetchKoreanRankings(ATP_RANKINGS_URL, ids, limit, RANKINGS_TTL);
      })(),
      (async () => {
        const ids = await fetchKoreanPlayerMap(WTA_PLAYERS_URL, PLAYERS_TTL);
        return fetchKoreanRankings(WTA_RANKINGS_URL, ids, limit, RANKINGS_TTL);
      })(),
    ]);

    const atp = atpRes.status === "fulfilled" ? atpRes.value : null;
    const wta = wtaRes.status === "fulfilled" ? wtaRes.value : null;

    if (!atp && !wta) {
      console.error("[fetchKoreanTennis] both tours failed");
      return FALLBACK_DATA;
    }

    return {
      rankingDate: atp?.rankingDate ?? wta?.rankingDate ?? null,
      atp: atp?.players ?? [],
      wta: wta?.players ?? [],
      source: "live",
    };
  } catch (e) {
    console.error("[fetchKoreanTennis] error:", e);
    return FALLBACK_DATA;
  }
}

/** YYYYMMDD → "MM.DD 기준" */
export function formatRankingDate(yyyymmdd: string | null): string {
  if (!yyyymmdd || yyyymmdd.length < 8) return "최신 기준";
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일 기준`;
}
