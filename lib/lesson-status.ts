/**
 * Lesson status 12종의 단일 정의 소스.
 *
 * DB lessons.status 컬럼에 들어올 수 있는 모든 값을 여기서 정의하고,
 * 화면별로 필요한 라벨/색/셀 클래스 매핑을 한 곳에서 관리한다.
 *
 * 이전에는 weekly-timetable / lesson-detail-sheet / lesson-list-sheet 각각이
 * 별도 union 타입(6종)을 정의하고 있어서 새 상태가 들어오면 런타임 크래시
 * (undefined.text)가 났음.
 */

export const LESSON_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "ABSENT",
  "CANCELLED",
  "RESCHEDULE_REQUESTED",
  "RESCHEDULE_COMPLETED",
  "MAKEUP_PENDING",
  "MAKEUP_CONFIRMED",
  "MAKEUP_REQUESTED",
  "MERGE",
  "SPLIT",
] as const;

export type LessonStatus = (typeof LESSON_STATUSES)[number];

/** 화면별로 status 가 unknown string으로 들어와도 안전하게 처리하기 위한 가드 */
export function isLessonStatus(s: string): s is LessonStatus {
  return (LESSON_STATUSES as readonly string[]).includes(s);
}

/** 배지/라벨(시트 상세 / 리스트 시트 공통) */
export type StatusLabelStyle = { text: string; bg: string; fg: string };

export const STATUS_LABEL: Record<LessonStatus, StatusLabelStyle> = {
  PENDING:              { text: "레슨 신청", bg: "bg-amber-50",   fg: "text-amber-600"  },
  CONFIRMED:            { text: "레슨 예정", bg: "bg-violet-50",  fg: "text-violet-600" },
  IN_PROGRESS:          { text: "진행중",    bg: "bg-red-50",     fg: "text-red-500"    },
  COMPLETED:            { text: "완료",      bg: "bg-blue-50",    fg: "text-blue-600"   },
  ABSENT:               { text: "결강",      bg: "bg-gray-100",   fg: "text-gray-500"   },
  CANCELLED:            { text: "취소됨",    bg: "bg-gray-100",   fg: "text-gray-600"   },
  RESCHEDULE_REQUESTED: { text: "변경 요청", bg: "bg-orange-50",  fg: "text-orange-600" },
  RESCHEDULE_COMPLETED: { text: "변경완료",  bg: "bg-blue-50",    fg: "text-blue-600"   },
  MAKEUP_PENDING:       { text: "보강 선택중", bg: "bg-emerald-50", fg: "text-emerald-600" },
  MAKEUP_CONFIRMED:     { text: "보강확정",  bg: "bg-emerald-50", fg: "text-emerald-600" },
  MAKEUP_REQUESTED:     { text: "보강 요청", bg: "bg-orange-50",  fg: "text-orange-600" },
  MERGE:                { text: "통합 회차", bg: "bg-violet-50",  fg: "text-violet-600" },
  SPLIT:                { text: "분할 회차", bg: "bg-violet-50",  fg: "text-violet-600" },
};

/** 알 수 없는 status가 들어왔을 때 fallback */
const FALLBACK_LABEL: StatusLabelStyle = { text: "레슨", bg: "bg-soft", fg: "text-ink-3" };

export function getStatusLabel(s: string): StatusLabelStyle {
  return isLessonStatus(s) ? STATUS_LABEL[s] : FALLBACK_LABEL;
}

/**
 * 1글자 한글 약어 — 좁은 셀에 색과 함께 노출해 색맹 대비 보강.
 * 색만으로 구분하던 셀에 "예/완/결/보" 같은 시각 신호 추가용.
 */
export const STATUS_ABBR: Record<LessonStatus, string> = {
  PENDING:              "신",
  CONFIRMED:            "예",
  IN_PROGRESS:          "진",
  COMPLETED:            "완",
  ABSENT:               "결",
  CANCELLED:            "취",
  RESCHEDULE_REQUESTED: "변",
  RESCHEDULE_COMPLETED: "변",
  MAKEUP_PENDING:       "보",
  MAKEUP_CONFIRMED:     "보",
  MAKEUP_REQUESTED:     "보",
  MERGE:                "통",
  SPLIT:                "분",
};

export function getStatusAbbr(s: string): string {
  return isLessonStatus(s) ? STATUS_ABBR[s] : "·";
}

/** 캘린더 셀 배경/호버 (weekly-timetable 용) */
export const STATUS_CELL_CLASS: Record<LessonStatus, string> = {
  PENDING:              "bg-amber-100 hover:bg-amber-200",
  CONFIRMED:            "bg-violet-100 hover:bg-violet-200",
  IN_PROGRESS:          "bg-red-100 hover:bg-red-200",
  COMPLETED:            "bg-blue-100 hover:bg-blue-200",
  ABSENT:               "bg-gray-100 hover:bg-gray-200 line-through",
  CANCELLED:            "bg-soft hover:bg-soft cursor-not-allowed line-through",
  RESCHEDULE_REQUESTED: "bg-orange-100 hover:bg-orange-200",
  RESCHEDULE_COMPLETED: "bg-blue-100 hover:bg-blue-200",
  MAKEUP_PENDING:       "bg-emerald-100 hover:bg-emerald-200",
  MAKEUP_CONFIRMED:     "bg-emerald-100 hover:bg-emerald-200",
  MAKEUP_REQUESTED:     "bg-orange-100 hover:bg-orange-200",
  MERGE:                "bg-violet-100 hover:bg-violet-200",
  SPLIT:                "bg-violet-100 hover:bg-violet-200",
};

const FALLBACK_CELL_CLASS = "bg-soft hover:bg-soft";

export function getStatusCellClass(s: string): string {
  return isLessonStatus(s) ? STATUS_CELL_CLASS[s] : FALLBACK_CELL_CLASS;
}

/**
 * 시간-블록 캘린더(weekly-timetable 신규) 전용 액센트.
 * 구글 캘린더 스타일 — 연한 배경 + 좌측 두꺼운 컬러 스트라이프 + 본문 텍스트.
 * 셀 표가 아니라 진짜 블록(absolute box)이라 더 또렷한 컬러를 사용할 수 있다.
 */
export type StatusBlockAccent = { bg: string; border: string; text: string };

export const STATUS_BLOCK_ACCENT: Record<LessonStatus, StatusBlockAccent> = {
  PENDING:              { bg: "bg-amber-50",   border: "border-l-amber-500",   text: "text-amber-900"   },
  CONFIRMED:            { bg: "bg-violet-50",  border: "border-l-violet-500",  text: "text-violet-900"  },
  IN_PROGRESS:          { bg: "bg-red-50",     border: "border-l-red-500",     text: "text-red-900"     },
  COMPLETED:            { bg: "bg-blue-50",    border: "border-l-blue-500",    text: "text-blue-900"    },
  ABSENT:               { bg: "bg-gray-100",   border: "border-l-gray-400",    text: "text-gray-700"    },
  CANCELLED:            { bg: "bg-gray-50",    border: "border-l-gray-300",    text: "text-gray-500"    },
  RESCHEDULE_REQUESTED: { bg: "bg-orange-50",  border: "border-l-orange-500",  text: "text-orange-900"  },
  RESCHEDULE_COMPLETED: { bg: "bg-blue-50",    border: "border-l-blue-500",    text: "text-blue-900"    },
  MAKEUP_PENDING:       { bg: "bg-emerald-50", border: "border-l-emerald-500", text: "text-emerald-900" },
  MAKEUP_CONFIRMED:     { bg: "bg-emerald-50", border: "border-l-emerald-600", text: "text-emerald-900" },
  MAKEUP_REQUESTED:     { bg: "bg-orange-50",  border: "border-l-orange-500",  text: "text-orange-900"  },
  MERGE:                { bg: "bg-violet-50",  border: "border-l-violet-600",  text: "text-violet-900"  },
  SPLIT:                { bg: "bg-violet-50",  border: "border-l-violet-600",  text: "text-violet-900"  },
};

const FALLBACK_BLOCK_ACCENT: StatusBlockAccent = {
  bg: "bg-soft",
  border: "border-l-gray-300",
  text: "text-ink",
};

export function getStatusBlockAccent(s: string): StatusBlockAccent {
  return isLessonStatus(s) ? STATUS_BLOCK_ACCENT[s] : FALLBACK_BLOCK_ACCENT;
}

/**
 * DB status + 현재 시각으로 표시용 상태 도출.
 * CONFIRMED 레슨이 실제 진행 시간대(시작 ~ 종료)에 들어오면 IN_PROGRESS로 표시.
 * 그 외에는 DB status 그대로 사용.
 */
export function deriveDisplayStatus(
  status: string,
  scheduledAtIso: string,
  durationMinutes: number,
  nowMs: number = Date.now(),
): string {
  if (status !== "CONFIRMED") return status;
  const startMs = new Date(scheduledAtIso).getTime();
  const endMs = startMs + durationMinutes * 60 * 1000;
  if (nowMs >= startMs && nowMs < endMs) return "IN_PROGRESS";
  return status;
}

/**
 * 새 레슨 등록 시 시간 충돌 검증에서 제외할 status 집합.
 * CANCELLED — 취소된 레슨은 슬롯 미점유.
 * COMPLETED / ABSENT — 이미 끝난 회차는 점유 해제 (보강 회차를 같은 시간에 등록 가능).
 */
export const STATUSES_NOT_BLOCKING_SLOT: LessonStatus[] = [
  "CANCELLED",
  "COMPLETED",
  "ABSENT",
];
