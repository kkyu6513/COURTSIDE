/**
 * 레슨 시간/상태 공통 유틸 — lesson-detail-screen, student-home-lessons,
 * coach home-calendar 등에서 중복 정의되던 KST 변환·요일·상태 도출을 모음.
 */

export const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** Supabase가 tz 없는 timestamp를 반환할 수 있으므로 UTC 가정 fallback */
export function parseIsoUtc(s: string): Date {
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + "Z");
}

export function kstParts(d: Date) {
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return {
    y: k.getUTCFullYear(),
    m: k.getUTCMonth() + 1,
    day: k.getUTCDate(),
    dow: k.getUTCDay(),
    hh: String(k.getUTCHours()).padStart(2, "0"),
    mm: String(k.getUTCMinutes()).padStart(2, "0"),
  };
}

export function formatDateLabel(iso: string) {
  const p = kstParts(parseIsoUtc(iso));
  return `${p.m}월 ${p.day}일 (${DOW_KOR[p.dow]})`;
}

export function formatShortDateLabel(iso: string) {
  const p = kstParts(parseIsoUtc(iso));
  return `${p.m}/${p.day} (${DOW_KOR[p.dow]})`;
}

export function formatTimeRange(iso: string, durationMinutes: number) {
  const start = parseIsoUtc(iso);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const s = kstParts(start);
  const e = kstParts(end);
  return `${s.hh}:${s.mm} ~ ${e.hh}:${e.mm}`;
}

export function formatTimeShort(iso: string) {
  const p = kstParts(parseIsoUtc(iso));
  return `${p.hh}:${p.mm}`;
}

/** DB status가 CONFIRMED 인데 현재 시각이 슬롯 내일 때만 IN_PROGRESS 로 도출 */
export function deriveDisplayStatus(
  status: string,
  scheduledAt: string,
  durationMinutes: number,
  nowMs: number,
): string {
  if (status === "CONFIRMED") {
    const start = parseIsoUtc(scheduledAt).getTime();
    const end = start + durationMinutes * 60 * 1000;
    if (nowMs >= start && nowMs < end) return "IN_PROGRESS";
  }
  return status;
}

/**
 * AgeGroup enum 라벨 변환 — TEENS / TWENTIES / THIRTIES / FORTIES / FIFTIES_PLUS
 * 정확한 enum 일치 매칭 (regex 깨짐 방지)
 */
export function ageGroupLabel(v: string | null): string | null {
  if (!v) return null;
  const map: Record<string, string> = {
    TEENS: "10대",
    TWENTIES: "20대",
    THIRTIES: "30대",
    FORTIES: "40대",
    FIFTIES_PLUS: "50대+",
  };
  return map[v] ?? null;
}

export function genderLabel(v: string | null): string | null {
  if (!v) return null;
  if (v === "MALE") return "남";
  if (v === "FEMALE") return "여";
  return null;
}

/** lessons.lessonFormat은 historical로 PRIVATE/GROUP. INDIVIDUAL도 1:1로 매핑 */
export function lessonFormatLabel(f: string): string {
  return f === "GROUP" ? "그룹" : "1:1 개인";
}

/** 다른 화면에서 공통 사용 — 레슨 종료(=라이프사이클 끝) 상태 집합 */
export const TERMINAL_STATUSES = new Set([
  "COMPLETED",
  "CANCELLED",
  "ABSENT",
  "RESCHEDULE_COMPLETED",
]);
