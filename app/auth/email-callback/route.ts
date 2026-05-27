import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase 이메일 매직 링크 콜백.
 *
 * 흐름:
 * 1. 사용자가 이메일 받은 매직 링크 클릭
 * 2. Supabase가 PKCE code 파라미터와 함께 이 라우트로 redirect
 * 3. exchangeCodeForSession 으로 code → 세션 쿠키 자동 설정
 * 4. 홈으로 redirect (역할 분기는 / 에서 처리)
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=email_link&detail=${encodeURIComponent(
        errorDescription || error,
      )}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=email_no_code`);
  }

  try {
    const supabase = createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("[email-callback] exchangeCodeForSession error:", exchangeError);
      return NextResponse.redirect(
        `${origin}/login?error=email_verify&msg=${encodeURIComponent(exchangeError.message)}`,
      );
    }

    return NextResponse.redirect(`${origin}/`);
  } catch (e) {
    console.error("[email-callback] exception:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      `${origin}/login?error=email_exception&msg=${encodeURIComponent(msg)}`,
    );
  }
}
