import { prisma } from "@/lib/prisma";

/**
 * FR-16c 그랜드슬램 활성 판정 + 한국시간 변환
 */

export type GrandSlamState =
  | {
      mode: "ACTIVE";
      tournament: {
        id: number;
        name: string;
        nameKo: string;
        city: string;
        startDate: Date;
        endDate: Date;
        broadcastChannels: string[];
        utcOffsetMinutes: number;
      };
      dayOfTournament: number; // 1-based
      totalDays: number;
    }
  | {
      mode: "UPCOMING";
      tournament: {
        id: number;
        name: string;
        nameKo: string;
        city: string;
        startDate: Date;
        endDate: Date;
        broadcastChannels: string[];
        utcOffsetMinutes: number;
      };
      daysUntil: number;
    }
  | { mode: "NONE" };

export async function getGrandSlamState(today = new Date()): Promise<GrandSlamState> {
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const active = await prisma.tournament.findFirst({
    where: {
      type: "GRAND_SLAM",
      isActive: true,
      startDate: { lte: todayDate },
      endDate: { gte: todayDate },
    },
    orderBy: { startDate: "asc" },
  });

  if (active) {
    const totalDays =
      Math.floor(
        (active.endDate.getTime() - active.startDate.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;
    const dayOfTournament =
      Math.floor(
        (todayDate.getTime() - active.startDate.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;
    return {
      mode: "ACTIVE",
      tournament: {
        id: active.id,
        name: active.name,
        nameKo: active.nameKo ?? active.name,
        city: active.city,
        startDate: active.startDate,
        endDate: active.endDate,
        broadcastChannels: active.broadcastChannels ?? [],
        utcOffsetMinutes: active.utcOffsetMinutes,
      },
      dayOfTournament,
      totalDays,
    };
  }

  const upcoming = await prisma.tournament.findFirst({
    where: {
      type: "GRAND_SLAM",
      isActive: true,
      startDate: { gt: todayDate },
    },
    orderBy: { startDate: "asc" },
  });

  if (upcoming) {
    const daysUntil = Math.ceil(
      (upcoming.startDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      mode: "UPCOMING",
      tournament: {
        id: upcoming.id,
        name: upcoming.name,
        nameKo: upcoming.nameKo ?? upcoming.name,
        city: upcoming.city,
        startDate: upcoming.startDate,
        endDate: upcoming.endDate,
        broadcastChannels: upcoming.broadcastChannels ?? [],
        utcOffsetMinutes: upcoming.utcOffsetMinutes,
      },
      daysUntil,
    };
  }

  return { mode: "NONE" };
}

/** 2026 연간 캘린더 (어드민 입력 데이터 풀 조회) */
export async function getAnnualCalendar(year = 2026) {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const list = await prisma.tournament.findMany({
    where: {
      type: "GRAND_SLAM",
      startDate: { gte: start, lt: end },
    },
    orderBy: { startDate: "asc" },
  });
  const now = new Date();
  return list.map((t) => {
    let status: "PAST" | "NOW" | "FUTURE";
    if (t.endDate < now) status = "PAST";
    else if (t.startDate <= now && t.endDate >= now) status = "NOW";
    else status = "FUTURE";
    return {
      id: t.id,
      name: t.nameKo ?? t.name,
      city: t.city,
      startDate: t.startDate,
      endDate: t.endDate,
      status,
      daysUntil:
        status === "FUTURE"
          ? Math.ceil(
              (t.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            )
          : 0,
    };
  });
}

/** 한국시간 변환 (UTC + offset → KST) */
export function utcToKst(utcDate: Date, _offsetMinutes: number): Date {
  // KST = UTC + 540분 (한국). 대회 utcOffsetMinutes는 표시용 부가 정보일 뿐,
  // DB의 scheduledAt이 UTC라면 단순히 KST로 변환하면 됨.
  return new Date(utcDate.getTime() + 540 * 60 * 1000);
}
