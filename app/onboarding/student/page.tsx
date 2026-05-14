import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingHeader } from "@/components/onboarding-form";
import { StudentForm } from "./student-form";
import type { TermsItem } from "./terms-agreement";

export const dynamic = "force-dynamic";

export default async function StudentOnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = (user.app_metadata as { role?: string } | undefined)?.role;
  if (!role) redirect("/onboarding/role");
  if (role === "COACH") redirect("/onboarding/coach");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("student_profiles")
    .select("id")
    .eq("userId", user.id)
    .maybeSingle();

  if (existing) redirect("/");

  // 활성 약관 버전 로드 (최신 버전 1개씩)
  const { data: rows } = await admin
    .from("terms_versions")
    .select("id, version, content, terms!inner(id, code, title, isRequired, sortOrder)")
    .eq("isActive", true);

  type Row = {
    id: number;
    version: string;
    content: string;
    terms: { id: number; code: string; title: string; isRequired: boolean; sortOrder: number };
  };
  const terms: TermsItem[] = ((rows ?? []) as unknown as Row[])
    .map((r) => ({
      versionId: r.id,
      code: r.terms.code,
      title: r.terms.title,
      isRequired: r.terms.isRequired,
      sortOrder: r.terms.sortOrder,
      version: r.version,
      content: r.content,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <main className="min-h-screen bg-bg pb-12">
      <div className="max-w-md mx-auto px-6 pt-4">
        <OnboardingHeader backHref="/onboarding/role" step={2} total={2} />

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-ink">기본 정보 입력</h1>
          <p className="mt-1.5 text-sm text-ink-2">코치에게 초대받기 위한 기본 정보를 입력해주세요</p>
        </div>

        <StudentForm terms={terms} />
      </div>
    </main>
  );
}
