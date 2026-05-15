// 코치 홈 — 오늘 레슨 실 데이터 렌더링
// lessons 테이블 + users 조인 결과를 받아 상태별 카드 표시.

export type TodayLesson = {
  id: number;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  paymentStatus: string;
  lessonFormat: string;
  roundNumber: number | null;
  totalRounds: number | null;
  originalScheduledAt: string | null;
  splitIndex: number | null;
  splitTotal: number | null;
  notes: string | null;
  studentName: string;
};

// status → 카드 스타일 매핑
type StatusStyle = {
  badgeText: string;
  badgeBg: string;
  badgeColor: string;
  cardBg: string;
  cardBorder: string;
  cardExtra?: string;
  timeColor?: string;
  noteColor?: string;
  faded?: boolean;
  strike?: boolean;
};

const STATUS_STYLES: Record<string, StatusStyle> = {
  PENDING: {
    badgeText: "⏳ 레슨 신청",
    badgeBg: "bg-amber-100",
    badgeColor: "text-amber-800",
    cardBg: "bg-amber-50",
    cardBorder: "border-amber-200",
    cardExtra: "border-[1.5px]",
    timeColor: "text-amber-800",
    noteColor: "text-amber-800",
  },
  CONFIRMED: {
    badgeText: "레슨 예정",
    badgeBg: "bg-purple-100",
    badgeColor: "text-purple-700",
    cardBg: "bg-surface",
    cardBorder: "border-line",
  },
  IN_PROGRESS: {
    badgeText: "🎾 진행중",
    badgeBg: "bg-red-100",
    badgeColor: "text-red-500 animate-pulse",
    cardBg: "bg-surface",
    cardBorder: "border-line",
    timeColor: "text-orange-500",
  },
  COMPLETED: {
    badgeText: "레슨완료",
    badgeBg: "bg-blue-100",
    badgeColor: "text-blue-800",
    cardBg: "bg-surface",
    cardBorder: "border-line",
    faded: true,
  },
  ABSENT: {
    badgeText: "❌ 결강",
    badgeBg: "bg-gray-100",
    badgeColor: "text-gray-500",
    cardBg: "bg-soft",
    cardBorder: "border-line",
    faded: true,
    strike: true,
  },
  RESCHEDULE_REQUESTED: {
    badgeText: "🔄 변경 요청",
    badgeBg: "bg-orange-50",
    badgeColor: "text-orange-600",
    cardBg: "bg-surface",
    cardBorder: "border-line",
    timeColor: "text-orange-600",
  },
  RESCHEDULE_COMPLETED: {
    badgeText: "✅ 변경완료",
    badgeBg: "bg-blue-100",
    badgeColor: "text-blue-800",
    cardBg: "bg-blue-50",
    cardBorder: "border-blue-200",
    cardExtra: "border-[1.5px]",
    timeColor: "text-blue-800",
  },
  MAKEUP_PENDING: {
    badgeText: "🔄 보강 일정 선택중",
    badgeBg: "bg-emerald-100",
    badgeColor: "text-emerald-800",
    cardBg: "bg-teal-50",
    cardBorder: "border-emerald-500 border-dashed",
    cardExtra: "border-[1.5px]",
    timeColor: "text-emerald-600",
  },
  MAKEUP_CONFIRMED: {
    badgeText: "✅ 보강확정",
    badgeBg: "bg-emerald-100",
    badgeColor: "text-emerald-800",
    cardBg: "bg-teal-50",
    cardBorder: "border-emerald-500",
    cardExtra: "border-[1.5px]",
    timeColor: "text-emerald-800",
  },
  MAKEUP_REQUESTED: {
    badgeText: "🙋 보강 요청",
    badgeBg: "bg-orange-50",
    badgeColor: "text-orange-600",
    cardBg: "bg-orange-50",
    cardBorder: "border-orange-300",
    cardExtra: "border-[1.5px]",
    timeColor: "text-orange-600",
  },
  MERGE: {
    badgeText: "🔗 통합 회차",
    badgeBg: "bg-violet-100",
    badgeColor: "text-violet-800",
    cardBg: "bg-violet-50",
    cardBorder: "border-violet-300",
    cardExtra: "border-[1.5px]",
    timeColor: "text-violet-800",
    noteColor: "text-violet-800",
  },
  SPLIT: {
    badgeText: "✂ 분할 회차",
    badgeBg: "bg-violet-100",
    badgeColor: "text-violet-800",
    cardBg: "bg-violet-50",
    cardBorder: "border-violet-300",
    cardExtra: "border-[1.5px]",
    timeColor: "text-violet-800",
    noteColor: "text-violet-800",
  },
};

const FALLBACK_STYLE: StatusStyle = {
  badgeText: "레슨",
  badgeBg: "bg-gray-100",
  badgeColor: "text-gray-600",
  cardBg: "bg-surface",
  cardBorder: "border-line",
};

// KST HH:mm 변환
function toKstHHMM(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// status 정렬: 신청 > 진행중 > 보강 요청 > 변경 요청 > 보강 일정 > 보강확정 > 변경완료 > 예정 > 완료 > 결강
const STATUS_SORT_ORDER: Record<string, number> = {
  PENDING: 0,
  IN_PROGRESS: 1,
  MAKEUP_REQUESTED: 2,
  RESCHEDULE_REQUESTED: 3,
  MAKEUP_PENDING: 4,
  MAKEUP_CONFIRMED: 5,
  RESCHEDULE_COMPLETED: 6,
  CONFIRMED: 7,
  MERGE: 7,
  SPLIT: 7,
  COMPLETED: 8,
  ABSENT: 9,
};

export function CoachTodayLessons({ lessons }: { lessons: TodayLesson[] }) {
  if (lessons.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-10 text-center">
        <p className="text-sm text-ink-2">오늘 예정된 레슨이 없어요</p>
        <p className="mt-1.5 text-xs text-ink-3">
          스케줄을 등록하거나 학생을 받으면 여기에 표시됩니다.
        </p>
      </div>
    );
  }

  const pendingCount = lessons.filter((l) => l.status === "PENDING").length;

  const sorted = [...lessons].sort((a, b) => {
    const sa = STATUS_SORT_ORDER[a.status] ?? 99;
    const sb = STATUS_SORT_ORDER[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
  });

  return (
    <div className="space-y-3">
      {pendingCount > 0 && (
        <div className="rounded-2xl border-[1.5px] border-amber-200 bg-amber-50 p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-none">
            <span className="text-base">⏳</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-amber-900">
              새로운 레슨 신청이 <span className="text-amber-600">{pendingCount}</span>건
              있어요
            </div>
            <p className="mt-0.5 text-[11px] text-amber-800/80">
              신청을 검토하고 수락 또는 거절해주세요.
            </p>
          </div>
          <svg
            className="w-4 h-4 text-amber-700 flex-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((l) => (
          <LessonCard key={l.id} lesson={l} />
        ))}
      </div>
    </div>
  );
}

function LessonCard({ lesson }: { lesson: TodayLesson }) {
  const style = STATUS_STYLES[lesson.status] ?? FALLBACK_STYLE;
  const time =
    lesson.status === "PENDING"
      ? `신청 ${toKstHHMM(lesson.scheduledAt)}`
      : toKstHHMM(lesson.scheduledAt);
  const oldTime = lesson.originalScheduledAt
    ? toKstHHMM(lesson.originalScheduledAt)
    : null;
  const formatLabel = lesson.lessonFormat === "GROUP" ? "그룹" : "1:1";

  // 회차 노트
  let roundNote = "";
  if (lesson.notes) {
    roundNote = lesson.notes;
  } else if (lesson.roundNumber != null && lesson.totalRounds != null) {
    roundNote = `${lesson.roundNumber}/${lesson.totalRounds}회`;
  }

  // 분/분할 태그
  let durationTag: string | null = null;
  if (lesson.status === "MERGE") {
    durationTag = `${lesson.durationMinutes}분`;
  } else if (lesson.status === "SPLIT" && lesson.splitIndex && lesson.splitTotal) {
    durationTag = `${lesson.durationMinutes}분 · ${lesson.splitIndex}/${lesson.splitTotal}`;
  }

  // 결제 노트
  let paymentNote: "미결제" | "외부결제" | null = null;
  if (lesson.paymentStatus === "UNPAID") paymentNote = "미결제";
  else if (lesson.paymentStatus === "EXTERNAL") paymentNote = "외부결제";

  return (
    <div
      className={`rounded-xl border ${style.cardBg} ${style.cardBorder} ${style.cardExtra ?? ""} px-4 py-3 flex items-center justify-between gap-3 ${style.faded ? "opacity-70" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div
          className={`text-sm font-bold ${style.timeColor ?? "text-ink"} ${style.strike ? "line-through" : ""}`}
        >
          {time}
          {oldTime && (
            <span className="ml-1 text-[11px] font-normal text-ink-3 line-through">
              {oldTime}
            </span>
          )}
          {durationTag && (
            <span className="ml-1 inline-block text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-md">
              {durationTag}
            </span>
          )}
        </div>
        <div
          className={`mt-0.5 text-xs text-ink-2 ${style.strike ? "line-through text-ink-3" : ""}`}
        >
          {lesson.studentName} · {formatLabel}
          {roundNote && (
            <>
              {" · "}
              <span
                className={`font-semibold ${style.noteColor ?? "text-blue-600"}`}
              >
                {roundNote}
              </span>
            </>
          )}
          {paymentNote && (
            <>
              {" · "}
              <span
                className={`font-semibold ${paymentNote === "미결제" ? "text-red-500" : "text-blue-500"}`}
              >
                {paymentNote}
              </span>
            </>
          )}
        </div>
      </div>
      <span
        className={`flex-none rounded-lg px-2 py-1 text-[11px] font-semibold ${style.badgeBg} ${style.badgeColor}`}
      >
        {style.badgeText}
      </span>
    </div>
  );
}
