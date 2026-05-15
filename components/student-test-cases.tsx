// 학생 홈 테스트용 — 정상 스케줄 등록된 케이스
// 프로토타입 docs/03-prototype/flow6-student-my/6-0-schedule-home.html 기준
// 실제 DB 연결 전 디자인·정상 케이스 검증용

const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];

function getKstParts(d: Date) {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
    dow: kst.getUTCDay(),
    raw: kst,
  };
}

function thisWeekDates(now: Date = new Date()) {
  const today = getKstParts(now);
  const offsetToMon = (today.dow + 6) % 7;
  const monKst = new Date(today.raw);
  monKst.setUTCDate(monKst.getUTCDate() - offsetToMon);
  const days: { day: number; dowKor: string; isToday: boolean; iso: string; idx: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monKst);
    d.setUTCDate(d.getUTCDate() + i);
    days.push({
      day: d.getUTCDate(),
      dowKor: DOW_KOR[d.getUTCDay()],
      isToday: d.getUTCDate() === today.day && d.getUTCMonth() === today.raw.getUTCMonth(),
      iso: d.toISOString().slice(0, 10),
      idx: i, // 0=월, 1=화, ..., 6=일
    });
  }
  return days;
}

// 이번 주 레슨 — 정상 스케줄 케이스
// idx: 0=월, 1=화, 2=수, 3=목, 4=금, 5=토, 6=일
type LessonState = "completed" | "in_progress" | "upcoming";

type StudentLesson = {
  dayIdx: number;
  time: string;
  state: LessonState;
  rounds: string;
  format: "1:1" | "그룹";
  note?: string;
};

const COACH = {
  name: "김민수",
  initial: "김",
  phoneMask: "010-1234-****",
  bioShort: "강남구 테니스센터 · NTRP 4.5",
};

const LESSONS: StudentLesson[] = [
  { dayIdx: 0, time: "10:00", state: "completed", rounds: "5/8회", format: "1:1" },
  { dayIdx: 1, time: "14:00", state: "completed", rounds: "6/8회", format: "1:1" },
  { dayIdx: 3, time: "14:00", state: "upcoming", rounds: "7/8회", format: "1:1" },
  { dayIdx: 5, time: "11:00", state: "upcoming", rounds: "8/8회", format: "1:1", note: "이번 회차 마지막 레슨" },
];

export function StudentTestCases() {
  const week = thisWeekDates();
  const today = getKstParts(new Date());
  const todayIdx = (today.dow + 6) % 7; // 0=월

  // 오늘 진행중 레슨 추가 (오늘이 평일이면)
  const lessonsWithToday: StudentLesson[] = todayIdx <= 4
    ? [...LESSONS.filter((l) => l.dayIdx !== todayIdx), { dayIdx: todayIdx, time: "10:00", state: "in_progress" as const, rounds: "진행중", format: "1:1" as const }]
        .sort((a, b) => a.dayIdx - b.dayIdx || a.time.localeCompare(b.time))
    : LESSONS;

  // 다음 예정 레슨 (D-N 표시용)
  const nextUpcoming = lessonsWithToday.find((l) => l.state === "upcoming" && l.dayIdx >= todayIdx);
  const dDays = nextUpcoming ? nextUpcoming.dayIdx - todayIdx : null;
  const dLabel = dDays === 0 ? "오늘" : dDays === 1 ? "내일" : dDays != null ? `D-${dDays}` : null;

  return (
    <div className="space-y-6">
      {/* 내 코치 카드 (연결됨) */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center flex-none text-lg font-bold">
            {COACH.initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-ink truncate">{COACH.name} 코치</div>
            <div className="mt-0.5 text-[11px] text-ink-3 truncate">{COACH.bioShort}</div>
          </div>
          <button
            type="button"
            className="flex-none inline-flex items-center gap-1 rounded-full bg-soft text-ink-2 text-xs font-semibold px-3 py-1.5 hover:bg-line transition active:scale-[0.98]"
          >
            💬 메시지
          </button>
        </div>
        {nextUpcoming && (
          <div className="mt-3 pt-3 border-t border-line/70 flex items-center justify-between gap-2">
            <div className="text-[11px] text-ink-3">다음 레슨</div>
            <div className="text-xs text-ink-2">
              <span className="font-semibold text-ink">{dLabel}</span>
              {" · "}
              {nextUpcoming.time}
              {" · "}
              {nextUpcoming.rounds}
            </div>
          </div>
        )}
      </div>

      {/* 이번 주 레슨 — 그룹핑된 단일 카드 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-ink">이번 주 레슨</h2>
          <span className="text-[10px] font-semibold text-ink-3 bg-soft px-2 py-0.5 rounded-full">
            테스트 데이터
          </span>
        </div>
        <div className="rounded-2xl border border-line bg-surface overflow-hidden">
          {lessonsWithToday.map((l, idx) => (
            <StudentLessonRow
              key={`${l.dayIdx}-${l.time}-${idx}`}
              lesson={l}
              todayIdx={todayIdx}
              weekDays={week}
              isFirst={idx === 0}
            />
          ))}
        </div>
      </div>

      {/* 응답 필요 — 정상 케이스: 비어있음 */}
      <div>
        <h2 className="text-sm font-bold text-ink mb-2">응답 필요</h2>
        <div className="rounded-2xl bg-soft p-5 text-center">
          <p className="text-sm text-ink-2">처리할 항목이 없어요</p>
          <p className="mt-1 text-[11px] text-ink-3">코치가 보낸 변경/보강 요청이 있을 때 여기 표시돼요</p>
        </div>
      </div>
    </div>
  );
}

function StudentLessonRow({
  lesson,
  todayIdx,
  weekDays,
  isFirst,
}: {
  lesson: StudentLesson;
  todayIdx: number;
  weekDays: { day: number; dowKor: string; isToday: boolean; idx: number }[];
  isFirst: boolean;
}) {
  const day = weekDays[lesson.dayIdx];
  const dowDate = `${day.dowKor} ${day.day}일`;

  const styles = {
    completed: {
      faded: true,
      timeColor: "text-ink-3",
      badgeBg: "bg-blue-100",
      badgeColor: "text-blue-800",
      badgeText: "✓ 완료",
    },
    in_progress: {
      faded: false,
      timeColor: "text-orange-500",
      badgeBg: "bg-red-100",
      badgeColor: "text-red-500 animate-pulse",
      badgeText: "🎾 진행중",
    },
    upcoming: {
      faded: false,
      timeColor: lesson.dayIdx === todayIdx ? "text-orange-500" : "text-ink",
      badgeBg: "bg-purple-100",
      badgeColor: "text-purple-700",
      badgeText: lesson.dayIdx === todayIdx ? "오늘 예정" : "레슨 예정",
    },
  }[lesson.state];

  return (
    <div
      className={`px-4 py-3 flex items-center justify-between gap-3 ${isFirst ? "" : "border-t border-line/70"} ${styles.faded ? "opacity-70" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-bold ${styles.timeColor}`}>
          <span className="text-[11px] font-semibold text-ink-3 mr-1.5">{dowDate}</span>
          {lesson.time}
        </div>
        <div className="mt-0.5 text-xs text-ink-2">
          {COACH.name} 코치 · {lesson.format}
          {lesson.rounds && (
            <>
              {" · "}
              <span className="font-semibold text-blue-600">{lesson.rounds}</span>
            </>
          )}
        </div>
        {lesson.note && (
          <div className="mt-1 text-[11px] text-ink-3">{lesson.note}</div>
        )}
      </div>
      <span className={`flex-none rounded-lg px-2 py-1 text-[11px] font-semibold ${styles.badgeBg} ${styles.badgeColor}`}>
        {styles.badgeText}
      </span>
    </div>
  );
}
