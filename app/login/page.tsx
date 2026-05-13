"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleKakao = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        alert(`[1] Supabase 에러: ${error.message}`);
        setLoading(false);
        return;
      }

      if (data?.url) {
        // 명시적으로 카카오 OAuth URL로 이동
        window.location.href = data.url;
      } else {
        alert("[2] Supabase가 URL을 반환하지 않음");
        setLoading(false);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`[3] 예외 발생: ${msg}`);
      setLoading(false);
    }
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
            {loading ? "로그인 중…" : "카카오로 시작하기"}
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
