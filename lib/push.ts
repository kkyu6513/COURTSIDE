/**
 * Web Push 발송 모듈.
 *
 * 환경 변수:
 * - VAPID_PUBLIC_KEY  (NEXT_PUBLIC_VAPID_PUBLIC_KEY 도 클라이언트 노출용 동일 값)
 * - VAPID_PRIVATE_KEY (서버 전용)
 * - VAPID_SUBJECT     (예: "mailto:admin@courtside.app")
 *
 * 환경 변수 미설정 시 console.log 만 찍고 skipped 반환.
 */

import webpush from "web-push";

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@courtside.local";
  if (!pub || !priv) return;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string; // 클릭 시 열 URL
  tag?: string; // 같은 tag는 1개로 합쳐짐
};

type SendResult =
  | { ok: true }
  | { ok: false; gone: true; reason: string } // 410/404 — 구독 만료
  | { ok: false; error: string };

/**
 * 단일 구독에 푸시 발송.
 * 410/404 응답이면 구독이 만료된 것 → 호출자가 DB에서 삭제해야 함.
 */
export async function sendPush(
  sub: PushSubscriptionRecord,
  payload: PushPayload,
): Promise<SendResult> {
  configure();
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.log("[sendPush] VAPID env 미설정 — 발송 skip:", payload.title);
    return { ok: false, error: "VAPID_NOT_CONFIGURED" };
  }
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (e) {
    const err = e as { statusCode?: number; body?: string; message?: string };
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      return { ok: false, gone: true, reason: err.body || err.message || "expired" };
    }
    return { ok: false, error: err?.message || String(e) };
  }
}
