/**
 * FR-16 학생 리텐션 콘텐츠 마이그레이션 — 일회성
 *
 * 사용:
 *   curl -X POST 'https://your-app/api/admin/migrate-fr-16?token=...'
 *
 * 결과: 9개 테이블 + 6개 enum + User.dailyPushTime 컬럼 + 시드 (라켓 16/선수 12/대회 4)
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, RacketBrand, ProTour, TournamentType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ONE_TIME_TOKEN = "courtside-fr16-2026-05-25-Kx7vMpQzRn9wYt";

const DDL_STATEMENTS: string[] = [
  // 0. User에 dailyPushTime 컬럼 추가
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS "dailyPushTime" TEXT DEFAULT '08:00'`,

  // 1. Enum 6종 (DO 블록 — 중복 시 무시)
  `DO $$ BEGIN
    CREATE TYPE "DailyContentType" AS ENUM ('WEATHER', 'KR_MATCH', 'HIGHLIGHT', 'LOCAL_TOURNAMENT');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    CREATE TYPE "RacketBrand" AS ENUM ('WILSON', 'BABOLAT', 'HEAD', 'YONEX', 'PRINCE', 'DUNLOP', 'TECNIFIBRE', 'PROKENNEX');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    CREATE TYPE "TournamentType" AS ENUM ('GRAND_SLAM', 'ATP', 'WTA', 'LOCAL');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    CREATE TYPE "ProTour" AS ENUM ('ATP', 'WTA');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    CREATE TYPE "RacketNewsType" AS ENUM ('NEW_MODEL', 'SALE', 'STRING_TIP', 'REVIEW');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  // 2. DailyContent
  `CREATE TABLE IF NOT EXISTS daily_contents (
    id SERIAL PRIMARY KEY,
    "contentDate" DATE NOT NULL,
    type "DailyContentType" NOT NULL,
    region TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    body TEXT,
    "externalUrl" TEXT,
    meta JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_daily_contents_date_type_region ON daily_contents("contentDate", type, region)`,

  // 3. Racket
  `CREATE TABLE IF NOT EXISTS rackets (
    id SERIAL PRIMARY KEY,
    brand "RacketBrand" NOT NULL,
    model TEXT NOT NULL,
    "headSize" INTEGER,
    weight INTEGER,
    "imageUrl" TEXT,
    "releaseYear" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (brand, model)
  )`,

  // 4. UserRacket
  `CREATE TABLE IF NOT EXISTS user_rackets (
    id SERIAL PRIMARY KEY,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "racketId" INTEGER NOT NULL REFERENCES rackets(id),
    "stringType" TEXT,
    "stringTension" INTEGER,
    "lastStringChangeDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_user_rackets_user_active ON user_rackets("userId", "isActive")`,

  // 5. StringChangeLog
  `CREATE TABLE IF NOT EXISTS string_change_logs (
    id SERIAL PRIMARY KEY,
    "userRacketId" INTEGER NOT NULL REFERENCES user_rackets(id) ON DELETE CASCADE,
    "changeDate" DATE NOT NULL,
    tension INTEGER,
    "stringType" TEXT,
    memo TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_string_logs_racket_date ON string_change_logs("userRacketId", "changeDate")`,

  // 6. ProPlayer
  `CREATE TABLE IF NOT EXISTS pro_players (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    "nameKo" TEXT,
    country TEXT NOT NULL,
    tour "ProTour" NOT NULL,
    "racketId" INTEGER REFERENCES rackets(id),
    "atpRank" INTEGER,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // 7. FavoritePlayer
  `CREATE TABLE IF NOT EXISTS favorite_players (
    id SERIAL PRIMARY KEY,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "proPlayerId" INTEGER NOT NULL REFERENCES pro_players(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("userId", "proPlayerId")
  )`,

  // 8. Tournament
  `CREATE TABLE IF NOT EXISTS tournaments (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    "nameKo" TEXT,
    type "TournamentType" NOT NULL,
    city TEXT NOT NULL,
    "utcOffsetMinutes" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    region TEXT,
    "minNtrp" DECIMAL(2,1),
    "maxNtrp" DECIMAL(2,1),
    "broadcastChannels" TEXT[],
    "externalUrl" TEXT,
    "registrationDeadline" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tournaments_type_start ON tournaments(type, "startDate")`,

  // 9. ProMatch
  `CREATE TABLE IF NOT EXISTS pro_matches (
    id SERIAL PRIMARY KEY,
    "tournamentId" INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round TEXT NOT NULL,
    "player1Id" INTEGER NOT NULL REFERENCES pro_players(id),
    "player2Id" INTEGER NOT NULL REFERENCES pro_players(id),
    "scheduledAt" TIMESTAMPTZ NOT NULL,
    status "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "winnerId" INTEGER,
    score TEXT,
    "highlightUrl" TEXT,
    "aiSummary" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pro_matches_sched_status ON pro_matches("scheduledAt", status)`,
  `CREATE INDEX IF NOT EXISTS idx_pro_matches_tour_round ON pro_matches("tournamentId", round)`,

  // 10. RacketNews
  `CREATE TABLE IF NOT EXISTS racket_news (
    id SERIAL PRIMARY KEY,
    type "RacketNewsType" NOT NULL,
    "targetBrand" "RacketBrand",
    "targetRacketId" INTEGER REFERENCES rackets(id),
    title TEXT NOT NULL,
    body TEXT,
    "imageUrl" TEXT,
    "externalUrl" TEXT,
    "publishedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "isActive" BOOLEAN NOT NULL DEFAULT true
  )`,
  `CREATE INDEX IF NOT EXISTS idx_racket_news_type_pub ON racket_news(type, "publishedAt")`,
];

const RACKET_SEED: Array<{
  brand: RacketBrand;
  model: string;
  headSize: number;
  weight: number;
  releaseYear: number;
}> = [
  { brand: "WILSON",    model: "Blade 98 v8",          headSize: 98,  weight: 305, releaseYear: 2025 },
  { brand: "WILSON",    model: "Pro Staff RF97 v14",   headSize: 97,  weight: 340, releaseYear: 2024 },
  { brand: "WILSON",    model: "Clash 100 Pro",        headSize: 100, weight: 310, releaseYear: 2024 },
  { brand: "WILSON",    model: "Ultra 100 v4",         headSize: 100, weight: 300, releaseYear: 2024 },
  { brand: "BABOLAT",   model: "Pure Aero 2023",       headSize: 100, weight: 300, releaseYear: 2023 },
  { brand: "BABOLAT",   model: "Pure Drive 2024",      headSize: 100, weight: 300, releaseYear: 2024 },
  { brand: "BABOLAT",   model: "Pure Strike 98 16x19", headSize: 98,  weight: 305, releaseYear: 2024 },
  { brand: "HEAD",      model: "Speed Pro 2025",       headSize: 100, weight: 310, releaseYear: 2025 },
  { brand: "HEAD",      model: "Radical Pro 2023",     headSize: 98,  weight: 315, releaseYear: 2023 },
  { brand: "HEAD",      model: "Prestige MP 2024",     headSize: 98,  weight: 320, releaseYear: 2024 },
  { brand: "YONEX",     model: "Percept 97D",          headSize: 97,  weight: 320, releaseYear: 2024 },
  { brand: "YONEX",     model: "EZONE 98 v8",          headSize: 98,  weight: 305, releaseYear: 2024 },
  { brand: "YONEX",     model: "VCORE 98 2023",        headSize: 98,  weight: 305, releaseYear: 2023 },
  { brand: "PRINCE",    model: "Phantom 100X 305g",    headSize: 100, weight: 305, releaseYear: 2024 },
  { brand: "DUNLOP",    model: "FX 500 2024",          headSize: 100, weight: 300, releaseYear: 2024 },
  { brand: "TECNIFIBRE", model: "Tfight 305 ISO",      headSize: 98,  weight: 305, releaseYear: 2024 },
];

const PLAYER_SEED: Array<{
  name: string;
  nameKo: string;
  country: string;
  tour: ProTour;
  racketBrand: RacketBrand;
  racketModel: string;
  atpRank: number | null;
}> = [
  { name: "Jannik Sinner",    nameKo: "야닉 시너",        country: "IT", tour: "ATP", racketBrand: "HEAD",       racketModel: "Speed Pro 2025",     atpRank: 1 },
  { name: "Carlos Alcaraz",   nameKo: "카를로스 알카라스", country: "ES", tour: "ATP", racketBrand: "BABOLAT",    racketModel: "Pure Aero 2023",     atpRank: 2 },
  { name: "Alexander Zverev", nameKo: "알렉산더 즈베레프", country: "DE", tour: "ATP", racketBrand: "HEAD",       racketModel: "Speed Pro 2025",     atpRank: 3 },
  { name: "Daniil Medvedev",  nameKo: "다닐 메드베데프",   country: "RU", tour: "ATP", racketBrand: "TECNIFIBRE", racketModel: "Tfight 305 ISO",     atpRank: 4 },
  { name: "Novak Djokovic",   nameKo: "노박 조코비치",     country: "RS", tour: "ATP", racketBrand: "HEAD",       racketModel: "Speed Pro 2025",     atpRank: 7 },
  { name: "Roger Federer",    nameKo: "로저 페더러",       country: "CH", tour: "ATP", racketBrand: "WILSON",     racketModel: "Pro Staff RF97 v14", atpRank: null },
  { name: "Soonwoo Kwon",     nameKo: "권순우",            country: "KR", tour: "ATP", racketBrand: "YONEX",      racketModel: "EZONE 98 v8",        atpRank: 65 },
  { name: "Grigor Dimitrov",  nameKo: "그리고르 디미트로프", country: "BG", tour: "ATP", racketBrand: "WILSON",    racketModel: "Pro Staff RF97 v14", atpRank: 15 },
  { name: "Iga Swiatek",      nameKo: "이가 시비옹테크",   country: "PL", tour: "WTA", racketBrand: "BABOLAT",    racketModel: "Pure Aero 2023",     atpRank: 1 },
  { name: "Coco Gauff",       nameKo: "코코 가우프",       country: "US", tour: "WTA", racketBrand: "HEAD",       racketModel: "Speed Pro 2025",     atpRank: 3 },
  { name: "Aryna Sabalenka",  nameKo: "아리나 사발렌카",   country: "BY", tour: "WTA", racketBrand: "WILSON",     racketModel: "Blade 98 v8",        atpRank: 2 },
  { name: "Sohyun Park",      nameKo: "박소현",            country: "KR", tour: "WTA", racketBrand: "WILSON",     racketModel: "Blade 98 v8",        atpRank: 89 },
];

const TOURNAMENT_SEED: Array<{
  name: string;
  nameKo: string;
  type: TournamentType;
  city: string;
  utcOffsetMinutes: number;
  startDate: string;
  endDate: string;
  broadcastChannels: string[];
}> = [
  { name: "Australian Open 2026", nameKo: "호주오픈 2026",   type: "GRAND_SLAM", city: "Melbourne", utcOffsetMinutes:  660, startDate: "2026-01-19", endDate: "2026-02-01", broadcastChannels: ["SBS 스포츠","쿠팡플레이"] },
  { name: "Roland Garros 2026",   nameKo: "롤랑가로스 2026", type: "GRAND_SLAM", city: "Paris",     utcOffsetMinutes:  120, startDate: "2026-05-24", endDate: "2026-06-08", broadcastChannels: ["SBS 스포츠","JTBC골프&스포츠","쿠팡플레이"] },
  { name: "Wimbledon 2026",       nameKo: "윔블던 2026",     type: "GRAND_SLAM", city: "London",    utcOffsetMinutes:   60, startDate: "2026-06-29", endDate: "2026-07-12", broadcastChannels: ["SBS 스포츠","쿠팡플레이"] },
  { name: "US Open 2026",         nameKo: "US오픈 2026",     type: "GRAND_SLAM", city: "New York",  utcOffsetMinutes: -240, startDate: "2026-08-31", endDate: "2026-09-13", broadcastChannels: ["SBS 스포츠","쿠팡플레이"] },
];

async function runMigration(): Promise<NextResponse> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: "DATABASE_URL or DIRECT_URL not set" }, { status: 500 });
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const results: Array<{ ok: boolean; step: string; error?: string; detail?: string }> = [];

  try {
    // 1) DDL 순차 실행
    for (const sql of DDL_STATEMENTS) {
      const tag = sql.slice(0, 80).replace(/\s+/g, " ");
      try {
        await prisma.$executeRawUnsafe(sql);
        results.push({ ok: true, step: tag });
      } catch (e) {
        results.push({ ok: false, step: tag, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // 2) 라켓 시드 (ON CONFLICT DO NOTHING — Prisma upsert로 idempotent)
    let racketCount = 0;
    for (const r of RACKET_SEED) {
      try {
        await prisma.racket.upsert({
          where: { brand_model: { brand: r.brand, model: r.model } },
          create: r,
          update: {},
        });
        racketCount++;
      } catch (e) {
        results.push({
          ok: false,
          step: `seed racket ${r.brand} ${r.model}`,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    results.push({ ok: true, step: "seed: rackets", detail: `${racketCount}/${RACKET_SEED.length}` });

    // 3) 프로 선수 시드 (이름 unique 없으므로 findFirst 후 upsert 흉내)
    let playerCount = 0;
    for (const p of PLAYER_SEED) {
      const racket = await prisma.racket.findUnique({
        where: { brand_model: { brand: p.racketBrand, model: p.racketModel } },
      });
      if (!racket) {
        results.push({
          ok: false,
          step: `seed player ${p.name}`,
          error: `racket not found: ${p.racketBrand} ${p.racketModel}`,
        });
        continue;
      }
      const existing = await prisma.proPlayer.findFirst({ where: { name: p.name } });
      if (!existing) {
        await prisma.proPlayer.create({
          data: {
            name: p.name,
            nameKo: p.nameKo,
            country: p.country,
            tour: p.tour,
            racketId: racket.id,
            atpRank: p.atpRank,
          },
        });
      }
      playerCount++;
    }
    results.push({ ok: true, step: "seed: pro_players", detail: `${playerCount}/${PLAYER_SEED.length}` });

    // 4) 대회 시드
    let tourCount = 0;
    for (const t of TOURNAMENT_SEED) {
      const existing = await prisma.tournament.findFirst({ where: { name: t.name } });
      if (!existing) {
        await prisma.tournament.create({
          data: {
            name: t.name,
            nameKo: t.nameKo,
            type: t.type,
            city: t.city,
            utcOffsetMinutes: t.utcOffsetMinutes,
            startDate: new Date(t.startDate),
            endDate: new Date(t.endDate),
            broadcastChannels: t.broadcastChannels,
          },
        });
      }
      tourCount++;
    }
    results.push({ ok: true, step: "seed: tournaments", detail: `${tourCount}/${TOURNAMENT_SEED.length}` });

    // 5) 검증
    const [racketsCnt, playersCnt, toursCnt] = await Promise.all([
      prisma.racket.count(),
      prisma.proPlayer.count(),
      prisma.tournament.count(),
    ]);

    return NextResponse.json({
      ok: true,
      summary: {
        rackets: racketsCnt,
        proPlayers: playersCnt,
        tournaments: toursCnt,
      },
      results,
    });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== ONE_TIME_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runMigration();
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== ONE_TIME_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runMigration();
}
