// 학생 홈 — 이번 주 레슨 / 주간 미니 캘린더 / 응답 필요 / 결제 안내 표시
// 디자인 가이드 — 중립 카드, 상태는 텍스트 라벨

import Link from "next/link";
import { MakeupResponseActions } from "@/components/student/makeup-response-card";

export type StudentLessonRow = {
  id: number;
  coachId: string;
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
};

const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];

function parseIsoUtc(s: string): Date {
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + "Z");
}

function kstParts(d: Date) {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return {
    y: kst.getUTCFullYear(),
    m: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
    dow: kst.getUTCDay(),
    hh: String(kst.getUTCHours()).padStart(2, "0"),
    mm: String(kst.getUTCMinutes()).padStart(2, "0"),
  };
}

// 표시 status — CONFIRMED + 현재 진행 시간대면 IN_PROGRESS로 자동 표시
function deriveDisplayStatus(lesson: StudentLessonRow): string {
  if (lesson.status === "CONFIRMED") {
    const start = parseIsoUtc(lesson.scheduledAt).getTime();
    const end = start + lesson.durationMinutes * 60 * 1000;
    const now = Date.now();
    if (now >= start && now < end) return "IN_PROGRESS";
  }
  return lesson.status;
}

type StatusStyle = {
  label: string;
  color: string;
  faded?: boolean;
  strike?: boolean;
};

const STATUS_STYLES: Record<string, StatusStyle> = {
  PENDING: { label: "신청 대기", color: "text-amber-600" },
  CONFIRMED: { label: "레슨 예정", color: "text-ink-2" },
  IN_PROGRESS: { label: "진행 중", color: "text-primary-600" },
  COMPLETED: { label: "레슨 완료", color: "text-ink-3", faded: true },
  ABSENT: { label: "결강", color: "text-ink-3", faded: true, strike: true },
  RESCHEDULE_REQUESTED: { label: "변경 요청", color: "text-amber-600" },
  RESCHEDULE_COMPLETED: { label: "변경 완료", color: "text-ink-3" },
  MAKEUP_PENDING: { label: "보강 일정 선택 필요", color: "text-amber-600" },
  MAKEUP_CONFIRMED: { label: "보강 확정", color: "text-ink-2" },
  MAKEUP_REQUESTED: { label: "보강 요청", color: "text-amber-600" },
  MERGE: { label: "통합 회차", color: "text-ink-2" },
  SPLIT: { label: "분할 회차", color: "text-ink-2" },
};

const FALLBACK_STYLE: StatusStyle = { label: "레슨", color: "text-ink-3" };

const STATUS_SORT_ORDER: Record<string, number> = {
  IN_PROGRESS: 0,
  MAKEUP_PENDING: 1,
  RESCHEDULE_REQUESTED: 2,
  MAKEUP_REQUESTED: 3,
  RESCHEDULE_COMPLETED: 4,
  MAKEUP_CONFIRMED: 5,
  CONFIRMED: 6,
  MERGE: 6,
  SPLIT: 6,
  PENDING: 7,
  COMPLETED: 8,
  ABSENT: 9,
};

function sortKey(lesson: StudentLessonRow): number {
  return STATUS_SORT_ORDER[deriveDisplayStatus(lesson)] ?? 99;
}

// ========== 주간 미니 캘린더 (read-only) ==========

export function StudentWeekMini({ lessons }: { lessons: StudentLessonRow[] }) {
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayKey = `${nowKst.getUTCFullYear()}-${nowKst.getUTCMonth() + 1}-${nowKst.getUTCDate()}`;
  const dow = nowKst.getUTCDay();
  const offsetToMon = (dow + 6) % 7;
  const monKst = new Date(nowKst);
  monKst.setUTCDate(monKst.getUTCDate() - offsetToMon);
  monKst.setUTCHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monKst);
    d.setUTCDate(d.getUTCDate() + i);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    return {
      key,
      dowKor: DOW_KOR[d.getUTCDay()],
      dayNum: d.getUTCDate(),
      isToday: key === todayKey,
    };
  });

  const countByDay = new Map<string, number>();
  for (const l of lessons) {
    const p = kstParts(parseIsoUtc(l.scheduledAt));
    const k = `${p.y}-${p.m}-${p.day}`;
    countByDay.set(k, (countByDay.get(k) ?? 0) + 1);
  }

  return (
    <div className="flex gap-1.5">
      {days.map((d) => {
        const cnt = countByDay.get(d.key) ?? 0;
        return (
          <div
            key={d.key}
            className={`flex-1 text-center py-2 transition ${
              d.isToday
                ? "rounded-full bg-primary text-white shadow-[0_4px_12px_rgba(45,212,191,0.35)]"
                : ""
            }`}
          >
            <div className={`text-[10px] ${d.isToday ? "text-white/85" : "text-ink-3"}`}>
              {d.dowKor}
            </div>
            <div className={`text-sm font-semibold mt-0.5 ${d.isToday ? "text-white" : "text-ink"}`}>
              {d.dayNum}
            </div>
            <div className="flex justify-center mt-1 h-1.5">
              {cnt > 0 && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${d.isToday ? "bg-white" : "bg-primary"}`}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ========== 이번 주 레슨 리스트 ==========

export function StudentWeekLessons({
  lessons,
  coachNames,
  bare = false,
}: {
  lessons: StudentLessonRow[];
  coachNames: Record<string, string>;
  /** 외곽 박스에 wrap되어 있을 때 — 자체 border/bg 제거, divide-y 분리만 */
  bare?: boolean;
}) {
  if (lessons.length === 0) {
    return (
      <div
        className={
          bare
            ? "py-6 text-center"
            : "rounded-2xl border border-line bg-surface p-8 text-center"
        }
      >
        <p className="text-sm text-ink-2">이번 주 예정된 레슨이 없어요</p>
        <p className="mt-1 text-xs text-ink-3">
          코치님이 레슨을 등록하면 여기에 표시돼요
        </p>
      </div>
    );
  }

  const sorted = [...lessons].sort((a, b) => {
    const sa = sortKey(a);
    const sb = sortKey(b);
    if (sa !== sb) return sa - sb;
    return parseIsoUtc(a.scheduledAt).getTime() - parseIsoUtc(b.scheduledAt).getTime();
  });

  return (
    <ul
      className={
        bare
          ? "divide-y divide-line"
          : "rounded-2xl border border-line bg-surface overflow-hidden"
      }
    >
      {sorted.map((l, idx) => (
        <li key={l.id}>
          <StudentLessonCard
            lesson={l}
            coachName={coachNames[l.coachId] ?? "코치"}
            isFirst={idx === 0}
          />
        </li>
      ))}
    </ul>
  );
}

function StudentLessonCard({
  lesson,
  coachName,
  isFirst,
}: {
  lesson: StudentLessonRow;
  coachName: string;
  isFirst: boolean;
}) {
  const display = deriveDisplayStatus(lesson);
  const style = STATUS_STYLES[display] ?? FALLBACK_STYLE;
  const sp = kstParts(parseIsoUtc(lesson.scheduledAt));
  const dowDate = `${DOW_KOR[sp.dow]} ${sp.day}일`;
  const time = `${sp.hh}:${sp.mm}`;
  const formatLabel = lesson.lessonFormat === "GROUP" ? "그룹" : "1:1";

  let roundNote = "";
  if (lesson.notes) roundNote = lesson.notes;
  else if (lesson.roundNumber != null && lesson.totalRounds != null) {
    roundNote = `${lesson.roundNumber}/${lesson.totalRounds}회`;
  }

  let durationTag: string | null = null;
  if (lesson.status === "MERGE") durationTag = `${lesson.durationMinutes}분`;
  else if (lesson.status === "SPLIT" && lesson.splitIndex && lesson.splitTotal) {
    durationTag = `${lesson.durationMinutes}분 · ${lesson.splitIndex}/${lesson.splitTotal}`;
  }

  const oldTime = lesson.originalScheduledAt
    ? (() => {
        const o = kstParts(parseIsoUtc(lesson.originalScheduledAt!));
        return `${o.hh}:${o.mm}`;
      })()
    : null;

  let paymentNote: "미결제" | "외부결제" | null = null;
  if (lesson.paymentStatus === "UNPAID") paymentNote = "미결제";
  else if (lesson.paymentStatus === "EXTERNAL") paymentNote = "외부결제";

  return (
    <Link
      href={`/lessons/${lesson.id}`}
      prefetch={false}
      className={`block px-4 py-3 transition active:bg-soft/60 ${isFirst ? "" : "border-t border-line/70"} ${style.faded ? "opacity-60" : ""}`}
    >
      <div className={`text-xs font-semibold ${style.color}`}>{style.label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="flex-none text-[11px] font-semibold text-ink-3">{dowDate}</span>
        <span className={`flex-none text-sm font-bold text-ink ${style.strike ? "line-through" : ""}`}>
          {time}
        </span>
        {oldTime && (
          <span className="flex-none text-[11px] text-ink-3 line-through">{oldTime}</span>
        )}
        {durationTag && (
          <span className="flex-none text-[10px] font-semibold text-ink-2 bg-soft px-1.5 py-0.5 rounded">
            {durationTag}
          </span>
        )}
        <span
          className={`min-w-0 truncate text-xs text-ink-2 ${style.strike ? "line-through text-ink-3" : ""}`}
        >
          {coachName} 코치 · {formatLabel}
          {roundNote && <> · {roundNote}</>}
          {paymentNote && (
            <>
              {" · "}
              <span
                className={paymentNote === "미결제" ? "font-semibold text-red-500" : "text-ink-3"}
              >
                {paymentNote}
              </span>
            </>
          )}
        </span>
      </div>
    </Link>
  );
}

// ========== 응답 필요 (학생이 액션해야 할 레슨) ==========

const ACTION_REQUIRED_STATUSES = new Set(["MAKEUP_PENDING"]);

export function StudentResponseRequired({
  lessons,
  coachNames,
  bare = false,
}: {
  lessons: StudentLessonRow[];
  coachNames: Record<string, string>;
  /** 외곽 박스에 wrap되어 있을 때 — 자체 border/bg 제거 */
  bare?: boolean;
}) {
  const items = lessons.filter((l) => ACTION_REQUIRED_STATUSES.has(l.status));
  if (items.length === 0) {
    return (
      <div
        className={
          bare
            ? "py-4 text-center"
            : "rounded-2xl border border-line bg-surface p-5 text-center"
        }
      >
        <p className="text-sm text-ink-2">처리할 항목이 없어요</p>
        <p className="mt-1 text-[11px] text-ink-3">
          코치님이 보낸 변경·보강 요청이 있을 때 여기에 표시돼요
        </p>
      </div>
    );
  }
  return (
    <ul
      className={
        bare
          ? "divide-y divide-line"
          : "rounded-2xl border border-line bg-surface overflow-hidden"
      }
    >
      {items.map((l, idx) => (
        <li key={l.id}>
          <StudentLessonCard
            lesson={l}
            coachName={coachNames[l.coachId] ?? "코치"}
            isFirst={idx === 0}
          />
          {l.status === "MAKEUP_PENDING" && <MakeupResponseActions lessonId={l.id} />}
        </li>
      ))}
    </ul>
  );
}

// ========== 결제 안내 (UNPAID 레슨 수) ==========

export function StudentPaymentNotice({ lessons }: { lessons: StudentLessonRow[] }) {
  const unpaid = lessons.filter((l) => l.paymentStatus === "UNPAID" && l.status !== "CANCELLED");
  if (unpaid.length === 0) return null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="text-xs font-semibold text-amber-700">
        미결제 레슨 {unpaid.length}건
      </div>
      <p className="mt-0.5 text-[11px] text-amber-600">
        결제하신 뒤 코치님께 알려주시면 처리해 드려요.
      </p>
    </div>
  );
}
