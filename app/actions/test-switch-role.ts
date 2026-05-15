"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 임시 테스트용 — 현재 로그인 사용자의 role을 STUDENT/COACH로 강제 전환하고,
 * 해당 프로필이 없으면 기본값으로 자동 생성. 가입 폼을 거치지 않고 바로 홈 진입.
 *
 * 추후 정식 가입 흐름 안정화 후 제거 예정.
 */
export async function testSwitchRole(formData: FormData) {
  const role = formData.get("role")?.toString();
  if (role !== "STUDENT" && role !== "COACH") {
    throw new Error("Invalid role");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // 1. app_metadata: role + (코치는 plan=FREE)
  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata || {}),
      role,
      ...(role === "COACH" ? { plan: "FREE" } : {}),
    },
  });

  // 2. public.users role 동기화 (prisma raw — FK 회피)
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (url) {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      await prisma.$executeRaw`
        INSERT INTO users (id, email, name, role, "isActive", "createdAt", "updatedAt")
        VALUES (
          ${user.id}::uuid,
          ${user.email!},
          ${(user.user_metadata?.nickname as string | undefined) || "테스트"},
          ${role},
          true,
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          role = EXCLUDED.role,
          "updatedAt" = NOW()
      `;
    } finally {
      await prisma.$disconnect();
    }
  }

  // 3. 프로필 자동 생성 (없으면)
  if (role === "COACH") {
    const { data: existing } = await admin
      .from("coach_profiles")
      .select("id")
      .eq("userId", user.id)
      .maybeSingle();
    if (!existing) {
      await admin.from("coach_profiles").insert({
        userId: user.id,
        gender: "MALE",
        bio: "테스트 모드 자동 생성된 코치 프로필",
        areaSido: "서울특별시",
        areaSigungu: "강남구",
        priceVisibility: "PRIVATE",
        updatedAt: new Date().toISOString(),
      });
    }
  } else {
    const { data: existing } = await admin
      .from("student_profiles")
      .select("id")
      .eq("userId", user.id)
      .maybeSingle();
    if (!existing) {
      await admin.from("student_profiles").insert({
        userId: user.id,
        gender: "MALE",
        ageGroup: "TWENTIES",
        ntrpLevel: "",
        preferredAreaSido: "",
        preferredAreaSigungu: "",
        preferredTimeSlots: [],
        updatedAt: new Date().toISOString(),
      });
    }
  }

  revalidatePath("/");
  redirect("/");
}
