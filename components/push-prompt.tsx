"use client";

import { useEffect, useState } from "react";
import { registerPushSubscription } from "@/app/actions/push";

type Permission = "default" | "granted" | "denied" | "unsupported";

const DISMISSED_KEY = "courtside:push:dismissed";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * 학생 홈에 노출되는 푸시 알림 권한 요청 배너.
 * - 권한 상태에 따라 배너 노출/숨김
 * - 권한 granted 시 PushManager.subscribe 호출 + 서버 등록
 * - 사용자가 "나중에" 누르면 1주일 비노출 (sessionStorage 대신 localStorage)
 */
export function PushPrompt() {
  const [permission, setPermission] = useState<Permission>("default");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPermission("unsupported");
        return;
      }
      setPermission(Notification.permission as Permission);
      try {
        const dismissedAt = window.localStorage.getItem(DISMISSED_KEY);
        if (dismissedAt) {
          const t = parseInt(dismissedAt, 10);
          if (!Number.isNaN(t) && Date.now() - t < 7 * 24 * 60 * 60 * 1000) {
            setDismissed(true);
          }
        }
      } catch {
        /* localStorage 비활성 */
      }
      // Service Worker 등록 (조용히) — 실패해도 배너는 보임
      navigator.serviceWorker.register("/sw.js").catch((e) => {
        console.warn("[push] SW register failed:", e);
      });
      // 자동 ensureSubscribed 제거 — 사용자가 명시적으로 버튼 누를 때만 호출
      // (VAPID 미설정 / SW 미준비 환경에서 자동 구독 시도 시 에러 발생 방지)
    } catch (e) {
      console.warn("[push] init error:", e);
      setPermission("unsupported");
    }
  }, []);

  const ensureSubscribed = async (): Promise<boolean> => {
    try {
      const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublic) {
        console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY 미설정 — 구독 skip");
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublic).buffer as ArrayBuffer,
        });
      }
      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
      const res = await registerPushSubscription({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      });
      return res.ok;
    } catch (e) {
      console.warn("[push] ensureSubscribed failed:", e);
      return false;
    }
  };

  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as Permission);
      if (perm === "granted") {
        const ok = await ensureSubscribed();
        if (!ok) {
          // 구독 실패해도 권한은 받았으니 배너만 닫음
        }
      }
    } catch (e) {
      console.warn("[push] requestPermission failed:", e);
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      /* localStorage 비활성 */
    }
    setDismissed(true);
  };

  // 노출 조건: 지원 + default 권한 + dismissed 아님
  if (permission !== "default") return null;
  if (dismissed) return null;

  return (
    <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-none w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-ink">알림 받기</div>
          <p className="mt-1 text-xs text-ink-2 leading-relaxed">
            코치 메시지가 오면 앱을 안 켜도 알려드려요.
            카톡처럼 즉시 도착해요.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleEnable}
              disabled={busy}
              className="inline-flex h-9 items-center rounded-lg bg-primary text-white text-xs font-bold px-3.5 disabled:opacity-60 hover:opacity-90 transition active:scale-[0.98]"
            >
              {busy ? "설정 중…" : "알림 허용하기"}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex h-9 items-center rounded-lg text-xs font-semibold text-ink-3 px-2 hover:bg-soft transition"
            >
              나중에
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
