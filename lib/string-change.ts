/**
 * FR-16b 스트링 교체 권장 주기 (NTRP 기반)
 * - 초급 (1.0~2.5): 90일
 * - 중급 (3.0~3.5): 42일 (6주)
 * - 상급 (4.0+):     21일 (3주)
 */
export function stringChangeIntervalDays(ntrp: number): number {
  if (ntrp <= 2.5) return 90;
  if (ntrp <= 3.5) return 42;
  return 21;
}

export type StringStatus = "OK" | "WARN" | "OVERDUE";

export function stringChangeStatus(
  lastChangeDate: Date | null,
  ntrp: number
): { status: StringStatus; daysLeft: number; intervalDays: number } {
  const intervalDays = stringChangeIntervalDays(ntrp);
  if (!lastChangeDate) return { status: "OK", daysLeft: intervalDays, intervalDays };
  const now = new Date();
  const daysSince = Math.floor(
    (now.getTime() - lastChangeDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysLeft = intervalDays - daysSince;
  if (daysLeft < 0) return { status: "OVERDUE", daysLeft, intervalDays };
  if (daysLeft <= 7) return { status: "WARN", daysLeft, intervalDays };
  return { status: "OK", daysLeft, intervalDays };
}

export function ntrpToNumber(ntrpLevel: string): number {
  // "2.5~3.0" 같은 범위 라벨에서 평균값 반환
  const nums = ntrpLevel.match(/[\d.]+/g)?.map(Number) ?? [];
  if (nums.length === 0) return 3.0;
  if (nums.length === 1) return nums[0];
  return (nums[0] + nums[1]) / 2;
}
