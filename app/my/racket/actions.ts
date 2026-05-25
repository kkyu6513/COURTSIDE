"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/** FR-16b 라켓 등록 / 변경 */
export async function registerRacket(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const racketIdRaw = formData.get("racketId");
  const tensionRaw = formData.get("stringTension");
  const lastChangeRaw = formData.get("lastStringChangeDate");
  const stringType = (formData.get("stringType") ?? "")?.toString().trim() || null;

  const racketId = Number(racketIdRaw);
  if (!Number.isFinite(racketId)) throw new Error("INVALID_RACKET");

  const racket = await prisma.racket.findUnique({ where: { id: racketId } });
  if (!racket || !racket.isActive) throw new Error("RACKET_NOT_FOUND");

  const stringTension =
    tensionRaw && String(tensionRaw).trim() !== "" ? Number(tensionRaw) : null;
  if (stringTension !== null && (stringTension < 30 || stringTension > 70)) {
    throw new Error("INVALID_TENSION");
  }

  const lastStringChangeDate =
    lastChangeRaw && String(lastChangeRaw).trim() !== ""
      ? new Date(String(lastChangeRaw))
      : null;

  await prisma.$transaction(async (tx) => {
    // 기존 활성 라켓 비활성화 (변경 케이스)
    await tx.userRacket.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false },
    });

    await tx.userRacket.create({
      data: {
        userId: user.id,
        racketId,
        stringType,
        stringTension,
        lastStringChangeDate,
        isActive: true,
      },
    });
  });

  revalidatePath("/my/racket");
  redirect("/my/racket");
}

/** FR-16b 스트링 교체 기록 */
export async function logStringChange(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userRacket = await prisma.userRacket.findFirst({
    where: { userId: user.id, isActive: true },
  });
  if (!userRacket) throw new Error("NO_ACTIVE_RACKET");

  const changeDateRaw = formData.get("changeDate");
  const tensionRaw = formData.get("tension");
  const stringType = (formData.get("stringType") ?? "")?.toString().trim() || null;
  const memo = (formData.get("memo") ?? "")?.toString().trim() || null;

  const changeDate = changeDateRaw ? new Date(String(changeDateRaw)) : new Date();
  const tension =
    tensionRaw && String(tensionRaw).trim() !== "" ? Number(tensionRaw) : null;
  if (tension !== null && (tension < 30 || tension > 70)) {
    throw new Error("INVALID_TENSION");
  }

  await prisma.$transaction([
    prisma.stringChangeLog.create({
      data: {
        userRacketId: userRacket.id,
        changeDate,
        tension,
        stringType,
        memo,
      },
    }),
    prisma.userRacket.update({
      where: { id: userRacket.id },
      data: {
        lastStringChangeDate: changeDate,
        stringTension: tension ?? userRacket.stringTension,
        stringType: stringType ?? userRacket.stringType,
      },
    }),
  ]);

  revalidatePath("/my/racket");
}
