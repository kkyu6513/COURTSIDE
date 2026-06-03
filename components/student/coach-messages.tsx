import { KST_OFFSET_MS, parseIsoUtc } from "@/lib/kst";

export type CoachMessageRow = {
  id: number;
  coachId: string;
  content: string;
  kind: string;          // 'AVAILABILITY' 등
  createdAt: string;     // ISO
  readAt: string | null;
};

type Props = {
  messages: CoachMessageRow[];
  coachNames: Record<string, string>;
};

const DOW_KOR = ["일", "월", "화", "수", "목", "금", "토"];

function relativeTime(iso: string): string {
  const t = parseIsoUtc(iso).getTime();
  const diffSec = Math.floor((Date.now() - t) / 1000);
  if (diffSec < 60) return "방금 전";
  if (diffSec < 60 * 60) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 60 * 60 * 24) return `${Math.floor(diffSec / 3600)}시간 전`;
  if (diffSec < 60 * 60 * 24 * 7) return `${Math.floor(diffSec / 86400)}일 전`;
  // 그 이상은 절대 시각
  const kst = new Date(t + KST_OFFSET_MS);
  const m = kst.getUTCMonth() + 1;
  const d = kst.getUTCDate();
  const dow = DOW_KOR[kst.getUTCDay()];
  return `${m}/${d} (${dow})`;
}

function kindBadge(kind: string): { label: string; cls: string } | null {
  switch (kind) {
    case "AVAILABILITY":
      return { label: "가능 시간 안내", cls: "bg-emerald-50 text-emerald-700" };
    default:
      return null;
  }
}

export function StudentCoachMessages({ messages, coachNames }: Props) {
  if (messages.length === 0) return null;
  return (
    <ul className="divide-y divide-line">
      {messages.map((m) => {
        const coachName = coachNames[m.coachId] ?? "코치";
        const badge = kindBadge(m.kind);
        const isUnread = !m.readAt;
        return (
          <li key={m.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-bold text-ink truncate">
                  {coachName} 코치
                </span>
                {isUnread && (
                  <span
                    className="flex-none inline-block w-1.5 h-1.5 rounded-full bg-red-500"
                    aria-label="안 읽음"
                  />
                )}
                {badge && (
                  <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                    {badge.label}
                  </span>
                )}
              </div>
              <span className="flex-none text-[11px] text-ink-3 tabular-nums">
                {relativeTime(m.createdAt)}
              </span>
            </div>
            <pre className="text-xs text-ink-2 leading-relaxed whitespace-pre-wrap font-sans">
              {m.content}
            </pre>
          </li>
        );
      })}
    </ul>
  );
}
