"use client";

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
      </div>
    </main>
  );
}
