"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleKakao = () => {
    setLoading(true);
    const clientId = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
    if (!clientId) {
      alert("카카오 클라이언트 ID가 설정되지 않았습니다.");
      setLoading(false);
      return;
    }
    const redirectUri = `${window.location.origin}/auth/callback`;
    const url = new URL("https://kauth.kakao.com/oauth/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "profile_nickname");
    window.location.href = url.toString();
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("이메일 형식이 올바르지 않습니다.");
      return;
    }
    setEmailLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/email-callback`,
          shouldCreateUser: true,
        },
      });
      if (error) {
        setEmailError(error.message || "로그인 링크 발송에 실패했어요.");
        return;
      }
      setEmailSentTo(trimmed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      setEmailError(msg);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleResetEmail = () => {
    setEmailSentTo(null);
    setEmailError(null);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-bg">
      <div className="w-full max-w-sm">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-ink">
            COURTSIDE
          </h1>
          <p className="mt-3 text-sm text-ink-2">테니스 코치 SaaS</p>
        </div>

        {emailSentTo ? (
          <div className="rounded-2xl border border-line bg-surface p-5 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div className="mt-3 text-sm font-bold text-ink">
              이메일을 확인해주세요
            </div>
            <p className="mt-1 text-xs text-ink-2 leading-relaxed">
              <span className="font-semibold text-ink">{emailSentTo}</span> 로<br />
              로그인 링크를 보냈어요.
            </p>
            <p className="mt-3 text-[11px] text-ink-3 leading-relaxed">
              메일이 안 보이면 스팸함도 확인해주세요.<br />
              링크는 1시간 동안 유효합니다.
            </p>
            <button
              type="button"
              onClick={handleResetEmail}
              className="mt-4 text-[11px] font-semibold text-ink-3 hover:text-ink-2 transition"
            >
              다른 이메일로 다시 시도
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleKakao}
                disabled={loading}
                className="w-full h-12 rounded-xl bg-[#FEE500] text-[#191919] font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? "이동 중…" : "카카오로 시작하기"}
              </button>

              <button
                type="button"
                disabled
                className="w-full h-12 rounded-xl bg-[#03C75A] text-white font-semibold text-sm flex items-center justify-center opacity-50 cursor-not-allowed"
              >
                네이버로 시작하기 (준비 중)
              </button>
            </div>

            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-line" />
              <span className="text-[11px] text-ink-3">또는</span>
              <div className="flex-1 h-px bg-line" />
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소"
                disabled={emailLoading}
                autoComplete="email"
                inputMode="email"
                required
                className="w-full h-12 rounded-xl border border-line bg-surface px-4 text-sm text-ink placeholder:text-ink-3 outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              />
              {emailError && (
                <p className="text-[11px] text-red-500 px-1">{emailError}</p>
              )}
              <button
                type="submit"
                disabled={emailLoading || !email.trim()}
                className="w-full h-12 rounded-xl bg-ink text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {emailLoading && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                )}
                {emailLoading ? "발송 중…" : "이메일로 로그인 링크 받기"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-ink-3 leading-relaxed">
              가입 시 이용약관 및 개인정보 처리방침에 동의합니다
            </p>
          </>
        )}

        {/* 테스트용 — 가입자 목록 / 역할 선택 화면 진입 */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/dev/users"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-3 px-3 py-1.5 rounded-full border border-dashed border-line hover:bg-soft transition"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            테스트용: 가입자 목록 보기
          </Link>
          <Link
            href="/onboarding/role?force=1"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-3 px-3 py-1.5 rounded-full border border-dashed border-line hover:bg-soft transition"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            테스트용: 역할 선택 화면
          </Link>
        </div>
      </div>
    </main>
  );
}
