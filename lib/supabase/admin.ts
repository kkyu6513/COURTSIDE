import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin Client (Service Role)
 *
 * - 서버 전용. 클라이언트에서 절대 사용 금지.
 * - Row Level Security 우회 가능.
 * - user 생성, magic link 발급 등 관리자 작업용.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
