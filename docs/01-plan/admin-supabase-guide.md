# 어드민 운영 가이드 (Supabase Studio 기반)

> **MVP 단계**: 정식 어드민 페이지(FR-14)를 만들지 않고 **Supabase Studio**(Dashboard 웹 UI)에서 직접 데이터 관리. Phase 2에 정식 어드민 페이지 도입.

## 1. 접속

- URL: `https://supabase.com/dashboard/project/{프로젝트ID}/editor`
- 좌측 사이드바 **Table Editor** 클릭

## 2. 구독 플랜 관리

### 2.1 가격·할인 문구 수정

1. `subscription_plans` 테이블 열기
2. 수정할 행(`code = MONTHLY` 등) 클릭 → Edit
3. 변경 가능한 필드:
   - `price` — 가격 (정수, 원 단위)
   - `discount` — 할인 문구 (예: `🔥 첫 3개월 ₩9,900 (60% 할인)`, NULL이면 표시 X)
   - `name`, `ctaText`, `isBest`, `sortOrder`, `isActive`
4. **Save**
5. 즉시 `/onboarding/coach/plan` 화면에 반영됨 (캐시 X)

### 2.2 정책 한도 조정

`subscription_plans` 테이블의 정책 컴럼:

| 컴럼 | 의미 | NULL | 예시 |
|------|------|------|------|
| `studentLimit` | 학생 등록 한도 | 무제한 | `3` = 3명까지 |
| `alimtalkLimit` | 월 알림톡 발송 한도 | 무제한 | `30` = 월 30건 |
| `hasStats` | 통계 대시보드 표시 | — | `true` / `false` |
| `hasMemberSearch` | 회원 검색 사용 가능 | — | `true` / `false` |
| `hasCsvExport` | CSV 내보내기 사용 가능 | — | `true` / `false` |
| `hasPrioritySupport` | 카톡 1:1 우선 지원 | — | `true` / `false` |
| `hasAutoRegular` | 정기 레슨 자동 생성 | — | `true` / `false` |

이 값을 바꾸면 비즈니스 로직(예: 학생 등록 차단, 알림톡 큐 hold)이 즉시 새 값을 따름.

### 2.3 카드 표시 체크리스트 수정

플랜 카드에 표시되는 체크리스트(예: "학생 무제한 관리", "통계 대시보드")는 `subscription_plan_features` 테이블에서 관리.

1. `subscription_plan_features` 테이블 열기
2. 해당 `planId` 행 필터링
3. 추가/삭제/순서 변경:
   - `label` — 표시 텍스트
   - `enabled` — `true`(✓ 활성) / `false`(✗ 회색 + 취소선)
   - `sortOrder` — 노출 순서

### 2.4 플랜 일시 숨김

신규 가입자에게 특정 플랜 안 보이게 하려면 `isActive = false`로 변경. 기존 구독자에걏 영향 없음.

### 2.5 신규 플랜 추가

1. `subscription_plans`에 새 행 INSERT (`code` 고유값 필요, 예: `BIZ`, `STARTER_PLUS`)
2. `subscription_plan_features`에 해당 `planId`로 체크리스트 추가
3. 코드 변경 없이 화면에 노출됨

⚠️ **주의**: `code` 값은 비즈니스 로직(예: `selectPlan` Server Action의 VALID_PLANS)과 매칭됨. 새 코드 추가 시에는 `app/onboarding/coach/plan/actions.ts`의 화이트리스트도 함께 업데이트해야 함.

## 3. 코드 관리 (어드민 코드 테이블)

### 3.1 전문 분야 (`coach_specialties`)

테니스 외 운동 종목/세부 분야 추가 시 행 INSERT.

### 3.2 레슨 목표 (`lesson_goals`)

학생 가입 시 선택할 수 있는 목표 항목.

## 4. 사용자 직접 관리

### 4.1 코치/학생 강제 변경

`users` 테이블에서 `role` 직접 수정 가능. 단, `auth.users` 의 `raw_app_meta_data.role` 도 함께 업데이트해야 세션이 새 역할로 인식됨.

```sql
-- 예: 특정 사용자를 ADMIN으로 변경
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', 'ADMIN')
WHERE id = '...uuid...';

UPDATE public.users SET role = 'ADMIN' WHERE id = '...uuid...';
```

### 4.2 환불·구독 취소

`coach_subscriptions` 테이블에서 `status = EXPIRED`로 변경. 토스페이먼츠 환불은 별도(토스 대시보드).

## 5. 모니터링

- **Logs**: 좌측 **Logs** → Server-side 로그
- **Database** → **Query Performance**로 느린 쿼리 확인
- **Auth** → **Users** 화면에서 가입 사용자 조회

## 6. 백업·롤백

- Supabase는 자동 일일 백업(무료 플랜 7일, Pro 플랜 30일)
- 좌측 **Database** → **Backups**
- 사고 시 시점 복구 가능
