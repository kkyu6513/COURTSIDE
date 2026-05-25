import Link from "next/link";
import {
  deriveDisplayStatus,
  formatShortDateLabel,
  formatTimeShort,
} from "@/lib/lesson-time";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type LessonRow = {
  id: number;
  coachId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  lessonFormat: string;
  roundNumber: number | null;
  totalRounds: number | null;
};

type StatusStyle = { label: string; color: string; faded?: boolean; strike?: boolean };

const STATUS_STYLES: Record<string, StatusStyle> = {
  PENDING: { label: "대기 중", color: "text-amber-600" },
  CONFIRMED: { label: "레슨 예정", color: "text-accent-purple" },
  IN_PROGRESS: { label: "진행 중", color: "text-accent-coral" },
  COMPLETED: { label: "완료", color: "text-blue-600", faded: true },
  ABSENT: { label: "결강", color: "text-ink-3", faded: true, strike: true },
  CANCELLED: { label: "취소됨", color: "text-ink-3", faded: true, strike: true },
  RESCHEDULE_REQUESTED: { label: "변경 요청", color: "text-orange-600" },
  RESCHEDULE_COMPLETED: { label: "변경 완료", color: "text-blue-600" },
  MAKEUP_PENDING: { label: "보강 일정 선택중", color: "text-amber-600" },
  MAKEUP_CONFIRMED: { label: "보강 확정", color: "text-accent-purple" },
  MAKEUP_REQUESTED: { label: "보강 요청", color: "text-amber-600" },
  MERGE: { label: "통합 회차", color: "text-accent-purple" },
  SPLIT: { label: "분할 회차", color: "text-accent-purple" },
};

async function loadStudentLessons(studentId: string): Promise<{
  lessons: LessonRow[];
  coachNames: Record<string, string>;
}> {
  const admin = createAdminClient();

  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dow = nowKst.getUTCDay();
  const offsetToMon = (dow + 6) % 7;
  const monKst = new Date(nowKst);
  monKst.setUTCDate(monKst.getUTCDate() - offsetToMon);
  monKst.setUTCHours(0, 0, 0, 0);
  const fromUtc = new Date(monKst.getTime() - 9 * 60 * 60 * 1000);
  const toUtc = new Date(fromUtc.getTime() + 21 * 24 * 60 * 60 * 1000);

  const { data: lessonsRaw } = await admin
    .from("lessons")
    .select("id, coachId, scheduledAt, durationMinutes, status, lessonFormat, roundNumber, totalRounds")
    .eq("studentId", studentId)
    .neq("status", "CANCELLED")
    .gte("scheduledAt", fromUtc.toISOString())
    .lte("scheduledAt", toUtc.toISOString())
    .order("scheduledAt", { ascending: true });

  const lessons = (lessonsRaw ?? []) as LessonRow[];
  const coachIds = Array.from(new Set(lessons.map((l) => l.coachId)));
  const coachNames: Record<string, string> = {};
  if (coachIds.length > 0) {
    const { data: usersRows } = await admin
      .from("users")
      .select("id, realName, name")
      .in("id", coachIds);
    for (const u of (usersRows ?? []) as { id: string; realName: string | null; name: string | null }[]) {
      coachNames[u.id] = u.realName || u.name || "이름 미입력";
    }
  }
  return { lessons, coachNames };
}

export async function StudentHomeLessons() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { lessons, coachNames } = await loadStudentLessons(user.id);

  if (lessons.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <div className="text-3xl">📅</div>
        <p className="mt-2 text-sm text-ink-2">아직 다가오는 레슨이 없어요</p>
        <p className="mt-1 text-xs text-ink-3">코치가 레슨을 등록하면 여기에 표시돼요</p>
      </div>
    );
  }

  // 진행중 판정은 SSR 시각 기준 — 사용자 시점과 약간 차이날 수 있으나 카드 라벨만 영향
  const nowMs = Date.now();

  return (
    <ul className="space-y-2">
      {lessons.map((l) => {
        const display = deriveDisplayStatus(l.status, l.scheduledAt, l.durationMinutes, nowMs);
        const style = STATUS_STYLES[display] ?? { label: "레슨", color: "text-ink-2" };
        const format = l.lessonFormat === "GROUP" ? "그룹" : "1:1";

        return (
          <li key={l.id}>
            <Link
              href={`/lessons/${l.id}`}
              prefetch={false}
              className={`block w-full rounded-xl border border-line bg-surface px-4 py-3 transition active:scale-[0.99] ${style.faded ? "opacity-60" : ""}`}
            >
              <div className={`text-xs font-semibold ${style.color}`}>{style.label}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`flex-none text-sm font-bold text-ink ${style.strike ? "line-through" : ""}`}>
                  {formatShortDateLabel(l.scheduledAt)} {formatTimeShort(l.scheduledAt)}
                </span>
                <span className={`min-w-0 truncate text-xs text-ink-2 ${style.strike ? "line-through text-ink-3" : ""}`}>
                  {coachNames[l.coachId] ?? "코치"} · {format}
                  {l.roundNumber != null && l.totalRounds != null && (
                    <> · {l.roundNumber}/{l.totalRounds}회</>
                  )}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
