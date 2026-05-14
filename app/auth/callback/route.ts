import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 자체 카카오 OAuth 콜백 처리
 *
 * 흐름:
 * 1. 카카오에서 code 받음
 * 2. code → access_token (카카오 token 엔드포인트)
 * 3. access_token → 사용자 정보 (카카오 user/me)
 * 4. Supabase admin으로 user 생성 (가짜 이메일: kakao_{id}@courtside.local)
 * 5. magic link로 token_hash 받음
 * 6. 우리 server에서 verifyOtp 호출 → 세션 cookie 설정
 * 7. 홈으로 redirect
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const kakaoError = searchParams.get("error");

  if (kakaoError) {
    return NextResponse.redirect(
      `${origin}/login?error=kakao&detail=${encodeURIComponent(kakaoError)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  try {
    // 1. 카카오 토큰 받기
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY!,
        redirect_uri: `${origin}/auth/callback`,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("[callback] kakao token error:", errBody);
      return NextResponse.redirect(
        `${origin}/login?error=kakao_token&detail=${encodeURIComponent(errBody.slice(0, 300))}`
      );
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };

    if (!tokenData.access_token) {
      return NextResponse.redirect(`${origin}/login?error=no_access_token`);
    }

    // 2. 카카오 사용자 정보
    const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${origin}/login?error=kakao_user`);
    }

    const kakaoUser = (await userRes.json()) as {
      id: number;
      kakao_account?: { profile?: { nickname?: string } };
    };

    const kakaoId = kakaoUser.id;
    const nickname =
      kakaoUser.kakao_account?.profile?.nickname || `user_${kakaoId}`;
    const fakeEmail = `kakao_${kakaoId}@courtside.local`;

    // 3. Supabase user 생성 (이미 있으면 무시)
    const admin = createAdminClient();
    const { error: createError } = await admin.auth.admin.createUser({
      email: fakeEmail,
      email_confirm: true,
      user_metadata: {
        provider: "kakao",
        kakao_id: kakaoId,
        nickname,
      },
    });

    if (createError && !/already|exists|registered/i.test(createError.message)) {
      console.error("[callback] createUser error:", createError);
      return NextResponse.redirect(
        `${origin}/login?error=create_user&msg=${encodeURIComponent(createError.message)}`
      );
    }

    // 4. Magic link 생성 (token_hash 추출용)
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: fakeEmail,
      });

    const hashedToken = linkData?.properties?.hashed_token;
    if (linkError || !hashedToken) {
      console.error("[callback] magicLink error:", linkError);
      return NextResponse.redirect(
        `${origin}/login?error=magic_link&msg=${encodeURIComponent(linkError?.message || "no_hash")}`
      );
    }

    // 5. 우리 server에서 verifyOtp 호출 → 세션 cookie 자동 설정
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: hashedToken,
      type: "email",
    });

    if (verifyError) {
      console.error("[callback] verifyOtp error:", verifyError);
      return NextResponse.redirect(
        `${origin}/login?error=verify&msg=${encodeURIComponent(verifyError.message)}`
      );
    }

    // 6. 홈으로 redirect (세션 cookie는 응답에 자동 포함)
    return NextResponse.redirect(`${origin}/`);
  } catch (e) {
    console.error("[callback] exception:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      `${origin}/login?error=exception&msg=${encodeURIComponent(msg)}`
    );
  }
}
