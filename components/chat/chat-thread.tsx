"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMessage, markMessagesRead } from "@/app/actions/messages";

type Message = {
  id: number;
  isMine: boolean;
  content: string;
  createdAt: string;
  readAt: string | null;
};

function formatTimeKst(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function dayDividerLabel(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const yest = new Date(now);
  yest.setUTCDate(yest.getUTCDate() - 1);
  if (isSameDay(kst, now)) return "오늘";
  if (isSameDay(kst, yest)) return "어제";
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
}

export function ChatThread({
  partnerId,
  partnerName,
  initialMessages,
}: {
  partnerId: string;
  partnerName: string;
  initialMessages: Message[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true); // 사용자가 하단 근처에 있는지
  const [hasNewBelow, setHasNewBelow] = useState(false); // 위로 스크롤한 동안 새 메시지 도착
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const prevCountRef = useRef(messages.length);

  // 스크롤 추적 — 하단 근처(80px 이내)면 stickToBottom = true
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < 80;
    setStickToBottom(isNearBottom);
    if (isNearBottom) setHasNewBelow(false);
  };

  // 메시지 변경 시 — 하단 근처에 있었으면 자동 스크롤, 위에 있었으면 chip 알림만 (#P1)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prevCount = prevCountRef.current;
    const newCount = messages.length;
    prevCountRef.current = newCount;
    if (newCount > prevCount) {
      if (stickToBottom) {
        el.scrollTop = el.scrollHeight;
      } else {
        setHasNewBelow(true);
      }
    } else if (newCount === prevCount && prevCount === initialMessages.length) {
      // 첫 마운트
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, stickToBottom, initialMessages.length]);

  // Visibility-aware polling — 활성 5초, 백그라운드면 정지 (#P4)
  useEffect(() => {
    let timer: number | undefined;
    const start = () => {
      stop();
      timer = window.setInterval(() => router.refresh(), 5_000);
    };
    const stop = () => {
      if (timer != null) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        router.refresh(); // 복귀 즉시 1회
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router]);

  // RSC 가 새 messages 를 주면 동기화 — 낙관적 메시지(음수 id)는 보존
  useEffect(() => {
    setMessages((prev) => {
      const optimistic = prev.filter((m) => m.id < 0);
      const serverIds = new Set(initialMessages.map((m) => m.id));
      // 서버가 이미 받은 낙관적 메시지는 제거(중복 방지) — content + isMine 매칭
      const stillPending = optimistic.filter(
        (om) => !initialMessages.some((sm) => sm.isMine && sm.content === om.content),
      );
      // 음수 id 가 양수 id 와 충돌하지 않으므로 단순 concat
      return [...initialMessages, ...stillPending];
    });
  }, [initialMessages]);

  // 에러 5초 후 자동 dismiss
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(t);
  }, [error]);

  // 읽음 처리 — 미읽음 상대 메시지가 있을 때만 호출, 10초 throttle (#P3)
  const lastReadAtRef = useRef(0);
  useEffect(() => {
    const hasUnread = messages.some((m) => !m.isMine && !m.readAt && m.id > 0);
    if (!hasUnread) return;
    if (document.visibilityState !== "visible") return;
    const now = Date.now();
    if (now - lastReadAtRef.current < 10_000) return;
    lastReadAtRef.current = now;
    markMessagesRead(partnerId).catch(() => {
      /* silent — 다음 변경 시 재시도 */
    });
  }, [messages, partnerId]);

  const jumpToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setHasNewBelow(false);
    setStickToBottom(true);
  };

  const onSend = () => {
    if (sending) return; // 빠른 더블 Enter / 중복 클릭 차단 (#P2 보강)
    const text = draft.trim();
    if (!text) return;
    setError(null);
    // 낙관적 추가
    const tempId = -Date.now();
    const optimistic: Message = {
      id: tempId,
      isMine: true,
      content: text,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    // 전송 직후에도 입력 가능하도록 포커스 유지 (#P2)
    requestAnimationFrame(() => textareaRef.current?.focus());
    // 본인 메시지를 보냈으면 무조건 하단으로
    setStickToBottom(true);
    setHasNewBelow(false);
    setSending(async () => {
      const res = await sendMessage(partnerId, text);
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setDraft(text);
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSend();
    }
  };

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <>
      {/* 메시지 리스트 */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 py-3 relative"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl mb-2">💬</div>
              <p className="text-sm text-ink-2">{partnerName}님과 첫 대화를 시작해 보세요</p>
            </div>
          </div>
        ) : (
          <ul>
            {messages.map((m, idx) => {
              const prev = idx > 0 ? messages[idx - 1] : null;
              const next = idx + 1 < messages.length ? messages[idx + 1] : null;
              const showDivider =
                !prev || !isSameDay(new Date(prev.createdAt), new Date(m.createdAt));
              // 같은 사람 연속 메시지 그룹화 (#P5)
              const sameAsPrev =
                prev != null &&
                prev.isMine === m.isMine &&
                !showDivider &&
                new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
              const sameAsNext =
                next != null &&
                next.isMine === m.isMine &&
                isSameDay(new Date(m.createdAt), new Date(next.createdAt)) &&
                new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() < 5 * 60 * 1000;
              // 시간/미읽음 표식은 그룹의 마지막 메시지에만 노출
              const showMeta = !sameAsNext;
              // 거품 모서리: 그룹 중간/끝일 때 본인쪽 모서리를 더 강하게 둥글지 않게
              const bubbleRoundClass = m.isMine
                ? `rounded-2xl ${sameAsPrev ? "rounded-tr-md" : ""} ${sameAsNext ? "rounded-br-md" : "rounded-br-sm"}`
                : `rounded-2xl ${sameAsPrev ? "rounded-tl-md" : ""} ${sameAsNext ? "rounded-bl-md" : "rounded-bl-sm"}`;
              const itemSpacing = sameAsPrev ? "mt-0.5" : "mt-2.5";
              return (
                <li key={m.id} className={showDivider ? "" : itemSpacing}>
                  {showDivider && (
                    <div className="my-3 flex items-center gap-2">
                      <div className="flex-1 h-px bg-line/70" />
                      <span className="text-[10px] font-semibold text-ink-3 px-1.5">
                        {dayDividerLabel(m.createdAt)}
                      </span>
                      <div className="flex-1 h-px bg-line/70" />
                    </div>
                  )}
                  <div className={`flex items-end gap-1 ${m.isMine ? "justify-end" : "justify-start"}`}>
                    {m.isMine && showMeta && (
                      <div className="flex flex-col items-end mb-0.5 leading-tight">
                        {!m.readAt && (
                          <span className="text-[9px] font-bold text-primary tabular-nums">1</span>
                        )}
                        <span className="text-[9px] text-ink-3 tabular-nums">
                          {formatTimeKst(m.createdAt)}
                        </span>
                      </div>
                    )}
                    <div
                      className={`max-w-[78%] ${bubbleRoundClass} px-3 py-2 text-sm whitespace-pre-wrap break-words leading-relaxed ${
                        m.isMine
                          ? "bg-primary text-white"
                          : "bg-surface border border-line text-ink"
                      }`}
                    >
                      {m.content}
                    </div>
                    {!m.isMine && showMeta && (
                      <span className="text-[9px] text-ink-3 mb-1 tabular-nums">
                        {formatTimeKst(m.createdAt)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* 새 메시지 알림 chip — 사용자가 위로 스크롤 중이고 새 메시지 도착 시 */}
        {hasNewBelow && (
          <button
            type="button"
            onClick={jumpToBottom}
            className="sticky bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-primary text-white text-[11px] font-bold px-3 py-1.5 shadow-lg hover:opacity-95 transition active:scale-[0.97] z-10"
          >
            ↓ 새 메시지
          </button>
        )}
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-[11px] text-red-600">
          {error}
        </div>
      )}

      {/* 입력 영역 */}
      <div className="px-3 py-2 border-t border-line bg-surface flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={onInput}
          onKeyDown={onKeyDown}
          placeholder={sending ? "전송 중…" : "메시지 입력"}
          rows={1}
          disabled={sending}
          className="flex-1 min-h-[44px] max-h-[160px] rounded-2xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-3 outline-none focus:ring-2 focus:ring-primary/40 resize-none leading-relaxed disabled:opacity-60 disabled:cursor-wait"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!draft.trim() || sending}
          className="flex-none h-11 rounded-full bg-primary text-white text-xs font-bold px-4 hover:opacity-90 transition active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1"
        >
          {sending ? (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
            </svg>
          ) : (
            "전송"
          )}
        </button>
      </div>
    </>
  );
}
