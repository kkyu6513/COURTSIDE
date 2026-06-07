"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMessage } from "@/app/actions/messages";

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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 마운트 + 메시지 변경 시 하단 스크롤
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // 30초마다 RSC 새로고침으로 새 메시지 폴링 (간단 폴링 — 추후 realtime 으로 교체)
  useEffect(() => {
    const t = window.setInterval(() => router.refresh(), 30_000);
    return () => window.clearInterval(t);
  }, [router]);

  // RSC 가 새 messages 를 주면 동기화
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const onSend = () => {
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl mb-2">💬</div>
              <p className="text-sm text-ink-2">{partnerName}님과 첫 대화를 시작해 보세요</p>
            </div>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {messages.map((m, idx) => {
              const prev = idx > 0 ? messages[idx - 1] : null;
              const showDivider =
                !prev || !isSameDay(new Date(prev.createdAt), new Date(m.createdAt));
              const showTime =
                !prev ||
                prev.isMine !== m.isMine ||
                new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;
              return (
                <li key={m.id}>
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
                    {m.isMine && (
                      <span className="text-[9px] text-ink-3 mb-1 tabular-nums">
                        {!m.readAt && <span className="font-semibold text-primary mr-0.5">1</span>}
                        {showTime ? formatTimeKst(m.createdAt) : ""}
                      </span>
                    )}
                    <div
                      className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words leading-relaxed ${
                        m.isMine
                          ? "bg-primary text-white rounded-br-sm"
                          : "bg-surface border border-line text-ink rounded-bl-sm"
                      }`}
                    >
                      {m.content}
                    </div>
                    {!m.isMine && (
                      <span className="text-[9px] text-ink-3 mb-1 tabular-nums">
                        {showTime ? formatTimeKst(m.createdAt) : ""}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
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
          placeholder="메시지 입력"
          rows={1}
          className="flex-1 min-h-[44px] max-h-[160px] rounded-2xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-3 outline-none focus:ring-2 focus:ring-primary/40 resize-none leading-relaxed"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!draft.trim() || sending}
          className="flex-none h-11 rounded-full bg-primary text-white text-xs font-bold px-4 hover:opacity-90 transition active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          전송
        </button>
      </div>
    </>
  );
}
