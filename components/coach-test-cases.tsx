// 코치 홈 테스트용 — 12종 레슨 상태 카드 + 신규 신청 안내
// 프로토타입 docs/03-prototype/flow7-coach-my/7-0-schedule-home.html 기준
// 실제 DB 연결 전 디자인·상태 케이스 검증용

type Lesson = {
  status: string;
  badgeText: string;
  badgeBg: string;
  badgeColor: string;
  time: string;
  oldTime?: string;
  durationTag?: string;
  studentName: string;
  format: "1:1" | "그룹";
  rounds: string;
  paymentNote?: "미결제" | "외부결제";
  cardBg: string;
  cardBorder: string;
  cardExtra?: string;
  timeColor?: string;
  noteColor?: string;
  faded?: boolean;
  strike?: boolean;
};

const LESSONS: Lesson[] = [
  {
    status: "PENDING",
    badgeText: "⏳ 레슨 신청",
    badgeBg: "bg-amber-100",
    badgeColor: "text-amber-800",
    time: "신청 09:15",
    studentName: "박민호",
    format: "1:1",
    rounds: "화·목 10:00 희망",
    cardBg: "bg-amber-50",
    cardBorder: "border-amber-200",
    timeColor: "text-amber-800",
    noteColor: "text-amber-800",
  },
  {
    status: "COMPLETED",
    badgeText: "레슨완료",
    badgeBg: "bg-blue-100",
    badgeColor: "text-blue-800",
    time: "09:00",
    studentName: "홍길동",
    format: "1:1",
    rounds: "5/8회",
    cardBg: "bg-surface",
    cardBorder: "border-line",
    faded: true,
  },
  {
    status: "ABSENT",
    badgeText: "❌ 결강",
    badgeBg: "bg-gray-100",
    badgeColor: "text-gray-500",
    time: "09:30",
    studentName: "강민서",
    format: "그룹",
    rounds: "3/8회",
    cardBg: "bg-soft",
    cardBorder: "border-line",
    faded: true,
    strike: true,
  },
  {
    status: "IN_PROGRESS",
    badgeText: "🎾 진행중",
    badgeBg: "bg-red-100",
    badgeColor: "text-red-500 animate-pulse",
    time: "10:00",
    studentName: "이민호",
    format: "1:1",
    rounds: "6/8회",
    cardBg: "bg-surface",
    cardBorder: "border-line",
    timeColor: "text-orange-500",
  },
  {
    status: "UPCOMING",
    badgeText: "레슨 예정",
    badgeBg: "bg-purple-100",
    badgeColor: "text-purple-700",
    time: "13:00",
    studentName: "박수진",
    format: "그룹",
    rounds: "2/4회",
    cardBg: "bg-surface",
    cardBorder: "border-line",
  },
  {
    status: "RESCHEDULE_REQUESTED",
    badgeText: "🔄 변경 요청",
    badgeBg: "bg-orange-50",
    badgeColor: "text-orange-600",
    time: "16:00",
    studentName: "박지수",
    format: "1:1",
    rounds: "3/8회",
    cardBg: "bg-surface",
    cardBorder: "border-line",
    timeColor: "text-orange-600",
  },
  {
    status: "RESCHEDULE_COMPLETED",
    badgeText: "✅ 변경완료",
    badgeBg: "bg-blue-100",
    badgeColor: "text-blue-800",
    time: "16:00",
    oldTime: "10:00",
    studentName: "한지원",
    format: "1:1",
    rounds: "5/8회",
    cardBg: "bg-blue-50",
    cardBorder: "border-blue-200",
    timeColor: "text-blue-800",
  },
  {
    status: "MAKEUP_SELECTING",
    badgeText: "🔄 보강 일정 선택중",
    badgeBg: "bg-emerald-100",
    badgeColor: "text-emerald-800",
    time: "16:30",
    studentName: "강민서",
    format: "그룹",
    rounds: "보강",
    cardBg: "bg-teal-50",
    cardBorder: "border-emerald-500 border-dashed",
    cardExtra: "border-[1.5px]",
    timeColor: "text-emerald-600",
  },
  {
    status: "MAKEUP_CONFIRMED",
    badgeText: "✅ 보강확정",
    badgeBg: "bg-emerald-100",
    badgeColor: "text-emerald-800",
    time: "17:00",
    studentName: "김태호",
    format: "1:1",
    rounds: "보강",
    cardBg: "bg-teal-50",
    cardBorder: "border-emerald-500",
    cardExtra: "border-[1.5px]",
    timeColor: "text-emerald-800",
  },
  {
    status: "MAKEUP_REQUESTED",
    badgeText: "🙋 보강 요청",
    badgeBg: "bg-orange-50",
    badgeColor: "text-orange-600",
    time: "17:30",
    studentName: "이수진",
    format: "1:1",
    rounds: "보강 요청",
    cardBg: "bg-orange-50",
    cardBorder: "border-orange-300",
    cardExtra: "border-[1.5px]",
    timeColor: "text-orange-600",
  },
  {
    status: "MERGE",
    badgeText: "🔗 통합 회차",
    badgeBg: "bg-violet-100",
    badgeColor: "text-violet-800",
    time: "10:00",
    durationTag: "40분",
    studentName: "이수진",
    format: "1:1",
    rounds: "통합 (원 회차 2건)",
    cardBg: "bg-violet-50",
    cardBorder: "border-violet-300",
    cardExtra: "border-[1.5px]",
    timeColor: "text-violet-800",
    noteColor: "text-violet-800",
  },
  {
    status: "SPLIT",
    badgeText: "✂ 분할 회차",
    badgeBg: "bg-violet-100",
    badgeColor: "text-violet-800",
    time: "14:00",
    durationTag: "20분 · 1/2",
    studentName: "박지수",
    format: "1:1",
    rounds: "분할 (그룹 2건 중 1)",
    cardBg: "bg-violet-50",
    cardBorder: "border-violet-300",
    cardExtra: "border-[1.5px]",
    timeColor: "text-violet-800",
    noteColor: "text-violet-800",
  },
  {
    status: "UPCOMING_UNPAID",
    badgeText: "레슨 예정",
    badgeBg: "bg-purple-100",
    badgeColor: "text-purple-700",
    time: "18:00",
    studentName: "한지우",
    format: "그룹",
    rounds: "1/4회",
    paymentNote: "미결제",
    cardBg: "bg-surface",
    cardBorder: "border-line",
  },
  {
    status: "UPCOMING_EXTERNAL",
    badgeText: "레슨 예정",
    badgeBg: "bg-purple-100",
    badgeColor: "text-purple-700",
    time: "19:00",
    studentName: "최준혁",
    format: "1:1",
    rounds: "2/10회",
    paymentNote: "외부결제",
    cardBg: "bg-surface",
    cardBorder: "border-line",
  },
];

export function CoachTestCases() {
  return (
    <div className="space-y-3">
      {/* 신규 신청 안내 박스 */}
      <div className="rounded-2xl border-[1.5px] border-amber-200 bg-amber-50 p-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-none">
          <span className="text-base">⏳</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-amber-900">
            새로운 레슨 신청이 <span className="text-amber-600">1</span>건
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

      {/* 카드 리스트 */}
      <div className="space-y-2">
        {LESSONS.map((l, idx) => (
          <LessonCard key={`${l.status}-${idx}`} l={l} />
        ))}
      </div>
    </div>
  );
}

function LessonCard({ l }: { l: Lesson }) {
  return (
    <div
      className={`rounded-xl border ${l.cardBg} ${l.cardBorder} ${l.cardExtra ?? ""} px-4 py-3 flex items-center justify-between gap-3 ${l.faded ? "opacity-70" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div
          className={`text-sm font-bold ${l.timeColor ?? "text-ink"} ${l.strike ? "line-through" : ""}`}
        >
          {l.time}
          {l.oldTime && (
            <span className="ml-1 text-[11px] font-normal text-ink-3 line-through">
              {l.oldTime}
            </span>
          )}
          {l.durationTag && (
            <span className="ml-1 inline-block text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-md">
              {l.durationTag}
            </span>
          )}
        </div>
        <div
          className={`mt-0.5 text-xs text-ink-2 ${l.strike ? "line-through text-ink-3" : ""}`}
        >
          {l.studentName} · {l.format} ·{" "}
          <span className={`font-semibold ${l.noteColor ?? "text-blue-600"}`}>
            {l.rounds}
          </span>
          {l.paymentNote && (
            <>
              {" · "}
              <span
                className={`font-semibold ${l.paymentNote === "미결제" ? "text-red-500" : "text-blue-500"}`}
              >
                {l.paymentNote}
              </span>
            </>
          )}
        </div>
      </div>
      <span
        className={`flex-none rounded-lg px-2 py-1 text-[11px] font-semibold ${l.badgeBg} ${l.badgeColor}`}
      >
        {l.badgeText}
      </span>
    </div>
  );
}
