-- ============================================================
-- COURTSIDE — FR-16 학생 리텐션 콘텐츠 (오늘의 코트사이드 / 내 라켓 / 그랜드슬램)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 1회만 실행
-- ============================================================

-- 0. User에 dailyPushTime 컬럼 추가 (FR-16a)
ALTER TABLE users ADD COLUMN IF NOT EXISTS "dailyPushTime" TEXT DEFAULT '08:00';

-- ─────────────────────────────────────────────────────────────
-- 1. Enum 6종
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "DailyContentType" AS ENUM ('WEATHER', 'KR_MATCH', 'HIGHLIGHT', 'LOCAL_TOURNAMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RacketBrand" AS ENUM ('WILSON', 'BABOLAT', 'HEAD', 'YONEX', 'PRINCE', 'DUNLOP', 'TECNIFIBRE', 'PROKENNEX');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TournamentType" AS ENUM ('GRAND_SLAM', 'ATP', 'WTA', 'LOCAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProTour" AS ENUM ('ATP', 'WTA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RacketNewsType" AS ENUM ('NEW_MODEL', 'SALE', 'STRING_TIP', 'REVIEW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. DailyContent (FR-16a)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_contents (
  id            SERIAL PRIMARY KEY,
  "contentDate" DATE NOT NULL,
  type          "DailyContentType" NOT NULL,
  region        TEXT,
  title         TEXT NOT NULL,
  summary       TEXT,
  body          TEXT,
  "externalUrl" TEXT,
  meta          JSONB,
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_daily_contents_date_type_region
  ON daily_contents("contentDate", type, region);

-- ─────────────────────────────────────────────────────────────
-- 3. Racket (FR-16b 마스터)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rackets (
  id            SERIAL PRIMARY KEY,
  brand         "RacketBrand" NOT NULL,
  model         TEXT NOT NULL,
  "headSize"    INTEGER,
  weight        INTEGER,
  "imageUrl"    TEXT,
  "releaseYear" INTEGER,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand, model)
);

-- ─────────────────────────────────────────────────────────────
-- 4. UserRacket (FR-16b 학생-라켓 매핑)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_rackets (
  id                       SERIAL PRIMARY KEY,
  "userId"                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "racketId"               INTEGER NOT NULL REFERENCES rackets(id),
  "stringType"             TEXT,
  "stringTension"          INTEGER,
  "lastStringChangeDate"   DATE,
  "isActive"               BOOLEAN NOT NULL DEFAULT true,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_rackets_user_active
  ON user_rackets("userId", "isActive");

-- ─────────────────────────────────────────────────────────────
-- 5. StringChangeLog (FR-16b 스트링 교체 이력)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS string_change_logs (
  id             SERIAL PRIMARY KEY,
  "userRacketId" INTEGER NOT NULL REFERENCES user_rackets(id) ON DELETE CASCADE,
  "changeDate"   DATE NOT NULL,
  tension        INTEGER,
  "stringType"   TEXT,
  memo           TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_string_logs_racket_date
  ON string_change_logs("userRacketId", "changeDate");

-- ─────────────────────────────────────────────────────────────
-- 6. ProPlayer (FR-16b/c 프로 선수 마스터)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pro_players (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  "nameKo"    TEXT,
  country     TEXT NOT NULL,
  tour        "ProTour" NOT NULL,
  "racketId"  INTEGER REFERENCES rackets(id),
  "atpRank"   INTEGER,
  "imageUrl"  TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 7. FavoritePlayer (FR-16c 즐겨찾기 선수)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorite_players (
  id            SERIAL PRIMARY KEY,
  "userId"      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "proPlayerId" INTEGER NOT NULL REFERENCES pro_players(id) ON DELETE CASCADE,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", "proPlayerId")
);

-- ─────────────────────────────────────────────────────────────
-- 8. Tournament (FR-16a/c 대회 마스터)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournaments (
  id                     SERIAL PRIMARY KEY,
  name                   TEXT NOT NULL,
  "nameKo"               TEXT,
  type                   "TournamentType" NOT NULL,
  city                   TEXT NOT NULL,
  "utcOffsetMinutes"     INTEGER NOT NULL,
  "startDate"            DATE NOT NULL,
  "endDate"              DATE NOT NULL,
  region                 TEXT,
  "minNtrp"              DECIMAL(2,1),
  "maxNtrp"              DECIMAL(2,1),
  "broadcastChannels"    TEXT[],
  "externalUrl"          TEXT,
  "registrationDeadline" DATE,
  "isActive"             BOOLEAN NOT NULL DEFAULT true,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tournaments_type_start
  ON tournaments(type, "startDate");

-- ─────────────────────────────────────────────────────────────
-- 9. ProMatch (FR-16a/c 프로 경기)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pro_matches (
  id             SERIAL PRIMARY KEY,
  "tournamentId" INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round          TEXT NOT NULL,
  "player1Id"    INTEGER NOT NULL REFERENCES pro_players(id),
  "player2Id"    INTEGER NOT NULL REFERENCES pro_players(id),
  "scheduledAt"  TIMESTAMPTZ NOT NULL,
  status         "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
  "winnerId"     INTEGER,
  score          TEXT,
  "highlightUrl" TEXT,
  "aiSummary"    TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pro_matches_sched_status
  ON pro_matches("scheduledAt", status);
CREATE INDEX IF NOT EXISTS idx_pro_matches_tour_round
  ON pro_matches("tournamentId", round);

-- ─────────────────────────────────────────────────────────────
-- 10. RacketNews (FR-16b 뉴스/할인)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS racket_news (
  id               SERIAL PRIMARY KEY,
  type             "RacketNewsType" NOT NULL,
  "targetBrand"    "RacketBrand",
  "targetRacketId" INTEGER REFERENCES rackets(id),
  title            TEXT NOT NULL,
  body             TEXT,
  "imageUrl"       TEXT,
  "externalUrl"    TEXT,
  "publishedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "isActive"       BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_racket_news_type_pub
  ON racket_news(type, "publishedAt");

-- ─────────────────────────────────────────────────────────────
-- 11. Seed — 라켓 마스터 데이터 (대표 16종)
-- ─────────────────────────────────────────────────────────────
INSERT INTO rackets (brand, model, "headSize", weight, "releaseYear") VALUES
  ('WILSON', 'Blade 98 v8', 98, 305, 2025),
  ('WILSON', 'Pro Staff RF97 v14', 97, 340, 2024),
  ('WILSON', 'Clash 100 Pro', 100, 310, 2024),
  ('WILSON', 'Ultra 100 v4', 100, 300, 2024),
  ('BABOLAT', 'Pure Aero 2023', 100, 300, 2023),
  ('BABOLAT', 'Pure Drive 2024', 100, 300, 2024),
  ('BABOLAT', 'Pure Strike 98 16x19', 98, 305, 2024),
  ('HEAD', 'Speed Pro 2025', 100, 310, 2025),
  ('HEAD', 'Radical Pro 2023', 98, 315, 2023),
  ('HEAD', 'Prestige MP 2024', 98, 320, 2024),
  ('YONEX', 'Percept 97D', 97, 320, 2024),
  ('YONEX', 'EZONE 98 v8', 98, 305, 2024),
  ('YONEX', 'VCORE 98 2023', 98, 305, 2023),
  ('PRINCE', 'Phantom 100X 305g', 100, 305, 2024),
  ('DUNLOP', 'FX 500 2024', 100, 300, 2024),
  ('TECNIFIBRE', 'Tfight 305 ISO', 98, 305, 2024)
ON CONFLICT (brand, model) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 12. Seed — 프로 선수 (대표 12명, 라켓 매칭)
-- ─────────────────────────────────────────────────────────────
INSERT INTO pro_players (name, "nameKo", country, tour, "racketId", "atpRank") VALUES
  ('Jannik Sinner',     '야닉 시너',       'IT', 'ATP', (SELECT id FROM rackets WHERE brand='HEAD' AND model='Speed Pro 2025'), 1),
  ('Carlos Alcaraz',    '카를로스 알카라스', 'ES', 'ATP', (SELECT id FROM rackets WHERE brand='BABOLAT' AND model='Pure Aero 2023'), 2),
  ('Alexander Zverev',  '알렉산더 즈베레프', 'DE', 'ATP', (SELECT id FROM rackets WHERE brand='HEAD' AND model='Speed Pro 2025'), 3),
  ('Daniil Medvedev',   '다닐 메드베데프',   'RU', 'ATP', (SELECT id FROM rackets WHERE brand='TECNIFIBRE' AND model='Tfight 305 ISO'), 4),
  ('Novak Djokovic',    '노박 조코비치',     'RS', 'ATP', (SELECT id FROM rackets WHERE brand='HEAD' AND model='Speed Pro 2025'), 7),
  ('Roger Federer',     '로저 페더러',       'CH', 'ATP', (SELECT id FROM rackets WHERE brand='WILSON' AND model='Pro Staff RF97 v14'), NULL),
  ('Soonwoo Kwon',      '권순우',           'KR', 'ATP', (SELECT id FROM rackets WHERE brand='YONEX' AND model='EZONE 98 v8'), 65),
  ('Iga Swiatek',       '이가 시비옹테크',   'PL', 'WTA', (SELECT id FROM rackets WHERE brand='BABOLAT' AND model='Pure Aero 2023'), 1),
  ('Coco Gauff',        '코코 가우프',       'US', 'WTA', (SELECT id FROM rackets WHERE brand='HEAD' AND model='Speed Pro 2025'), 3),
  ('Aryna Sabalenka',   '아리나 사발렌카',   'BY', 'WTA', (SELECT id FROM rackets WHERE brand='WILSON' AND model='Blade 98 v8'), 2),
  ('Grigor Dimitrov',   '그리고르 디미트로프','BG','ATP', (SELECT id FROM rackets WHERE brand='WILSON' AND model='Pro Staff RF97 v14'), 15),
  ('Sohyun Park',       '박소현',           'KR', 'WTA', (SELECT id FROM rackets WHERE brand='WILSON' AND model='Blade 98 v8'), 89)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 13. Seed — 2026 그랜드슬램 4종
-- ─────────────────────────────────────────────────────────────
INSERT INTO tournaments (name, "nameKo", type, city, "utcOffsetMinutes", "startDate", "endDate", "broadcastChannels") VALUES
  ('Australian Open 2026', '호주오픈 2026', 'GRAND_SLAM', 'Melbourne', 660, '2026-01-19', '2026-02-01', ARRAY['SBS 스포츠','쿠팡플레이']),
  ('Roland Garros 2026',   '롤랑가로스 2026', 'GRAND_SLAM', 'Paris',     120, '2026-05-24', '2026-06-08', ARRAY['SBS 스포츠','JTBC골프&스포츠','쿠팡플레이']),
  ('Wimbledon 2026',       '윔블던 2026',     'GRAND_SLAM', 'London',     60, '2026-06-29', '2026-07-12', ARRAY['SBS 스포츠','쿠팡플레이']),
  ('US Open 2026',         'US오픈 2026',     'GRAND_SLAM', 'New York', -240, '2026-08-31', '2026-09-13', ARRAY['SBS 스포츠','쿠팡플레이'])
ON CONFLICT DO NOTHING;
