/**
 * FR-16a/c 모크 데이터
 *
 * TODO(외부 연동):
 * - WEATHER: OpenWeatherMap + 에어코리아 API 캐시 30분
 * - KR_MATCH: ATP/WTA API 시간당 갱신
 * - HIGHLIGHT: Claude API 요약 (경기 종료 30분 후) + 어드민 검수
 * - LOCAL_TOURNAMENT: KTA 일정 크롤링 일 1회 04:00
 *
 * 현재는 화면 검증용 정적 데이터.
 */

export type WeatherVerdict = "GOOD" | "CAUTION" | "BAD";

export type WeatherCard = {
  region: string;
  verdict: WeatherVerdict;
  summary: string;
  temperature: number; // °C
  windSpeed: number;   // m/s
  pm10: number;
  observedAt: string;  // ISO
};

export type KrMatchCard = {
  playerName: string;
  opponent: string;
  round: string;
  scheduledKst: string; // "HH:mm" or "LIVE"
  channel: string;
  isLive: boolean;
};

export type HighlightCard = {
  headline: string;
  body: string;
  externalUrl?: string;
  round: string;
};

export type LocalTournamentCard = {
  name: string;
  date: string;       // "YYYY-MM-DD"
  venue: string;
  formatLabel: string; // 단식/복식
  ntrpRangeLabel: string;
  externalUrl?: string;
};

/** 코트 컨디션 자동 판정 (날씨 정책 17.1) */
export function evaluateCourtCondition(input: {
  precipitationMm?: number;
  windSpeed: number;
  pm10: number;
  pm25?: number;
  temperature: number;
}): WeatherVerdict {
  const { precipitationMm = 0, windSpeed, pm10, pm25 = 0, temperature } = input;
  if (precipitationMm > 0) return "BAD";
  if (windSpeed >= 7) return "BAD";
  if (pm10 >= 81 || pm25 >= 36) return "BAD";
  if (windSpeed >= 4) return "CAUTION";
  if (pm10 >= 51 || pm25 >= 16) return "CAUTION";
  if (temperature < 5 || temperature > 33) return "CAUTION";
  return "GOOD";
}

export function buildMockWeather(region: string): WeatherCard {
  const verdict = evaluateCourtCondition({
    windSpeed: 2.1,
    pm10: 32,
    temperature: 21,
  });
  return {
    region,
    verdict,
    summary: "맑음 · 운동하기 좋은 날씨예요",
    temperature: 21,
    windSpeed: 2.1,
    pm10: 32,
    observedAt: new Date().toISOString(),
  };
}

export const MOCK_KR_MATCHES: KrMatchCard[] = [
  {
    playerName: "권순우",
    opponent: "디미트로프",
    round: "16강",
    scheduledKst: "LIVE",
    channel: "SBS 스포츠",
    isLive: true,
  },
  {
    playerName: "박소현",
    opponent: "가우프",
    round: "32강",
    scheduledKst: "23:00",
    channel: "쿠팡플레이",
    isLive: false,
  },
];

export const MOCK_HIGHLIGHT: HighlightCard = {
  headline: "시너, 알카라스 꺾고 결승 진출 — 풀세트 접전",
  body:
    "2시간 47분의 명승부. 시너는 4세트에서 백핸드 다운더라인 위너 12개로 흐름을 가져왔어요. 결정적이었던 5세트 타이브레이크에서 7-3으로 승리.",
  round: "4강",
};

export function mockLocalTournaments(region: string, ntrp: number): LocalTournamentCard[] {
  const base = ntrp.toFixed(1);
  return [
    {
      name: `제3회 ${region}민 친선 테니스 대회`,
      date: "2026-05-30",
      venue: "양재 시민의숲",
      formatLabel: "단식",
      ntrpRangeLabel: `NTRP ${(ntrp - 0.5).toFixed(1)}~${(ntrp + 0.5).toFixed(1)}`,
    },
    {
      name: `${region.replace("구", "")} 오픈 복식 토너먼트`,
      date: "2026-05-31",
      venue: `${region.replace("구", "")} 테니스장`,
      formatLabel: "복식",
      ntrpRangeLabel: `NTRP ${base}~${(ntrp + 1).toFixed(1)}`,
    },
  ];
}

// ─── 그랜드슬램 모크 ───────────────────────────────────────────

export type GrandSlamMatch = {
  scheduledKst: string; // "5/25 화 19:00"
  round: string;
  court: string;
  player1Country: string;
  player1Name: string;
  player1Rank?: string;
  player2Country: string;
  player2Name: string;
  player2Rank?: string;
  channel: string;
  isFavorite?: boolean;
};

export const MOCK_GS_MATCHES: GrandSlamMatch[] = [
  {
    scheduledKst: "오늘 19:00",
    round: "16강",
    court: "코트 필리프 샤트리에",
    player1Country: "🇰🇷",
    player1Name: "권순우",
    player2Country: "🇧🇬",
    player2Name: "디미트로프",
    player2Rank: "15위",
    channel: "SBS 스포츠",
    isFavorite: true,
  },
  {
    scheduledKst: "오늘 22:00",
    round: "16강",
    court: "코트 수잔 렝글렌",
    player1Country: "🇮🇹",
    player1Name: "시너",
    player1Rank: "1위",
    player2Country: "🇫🇷",
    player2Name: "푸이",
    channel: "쿠팡플레이",
  },
  {
    scheduledKst: "내일 02:30",
    round: "16강",
    court: "필리프 샤트리에",
    player1Country: "🇪🇸",
    player1Name: "알카라스",
    player1Rank: "2위",
    player2Country: "🇩🇪",
    player2Name: "즈베레프",
    channel: "JTBC골프&스포츠",
  },
];

export type KrEntrant = {
  name: string;
  rank: string;
  alive: boolean;
  status: string;
};

export const MOCK_KR_ENTRANTS: KrEntrant[] = [
  { name: "권순우", rank: "ATP 65위", alive: true, status: "16강 · 오늘 19:00 vs 디미트로프" },
  { name: "박소현", rank: "WTA 89위", alive: true, status: "32강 · 내일 23:00 vs 가우프" },
  { name: "권혁준", rank: "ATP 142위", alive: false, status: "64강 · vs 시너 · 2-6 4-6" },
  { name: "정현 (복식)", rank: "ATP 복식 38위", alive: true, status: "16강 · 내일 17:00" },
];

export const MOCK_BROADCAST = [
  { logo: "S", color: "#F59E0B", name: "SBS 스포츠", note: "매일 19:00~24:00" },
  { logo: "J", color: "#7C3AED", name: "JTBC골프&스포츠", note: "8강~결승 라이브" },
  { logo: "쿠", color: "#EF4444", name: "쿠팡플레이", note: "전 경기 라이브·다시보기" },
  { logo: "▶", color: "#0EA5E9", name: "유튜브 TENNIS", note: "하이라이트 (무료)" },
];

export const MOCK_AI_HIGHLIGHTS = [
  {
    round: "8강",
    duration: "5분 영상",
    title: "🇮🇹 시너, 🇪🇸 알카라스 꺾고 4강 진출 — 풀세트 명승부",
    body:
      "2시간 47분의 접전. 시너는 백핸드 다운더라인 위너 12개로 4세트를 가져왔고, 5세트 타이브레이크에서 7-3으로 승리했어요.",
  },
  {
    round: "16강",
    duration: "3분 영상",
    title: "🇵🇱 시비옹테크, 첫 세트 빵 허용 후 역전 — WTA 1위의 저력",
    body:
      "상대 페구라에게 1-6으로 첫 세트를 내준 시비옹테크. 2세트부터 톱스핀 포핸드로 베이스라인을 압박해 6-3, 6-2로 역전.",
  },
];
