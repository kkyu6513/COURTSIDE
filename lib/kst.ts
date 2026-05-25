// KST(한국 표준시) 관련 유틸 — UTC+9 고정.
// Date 객체에 9h를 더한 "KST trick Date"는 UTC 메서드(getUTCHours 등)로 KST 값을 읽기 위한 트릭이다.

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 과거 시각 유예 — 클라이언트/서버 시계 편차 + 네트워크 지연 흡수.
 * 캘린더 빈 영역 클릭과 서버 bookLesson 모두 동일 값 사용해야 정책 일관성 유지.
 */
export const PAST_GRACE_MS = 5 * 60 * 1000;

/**
 * Supabase에서 받은 timestamp 문자열을 UTC Date로 안전하게 파싱한다.
 * tz 표기가 빠진 "YYYY-MM-DDTHH:mm:ss" 형태에는 "Z"를 강제로 붙여서 KST로 잘못 해석되는 것을 막는다.
 */
export function parseIsoUtc(s: string): Date {
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + "Z");
}

/** UTC Date → "KST trick Date" (getUTC* 메서드로 KST 값 읽기용) */
export function toKstTrick(d: Date): Date {
  return new Date(d.getTime() + KST_OFFSET_MS);
}
