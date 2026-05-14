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
