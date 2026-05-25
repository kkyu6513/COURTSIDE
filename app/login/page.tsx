"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

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

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-bg">
      <div className="w-full max-w-sm">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-ink">
            COURTSIDE
          </h1>
          <p className="mt-3 text-sm text-ink-2">테니스 코치 SaaS</p>
        </div>

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

        <p className="mt-8 text-center text-xs text-ink-3 leading-relaxed">
          가입 시 이용약관 및 개인정보 처리방침에 동의합니다
        </p>

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
