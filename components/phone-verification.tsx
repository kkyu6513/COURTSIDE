"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onVerifiedChange: (verifiedPhone: string | null) => void;
  onError?: (message: string) => void;
};

type Step = "idle" | "code-sent" | "verified";

export function PhoneVerification({ onVerifiedChange, onError }: Props) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [hintMsg, setHintMsg] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (step !== "code-sent" || secondsLeft <= 0) return;
    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [step, secondsLeft]);

  const normalizedPhone = phone.replace(/[^\d]/g, "");
  const validPhone = normalizedPhone.length >= 10 && normalizedPhone.length <= 11;
  const validCode = code.length === 6;

  const reportError = (msg: string) => {
    setHintMsg(msg);
    onError?.(msg);
  };

  const sendCode = async () => {
    if (!validPhone || sending) return;
    setSending(true);
    setHintMsg(null);
    setDevCode(null);
    try {
      const res = await fetch("/api/auth/send-phone-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        reportError(data.error || "발송 실패");
        return;
      }
      setStep("code-sent");
      setSecondsLeft(data.ttlSeconds || 180);
      setCode("");
      if (data.devMode && data.devCode) {
        setDevCode(data.devCode);
        setHintMsg("SMS 발송 환경이 설정되지 않아 화면에 코드를 표시합니다 (개발용).");
      } else {
        setHintMsg("입력하신 번호로 인증번호를 보냈어요.");
      }
    } catch (e) {
      reportError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    if (!validCode || verifying) return;
    setVerifying(true);
    setHintMsg(null);
    try {
      const res = await fetch("/api/auth/verify-phone-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        reportError(data.error || "인증 실패");
        return;
      }
      setStep("verified");
      setSecondsLeft(0);
      setHintMsg(null);
      onVerifiedChange(normalizedPhone);
    } catch (e) {
      reportError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setVerifying(false);
    }
  };

  const onPhoneChange = (v: string) => {
    setPhone(v);
    if (step !== "idle") {
      setStep("idle");
      setCode("");
      setSecondsLeft(0);
      setHintMsg(null);
      setDevCode(null);
      onVerifiedChange(null);
    }
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div>
      <div className="flex items-center gap-1 mb-2">
        <span className="text-sm font-semibold text-ink">전화번호</span>
        <span className="text-red-500">*</span>
        {step === "verified" && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4l2.3 2.3 6.3-6.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
            </svg>
            인증 완료
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="tel"
          inputMode="numeric"
          placeholder="01012345678 (- 없이)"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          pattern="[0-9]{10,11}"
          maxLength={11}
          disabled={step === "verified"}
          className="flex-1 h-12 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 disabled:bg-soft disabled:text-ink-3"
        />
        <button
          type="button"
          onClick={sendCode}
          disabled={!validPhone || sending || step === "verified"}
          className="flex-none px-4 h-12 rounded-lg bg-ink text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition active:scale-[0.98]"
        >
          {sending ? "발송 중…" : step === "verified" ? "완료" : step === "code-sent" ? "재발송" : "인증"}
        </button>
      </div>

      {step === "code-sent" && (
        <div className="mt-2.5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                inputMode="numeric"
                placeholder="6자리 인증번호"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                maxLength={6}
                className="w-full h-12 rounded-lg border border-emerald-300 bg-emerald-50/40 px-3 pr-16 text-sm tracking-[0.4em] font-semibold text-ink placeholder:text-ink-3 placeholder:tracking-normal placeholder:font-normal"
              />
              {secondsLeft > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-emerald-600 tabular-nums">
                  {mm}:{ss}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={verifyCode}
              disabled={!validCode || verifying || secondsLeft <= 0}
              className="flex-none px-4 h-12 rounded-lg bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition active:scale-[0.98]"
            >
              {verifying ? "확인 중…" : "확인"}
            </button>
          </div>
          {secondsLeft <= 0 && (
            <p className="mt-1.5 text-xs text-red-500">인증번호가 만료되었어요. 재발송을 눌러주세요.</p>
          )}
        </div>
      )}

      {hintMsg && step !== "verified" && (
        <p className="mt-1.5 text-xs text-ink-3">{hintMsg}</p>
      )}

      {devCode && step === "code-sent" && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">DEV CODE:</span> <span className="font-mono text-base tracking-widest">{devCode}</span>
        </div>
      )}

      {step === "idle" && (
        <p className="mt-1.5 text-xs text-ink-3">코치가 카카오톡 또는 SMS로 초대할 때 사용됩니다. 인증을 통해 본인 확인을 진행해 주세요.</p>
      )}
    </div>
  );
}
