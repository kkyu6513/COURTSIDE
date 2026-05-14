// 10분 단위 시간 슬롯 데이터 — 06:00~22:50
// 출처: docs/03-prototype/time-slots.js

export type TimeSlot = { code: string; label: string };

function buildSlots(startHour: number, endHourExclusive: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let h = startHour; h < endHourExclusive; h++) {
    for (let m = 0; m < 60; m += 10) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      slots.push({ code: `T${hh}${mm}`, label: `${hh}:${mm}` });
    }
  }
  return slots;
}

export const TIME_SLOTS = {
  AM: buildSlots(6, 12), // 06:00 ~ 11:50
  PM: buildSlots(12, 18), // 12:00 ~ 17:50
  EVENING: buildSlots(18, 23), // 18:00 ~ 22:50
};

export const ALL_TIME_SLOTS: TimeSlot[] = [
  ...TIME_SLOTS.AM,
  ...TIME_SLOTS.PM,
  ...TIME_SLOTS.EVENING,
];

export const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;
export const DAY_NAMES_FULL = [
  "일요일",
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
] as const;
