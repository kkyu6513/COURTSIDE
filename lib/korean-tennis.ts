/**
 * ATP / WTA 선수 랭킹 자동 수집.
 *
 * 데이터 소스: Jeff Sackmann tennis_atp / tennis_wta GitHub 데이터셋
 *   - 매주 자동 업데이트 (오랜 기간 운영, 학계·통계 사이트 표준)
 *   - GitHub raw URL → CDN 안정성
 *   - 무료, 키 불필요
 *   - 라이선스: CC BY-NC-SA 4.0
 *
 * 주의: rankings_current.csv 는 최근 여러 주차의 랭킹을 모두 포함.
 *       반드시 가장 최근 ranking_date 만 필터해야 같은 선수가 중복 노출되지 않음.
 */

const ATP_PLAYERS_URL = "https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/atp_players.csv";
const ATP_RANKINGS_URL = "https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/atp_rankings_current.csv";
const WTA_PLAYERS_URL = "https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/wta_players.csv";
const WTA_RANKINGS_URL = "https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/wta_rankings_current.csv";

// 영문 풀네임 → 한국명 매핑. 데이터셋에 한글이 없어 정적 보강.
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
  "Kihoon Lee": "이기훈",
  "Ki Hoon Lee": "이기훈",
  "Min Kyu Song": "송민규",
  "Minkyu Song": "송민규",
  "Sangjun Lee": "이상준",
  "Sang Jun Lee": "이상준",
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
  "Yoo Jin Jang": "장유진",
  "Yoojin Jang": "장유진",
};

export type RankedPlayer = {
  rank: number;
  points: number;
  name: string;          // 한국명 우선(있을 때), 없으면 영문
  nameEn: string;        // 영문 전체
  countryCode: string;   // IOC 3-letter (KOR, USA, ESP …)
  isKorean: boolean;
  playerId: string;
};

export type TourRankings = {
  top5: RankedPlayer[];        // 전체 Top 5 (국적 무관)
  koreanTop5: RankedPlayer[];  // 한국 Top 5
};

export type TennisRankings = {
  rankingDate: string | null; // YYYYMMDD (최신)
  atp: TourRankings;
  wta: TourRankings;
  source: "live" | "fallback";
};

// fetch 실패 시 fallback (대표 한국 선수만)
const FALLBACK_DATA: TennisRankings = {
  rankingDate: null,
  atp: {
    top5: [],
    koreanTop5: [
      { rank: 0, points: 0, name: "권순우", nameEn: "Soonwoo Kwon", countryCode: "KOR", isKorean: true, playerId: "" },
      { rank: 0, points: 0, name: "홍성찬", nameEn: "Seong Chan Hong", countryCode: "KOR", isKorean: true, playerId: "" },
      { rank: 0, points: 0, name: "이덕희", nameEn: "Duckhee Lee", countryCode: "KOR", isKorean: true, playerId: "" },
    ],
  },
  wta: {
    top5: [],
    koreanTop5: [
      { rank: 0, points: 0, name: "장수정", nameEn: "Su Jeong Jang", countryCode: "KOR", isKorean: true, playerId: "" },
    ],
  },
  source: "fallback",
};

function parseCsvLine(line: string): string[] {
  return line.split(",").map((s) => s.trim());
}

type PlayerMeta = { nameEn: string; countryCode: string };

/** players.csv → 전체 player_id 메타 맵 (영문이름 + IOC) */
async function fetchAllPlayerMeta(
  url: string,
  revalidateSec: number,
): Promise<Map<string, PlayerMeta>> {
  const res = await fetch(url, { next: { revalidate: revalidateSec } });
  if (!res.ok) throw new Error(`players fetch failed: ${res.status}`);
  const text = await res.text();
  const lines = text.split("\n");
  const map = new Map<string, PlayerMeta>();
  // header: player_id,name_first,name_last,hand,dob,ioc,height,wikidata_id
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 6) continue;
    const [playerId, nameFirst, nameLast, , , ioc] = cols;
    if (!playerId) continue;
    map.set(playerId, {
      nameEn: `${nameFirst} ${nameLast}`.trim(),
      countryCode: ioc || "",
    });
  }
  return map;
}

/**
 * rankings_current.csv → 최신 ranking_date 만 필터 + (전체 Top N, 한국 Top N) 반환.
 */
async function fetchTourRankings(
  rankingsUrl: string,
  playerMeta: Map<string, PlayerMeta>,
  limit: number,
  revalidateSec: number,
): Promise<{ rankingDate: string | null; tour: TourRankings }> {
  const res = await fetch(rankingsUrl, { next: { revalidate: revalidateSec } });
  if (!res.ok) throw new Error(`rankings fetch failed: ${res.status}`);
  const text = await res.text();
  const lines = text.split("\n");
  // header: ranking_date,rank,player,points,tours

  // 1. 최신 ranking_date 찾기 (정렬 보장 X — 모든 행을 스캔해 max 추출)
  let latestDate = "";
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 4) continue;
    const d = cols[0];
    if (d && d > latestDate) latestDate = d;
  }

  // 2. 최신 ranking_date 행만 가져오기
  const filtered: RankedPlayer[] = [];
  const seen = new Set<string>(); // 중복 player_id 방지(이중 안전망)
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 4) continue;
    const [rDate, rankStr, playerId, pointsStr] = cols;
    if (rDate !== latestDate) continue;
    if (seen.has(playerId)) continue;
    seen.add(playerId);
    const rank = parseInt(rankStr, 10);
    if (!Number.isFinite(rank)) continue;
    const meta = playerMeta.get(playerId);
    const nameEn = meta?.nameEn ?? "(이름 미상)";
    const countryCode = meta?.countryCode ?? "";
    const isKorean = countryCode === "KOR";
    const name = isKorean ? (KO_NAME_MAP[nameEn] ?? nameEn) : nameEn;
    filtered.push({
      rank,
      points: parseInt(pointsStr, 10) || 0,
      name,
      nameEn,
      countryCode,
      isKorean,
      playerId,
    });
  }
  filtered.sort((a, b) => a.rank - b.rank);

  const top5 = filtered.slice(0, limit);
  const koreanTop5 = filtered.filter((p) => p.isKorean).slice(0, limit);

  return {
    rankingDate: latestDate || null,
    tour: { top5, koreanTop5 },
  };
}

/**
 * ATP / WTA 랭킹을 한 번에 가져옴.
 * - players.csv: 30일 캐시
 * - rankings_current.csv: 24h 캐시
 * - Promise.allSettled — 한 tour 실패해도 다른 쪽 살림
 * - 두 tour 모두 실패 시 정적 fallback
 */
export async function fetchTennisRankings(opts?: {
  limit?: number;
}): Promise<TennisRankings> {
  const limit = opts?.limit ?? 5;
  const PLAYERS_TTL = 30 * 24 * 60 * 60;
  const RANKINGS_TTL = 24 * 60 * 60;

  try {
    const [atpRes, wtaRes] = await Promise.allSettled([
      (async () => {
        const meta = await fetchAllPlayerMeta(ATP_PLAYERS_URL, PLAYERS_TTL);
        return fetchTourRankings(ATP_RANKINGS_URL, meta, limit, RANKINGS_TTL);
      })(),
      (async () => {
        const meta = await fetchAllPlayerMeta(WTA_PLAYERS_URL, PLAYERS_TTL);
        return fetchTourRankings(WTA_RANKINGS_URL, meta, limit, RANKINGS_TTL);
      })(),
    ]);

    const atp = atpRes.status === "fulfilled" ? atpRes.value : null;
    const wta = wtaRes.status === "fulfilled" ? wtaRes.value : null;

    if (!atp && !wta) {
      console.error("[fetchTennisRankings] both tours failed");
      return FALLBACK_DATA;
    }

    return {
      rankingDate: atp?.rankingDate ?? wta?.rankingDate ?? null,
      atp: atp?.tour ?? { top5: [], koreanTop5: [] },
      wta: wta?.tour ?? { top5: [], koreanTop5: [] },
      source: "live",
    };
  } catch (e) {
    console.error("[fetchTennisRankings] error:", e);
    return FALLBACK_DATA;
  }
}

/** YYYYMMDD → "M월 D일 기준" */
export function formatRankingDate(yyyymmdd: string | null): string {
  if (!yyyymmdd || yyyymmdd.length < 8) return "최신 기준";
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일 기준`;
}

/** IOC 3-letter → 국기 이모지. 알파벳을 regional indicator로 변환 */
export function flagEmoji(ioc: string): string {
  if (!ioc || ioc.length < 2) return "";
  // IOC → 2-letter ISO 매핑은 대다수 일치. 일치 안 하는 케이스는 예외.
  const IOC_TO_ISO2: Record<string, string> = {
    KOR: "KR", USA: "US", GBR: "GB", FRA: "FR", GER: "DE", ESP: "ES",
    ITA: "IT", RUS: "RU", SUI: "CH", SRB: "RS", GRE: "GR", DEN: "DK",
    NED: "NL", BUL: "BG", POR: "PT", CHI: "CL", CHN: "CN", JPN: "JP",
    AUS: "AU", CAN: "CA", ARG: "AR", BRA: "BR", CZE: "CZ", POL: "PL",
    CRO: "HR", HUN: "HU", AUT: "AT", BEL: "BE", NOR: "NO", SWE: "SE",
    FIN: "FI", UKR: "UA", BLR: "BY", LAT: "LV", LTU: "LT", EST: "EE",
    ROU: "RO", SVK: "SK", SLO: "SI", TPE: "TW", TUR: "TR", IND: "IN",
    KAZ: "KZ", UZB: "UZ", THA: "TH", VIE: "VN", PHI: "PH", MAS: "MY",
    MEX: "MX", COL: "CO", PER: "PE", URU: "UY", PUR: "PR", BOL: "BO",
    ISR: "IL", EGY: "EG", TUN: "TN", MAR: "MA", RSA: "ZA",
  };
  const iso2 = IOC_TO_ISO2[ioc.toUpperCase()] ?? ioc.slice(0, 2).toUpperCase();
  const base = 0x1f1e6 - "A".charCodeAt(0);
  return String.fromCodePoint(iso2.charCodeAt(0) + base, iso2.charCodeAt(1) + base);
}
