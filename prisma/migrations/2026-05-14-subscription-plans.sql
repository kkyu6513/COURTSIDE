-- ============================================================
-- COURTSIDE — 구독 플랜 테이블 + Seed
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 1회만 실행 (이미 테이블 있으면 SKIP 또는 DROP 후 재실행)
-- ============================================================

-- 1. SubscriptionPlan 테이블
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                  SERIAL PRIMARY KEY,
  code                TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  price               INTEGER NOT NULL,
  "billingCycle"      TEXT NOT NULL,
  "isBest"            BOOLEAN NOT NULL DEFAULT false,
  discount            TEXT,
  "ctaText"           TEXT NOT NULL,
  "ctaStyle"          TEXT NOT NULL,
  "sortOrder"         INTEGER NOT NULL DEFAULT 0,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "studentLimit"      INTEGER,
  "alimtalkLimit"     INTEGER,
  "hasStats"          BOOLEAN NOT NULL DEFAULT false,
  "hasMemberSearch"   BOOLEAN NOT NULL DEFAULT false,
  "hasCsvExport"      BOOLEAN NOT NULL DEFAULT false,
  "hasPrioritySupport" BOOLEAN NOT NULL DEFAULT false,
  "hasAutoRegular"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SubscriptionPlanFeature 테이블 (카드에 표시될 체크리스트)
CREATE TABLE IF NOT EXISTS subscription_plan_features (
  id         SERIAL PRIMARY KEY,
  "planId"   INTEGER NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  label      TEXT NOT NULL,
  enabled    BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_plan_features_plan_sort
  ON subscription_plan_features("planId", "sortOrder");

-- 3. Seed 데이터 — Coach SaaS B+C 결정 (2026-05-14)
--    무료 / 월간 PRO (BEST, 첫 3개월 프로모션) / 연간 PRO (32% 할인)

-- 기존 데이터 정리 (재실행 가능)
DELETE FROM subscription_plan_features;
DELETE FROM subscription_plans;
-- 시퀀스 리셋
SELECT setval(pg_get_serial_sequence('subscription_plans', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('subscription_plan_features', 'id'), 1, false);

-- 🆓 Starter (무료)
INSERT INTO subscription_plans
  (code, name, price, "billingCycle", "isBest", discount, "ctaText", "ctaStyle", "sortOrder",
   "studentLimit", "alimtalkLimit", "hasStats", "hasMemberSearch", "hasCsvExport", "hasPrioritySupport", "hasAutoRegular")
VALUES
  ('FREE', '무료', 0, 'monthly', false, NULL, '무료로 시작', 'secondary', 1,
   3, 30, false, false, false, false, false);

INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder") VALUES
  ((SELECT id FROM subscription_plans WHERE code='FREE'), 'STUDENT_3',         '학생 3명까지 관리',              true, 1),
  ((SELECT id FROM subscription_plans WHERE code='FREE'), 'SCHEDULE',          '스케줄 등록',                   true, 2),
  ((SELECT id FROM subscription_plans WHERE code='FREE'), 'CHAT',              '1:1 채팅',                     true, 3),
  ((SELECT id FROM subscription_plans WHERE code='FREE'), 'ALIMTALK_30',       '알림톡 월 30건',                 true, 4),
  ((SELECT id FROM subscription_plans WHERE code='FREE'), 'AUTO_REGULAR',      '정기 레슨 자동 생성',             false, 5),
  ((SELECT id FROM subscription_plans WHERE code='FREE'), 'STATS',             '통계 대시보드',                  false, 6);

-- 💎 월간 PRO (BEST + 첫 3개월 프로모션)
INSERT INTO subscription_plans
  (code, name, price, "billingCycle", "isBest", discount, "ctaText", "ctaStyle", "sortOrder",
   "studentLimit", "alimtalkLimit", "hasStats", "hasMemberSearch", "hasCsvExport", "hasPrioritySupport", "hasAutoRegular")
VALUES
  ('MONTHLY', '월간 PRO', 24900, 'monthly', true, '🔥 첫 3개월 ₩9,900 (60% 할인)',
   'PRO 시작하기', 'primary', 2,
   NULL, NULL, true, true, false, false, true);

INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder") VALUES
  ((SELECT id FROM subscription_plans WHERE code='MONTHLY'), 'STUDENT_UNLIMITED', '학생 무제한 관리',               true, 1),
  ((SELECT id FROM subscription_plans WHERE code='MONTHLY'), 'ALIMTALK_UNLIMITED', '알림톡 무제한 발송',            true, 2),
  ((SELECT id FROM subscription_plans WHERE code='MONTHLY'), 'AUTO_REGULAR',      '정기 레슨 자동 생성',             true, 3),
  ((SELECT id FROM subscription_plans WHERE code='MONTHLY'), 'STATS',             '통계 대시보드 (매출·출석·회차)', true, 4),
  ((SELECT id FROM subscription_plans WHERE code='MONTHLY'), 'MEMBER_SEARCH',     '회원 검색·정렬',                 true, 5),
  ((SELECT id FROM subscription_plans WHERE code='MONTHLY'), 'PRO_BADGE',         'PRO 배지 부여',                  true, 6);

-- 🏆 연간 PRO (32% 할인)
INSERT INTO subscription_plans
  (code, name, price, "billingCycle", "isBest", discount, "ctaText", "ctaStyle", "sortOrder",
   "studentLimit", "alimtalkLimit", "hasStats", "hasMemberSearch", "hasCsvExport", "hasPrioritySupport", "hasAutoRegular")
VALUES
  ('YEARLY', '연간 PRO', 16900, 'monthly', false, '32% 할인 — 연 ₩202,800',
   '연간 플랜 선택', 'secondary', 3,
   NULL, NULL, true, true, true, true, true);

INSERT INTO subscription_plan_features ("planId", code, label, enabled, "sortOrder") VALUES
  ((SELECT id FROM subscription_plans WHERE code='YEARLY'), 'ALL_MONTHLY',       '월간 PRO 전체 기능',              true, 1),
  ((SELECT id FROM subscription_plans WHERE code='YEARLY'), 'CSV_EXPORT',        '레슨 이력 CSV 내보내기',           true, 2),
  ((SELECT id FROM subscription_plans WHERE code='YEARLY'), 'PRIORITY_SUPPORT',  '우선 고객 지원 (카톡 1:1)',         true, 3),
  ((SELECT id FROM subscription_plans WHERE code='YEARLY'), 'VERIFY_PRIORITY',   '인증 배지 우선 심사',              true, 4),
  ((SELECT id FROM subscription_plans WHERE code='YEARLY'), 'ANNUAL_BADGE',      'ANNUAL 배지 부여',                true, 5);

-- 4. 확인 쿼리
SELECT
  p.code, p.name, p.price, p."isBest", p.discount,
  p."studentLimit", p."alimtalkLimit",
  (SELECT COUNT(*) FROM subscription_plan_features WHERE "planId" = p.id) AS feature_count
FROM subscription_plans p
ORDER BY p."sortOrder";
