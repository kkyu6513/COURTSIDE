/**
 * 테니스 명언 — dayOfYear 기반 결정적 선택 (매일 자정에 바뀌고, SSR/CSR 일관성)
 * 출처: docs/03-prototype/flow6-student-my/6-0-schedule-home.html
 */

export type Quote = { t: string; by: string };

export const QUOTES: Quote[] = [
  { t: "최고의 샷은 다음 샷이다.", by: "— Tennis Wisdom" },
  { t: "이길 때보다 질 때 더 많이 배운다.", by: "— Billie Jean King" },
  { t: "챔피언은 코트가 아니라 연습장에서 만들어진다.", by: "— Andre Agassi" },
  { t: "실력은 매일의 1%가 1년 뒤 37배가 된다.", by: "— 1% Rule" },
  { t: "느린 진보가 정체보다 낫다.", by: "— Anonymous" },
  { t: "오늘의 한 발이 내일의 폼이 된다.", by: "— Anonymous" },
  { t: "포기하지 않는 한 슬럼프란 없다.", by: "— Roger Federer (paraphrased)" },
  { t: "폼은 일시적이지만, 클래스는 영원하다.", by: "— Football Adage" },
  { t: "연습이 완벽을 만드는 게 아니라, 완벽한 연습이 완벽을 만든다.", by: "— Vince Lombardi" },
  { t: "코트 위에서 변명은 점수가 되지 못한다.", by: "— Tennis Adage" },
  { t: "챔피언은 한 번 더 일어서는 사람이다.", by: "— Anonymous" },
  { t: "흔한 샷을 매번 완벽하게 치는 사람이 강하다.", by: "— Brad Gilbert" },
  { t: "라켓보다 마음이 먼저 움직인다.", by: "— Anonymous" },
  { t: "매 포인트는 새로운 시작이다.", by: "— Tennis Wisdom" },
  { t: "패배를 두려워하면 승리도 두려워진다.", by: "— Anonymous" },
  { t: "자세가 흐트러지면 마음이 흔들리고, 마음이 흔들리면 샷이 빗나간다.", by: "— Anonymous" },
  { t: "어려운 길이 결국 가장 빠른 길이다.", by: "— Anonymous" },
  { t: "코트 위 1cm의 차이가 경기의 흐름을 바꾼다.", by: "— Anonymous" },
  { t: "잘 친 샷보다 잘 회복한 샷이 경기를 이긴다.", by: "— Anonymous" },
  { t: "코치는 길을 보여주고, 선수는 그 길을 걷는다.", by: "— Anonymous" },
  { t: "폼은 거짓말하지 않는다.", by: "— Anonymous" },
  { t: "강한 서브보다 일관된 서브가 더 무섭다.", by: "— Anonymous" },
  { t: "한 번의 깨달음이 백 번의 연습보다 깊다.", by: "— Anonymous" },
  { t: "두려움 없이 친 샷은 후회하지 않는다.", by: "— Anonymous" },
  { t: "코트 위에서 가장 큰 적은 나 자신이다.", by: "— Anonymous" },
  { t: "빠른 발이 좋은 폼을 만든다.", by: "— Anonymous" },
  { t: "작은 디테일이 큰 차이를 만든다.", by: "— Anonymous" },
  { t: "라이벌은 나를 더 강하게 만든다.", by: "— Anonymous" },
  { t: "패배에서 배우지 못하면 같은 패배가 반복된다.", by: "— Anonymous" },
  { t: "매일 같은 자리에서 1mm씩 나아가라.", by: "— Anonymous" },
  { t: "코트는 정직하다. 연습한 만큼만 돌려준다.", by: "— Anonymous" },
  { t: "호흡을 잃으면 경기를 잃는다.", by: "— Anonymous" },
  { t: "침착함이 가장 강한 무기다.", by: "— Anonymous" },
  { t: "좋은 패배는 좋은 승리만큼 값지다.", by: "— Anonymous" },
  { t: "백핸드보다 멘탈이 먼저 무너진다.", by: "— Anonymous" },
  { t: "작은 습관이 큰 챔피언을 만든다.", by: "— Anonymous" },
  { t: "도전 없는 승리는 기억에 남지 않는다.", by: "— Anonymous" },
  { t: "공에 집중하면 잡생각이 사라진다.", by: "— Anonymous" },
  { t: "나의 페이스로 치는 것이 가장 빠른 길이다.", by: "— Anonymous" },
  { t: "매치포인트보다 매 포인트가 중요하다.", by: "— Anonymous" },
  { t: "천천히 가도 멈추지만 마라.", by: "— Anonymous" },
  { t: "위닝 샷보다 위닝 마인드가 먼저다.", by: "— Anonymous" },
  { t: "라켓을 놓는 순간 발전도 멈춘다.", by: "— Anonymous" },
  { t: "코치의 조언은 길잡이일 뿐, 길은 직접 걷는다.", by: "— Anonymous" },
  { t: "코트 위에서 핑계는 점수가 되지 못한다.", by: "— Anonymous" },
  { t: "어제의 나를 이기는 것이 진짜 승리다.", by: "— Anonymous" },
  { t: "좋은 폼은 좋은 결과를 부른다.", by: "— Anonymous" },
  { t: "한 게임을 잃어도, 한 세트를 잃어도, 다시 일어서면 된다.", by: "— Anonymous" },
  { t: "매일 같은 시간 같은 코트에 서는 것 — 그것이 진짜 실력이다.", by: "— Anonymous" },
  { t: "코트는 거울이다. 노력은 반드시 비춰진다.", by: "— Anonymous" },
  { t: "이기는 습관은 라켓이 아니라 마음에서 시작된다.", by: "— Anonymous" },
];

/** 한국 시간 기준 dayOfYear 계산 → 매일 자정에 명언 변경, SSR/CSR 동일 결과 */
export function todayQuote(now: Date = new Date()): Quote {
  // KST = UTC + 9
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const start = Date.UTC(kst.getUTCFullYear(), 0, 0);
  const diff = kst.getTime() - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return QUOTES[dayOfYear % QUOTES.length];
}

/** 매 호출마다 랜덤 1개 반환. 서버에서 호출하면 매 요청(새로고침)마다 새 명언 */
export function randomQuote(): Quote {
  const idx = Math.floor(Math.random() * QUOTES.length);
  return QUOTES[idx];
}

/** 시간대별 인사 (오전/오후/저녁/밤) */
export function timeGreeting(now: Date = new Date()): string {
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const hour = new Date(kstMs).getUTCHours();
  if (hour >= 5 && hour < 12) return "좋은 아침이에요";
  if (hour >= 12 && hour < 17) return "좋은 오후예요";
  if (hour >= 17 && hour < 21) return "좋은 저녁이에요";
  return "오늘도 수고하셨어요";
}

/** "M월 D일 (요일)" 포맷 */
export function todayLabel(now: Date = new Date()): string {
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const m = kst.getUTCMonth() + 1;
  const d = kst.getUTCDate();
  const dow = ["일", "월", "화", "수", "목", "금", "토"][kst.getUTCDay()];
  return `${m}월 ${d}일 (${dow})`;
}
