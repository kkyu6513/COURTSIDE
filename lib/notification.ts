/**
 * Solapi 기반 알림 발송 모듈.
 *
 * - 환경변수 (SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_FROM) 가 있으면 실제 SMS 발송
 * - 없으면 console.log 만 찍고 skip 반환 (DB 큐에는 항상 저장됨)
 */

import crypto from "crypto";

type SendResult =
  | { ok: true; messageId?: string; skipped?: false }
  | { ok: false; error: string; skipped?: false }
  | { ok: false; skipped: true; reason: string };

export async function sendSms(to: string, text: string): Promise<SendResult> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const from = process.env.SOLAPI_FROM;

  if (!apiKey || !apiSecret || !from) {
    console.log("[sendSms] Solapi env 미설정 — 발송 skip:", { to, text });
    return { ok: false, skipped: true, reason: "ENV_NOT_SET" };
  }

  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString("hex");
  const signature = crypto.createHmac("sha256", apiSecret).update(date + salt).digest("hex");

  const authorization = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

  try {
    const res = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { to, from, text, type: "SMS" } }),
    });

    const data = (await res.json()) as { messageId?: string; errorMessage?: string };

    if (!res.ok || data.errorMessage) {
      return { ok: false, error: data.errorMessage || `HTTP ${res.status}` };
    }

    return { ok: true, messageId: data.messageId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function buildStudentClaimMessage(studentName: string): string {
  return [
    `[COURTSIDE]`,
    ``,
    `${studentName}님이 회원님을 본인의 코치로 지정해 가입을 완료했어요.`,
    ``,
    `▶ 마이페이지 → 학생 관리 → 대기 신청 확인`,
    `학생을 본인 명단에 등록하면 자동으로 연결됩니다.`,
  ].join("\n");
}

export function buildPhoneVerifyMessage(code: string): string {
  return `[COURTSIDE] 본인확인 인증번호 ${code} (3분 내 입력)`;
}

export function generatePhoneCode(): string {
  return String(Math.floor(Math.random() * 900000) + 100000);
}
