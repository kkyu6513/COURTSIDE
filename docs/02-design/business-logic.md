# COURTSIDE — 비즈니스 로직 정의서

> **Project**: tennis-coach-matching (COURTSIDE)
> **Version**: 1.0.0
> **Date**: 2026-04-12
> **목적**: 데이터 조회 조건, 정렬 규칙, 계산 공식, 정책 등 비즈니스 로직을 정의

---

## 목차

1. [홈 화면 섹션 노출 로직](#1-홈-화면-섹션-노출-로직)
2. [코치 검색/필터 로직](#2-코치-검색필터-로직)
3. [구독 플랜 정책](#3-구독-플랜-정책)
4. [레슨 신청/예약 로직](#4-레슨-신청예약-로직)
5. [스케줄 관리 로직](#5-스케줄-관리-로직)
6. [리뷰/평점 계산](#6-리뷰평점-계산)
7. [알림 발송 정책](#7-알림-발송-정책)
8. [약관 버전 관리](#8-약관-버전-관리)
9. [인증/권한 정책](#9-인증권한-정책)
10. [캐시 정책](#10-캐시-정책)

---

## 1. 홈 화면 섹션 노출 로직

### 1.1 우리동네 코치님

**4가지 케이스 분기:**

| 케이스 | 조건 | 노출 | 이동 |
|--------|------|------|------|
| A. 비로그인 | JWT 없음 | 로그인 유도 안내 | → 로그인 |
| B. 지역 미설정 | 로그인 + preferredAreaSido = null | 지역 설정 유도 | → 테니스 정보 |
| C. 코치 있음 | 로그인 + 지역 설정 + 해당 지역 코치 1명+ | 코치 카드 목록 | → 코치 상세/목록 |
| D. 코치 없음 | 로그인 + 지역 설정 + 해당 지역 코치 0명 | 빈 상태 안내 | → 코치 목록 |

**조회 로직 (Case C):**
```
API: GET /api/coaches?sido={preferredAreaSido}&sigungu={preferredAreaSigungu}&limit=5&sort=rating
인증: 필요 (수강생/코치)

정렬 우선순위:
  1차: averageRating DESC (평점 높은 순)
  2차: reviewCount DESC (리뷰 많은 순)
  3차: createdAt DESC (최신 등록순)

확대 로직:
  해당 시·군·구에 5명 미만 → 동일 시·도의 다른 시·군·구 코치로 확대 조회
  확대 시 원래 시·군·구 코치를 우선 배치
```

### 홈 화면 코치 카드 공통 구성 (우리동네/핫한/신규 동일)

| 요소 | 데이터 경로 | 표시 |
|------|-----------|------|
| 프로필 사진 | `User.profileImage` | 원형 52px. 미등록 시 기본 그라디언트 |
| 코치명 | `User.name` | 14px Bold |
| 지역 (1뎁스 + 2뎁스) | `CoachProfile.areaSido` + `CoachProfile.areaSigungu` | "서울특별시 강남구" (전체 노출) |
| 성별 | `CoachProfile.gender` | MALE → "남성" / FEMALE → "여성" |

**미표시 항목** (카드에서 제외):
- ~~전문분야~~ — 코치 상세에서 확인
- ~~평점 (★)~~ — 코치 상세에서 확인
- ~~구독 배지 (PRO/ANNUAL/FREE)~~ — 코치 상세에서 확인

---

### 1.2 지금 핫한 코치님

**노출 조건:** 로그인 여부 무관 (공개 API)

**인기 점수 계산:**
```
popularityScore = (최근 30일 bookingCount) × 0.4
               + averageRating × 0.3
               + reviewCount × 0.3
```

**최소 조건:**
- `reviewCount >= 3` (리뷰 3개 이상)
- `averageRating >= 4.0` (평점 4.0 이상)
- 조건 미충족 코치는 목록에서 제외

**조회 로직:**
```
API: GET /api/coaches?sort=popular&limit=5 [공개]

정렬: popularityScore DESC
노출: 최대 5명 (가로 스크롤)
갱신: 서버 캐시 1시간 (배치 계산, 실시간 아님)
빈 상태: 조건 충족 코치 0명이면 섹션 숨김 (서비스 초기)
```

**HOT 배지:**
- 인기 점수 상위 3명에게만 🔥 HOT 배지 표시
- 4~5위는 배지 없이 일반 카드

### 1.3 신규등록 코치님

**목적:** 신규 코치에게 초기 노출 기회를 제공하여 첫 레슨 신청 유도 + 코치 유입 촉진

**노출 조건:** 로그인 여부 무관 (공개 API)

**조회 로직:**
```
API: GET /api/coaches?sort=newest&limit=5 [공개]

정렬: CoachProfile.createdAt DESC (등록일 최신순)
필터:
  - createdAt >= NOW() - 30일 (최근 30일 이내 등록)
  - 프로필 필수 항목 모두 완료 (이름, 소개, 전문분야 1개+, 지역, 소개 이미지 1장+)
  - User.isActive = true (차단 코치 제외)
  - CoachProfile.isVerified는 무관 (인증 없어도 노출)
노출: 최대 5명 (가로 스크롤)
갱신: 서버 캐시 30분
빈 상태: 조건 충족 코치 0명이면 섹션 자체 숨김
```

**30일 경과 후 처리:**
```
코치 등록일이 30일을 초과하면:
  → 신규등록 섹션에서 자동 제외 (쿼리 조건으로 자동, 별도 처리 없음)
  → 해당 코치는 "핫한 코치님"이나 일반 검색 결과에서 노출
  → NEW 배지도 자동 제거 (프론트에서 createdAt 기준 30일 체크)
```

**코치 카드 구성:** 홈 화면 공통 카드 구성 참조 (프로필 사진 + 코치명 + 지역 전체 + 성별)

**"핫한 코치님"과의 차이:**

| | 핫한 코치님 | 신규등록 코치님 |
|---|-----------|-------------|
| 정렬 | 인기 점수 (가중치 계산) | 등록일 최신순 |
| 최소 조건 | 리뷰 3개+ & 평점 4.0+ | 프로필 완료만 |
| 기간 필터 | 없음 (전체 기간) | 최근 30일 이내 |
| 목적 | 검증된 인기 코치 노출 | 신규 코치 초기 노출 기회 |

### 1.4 상단 배너

```
API: GET /api/banners [공개]

필터: isActive = true AND (startDate IS NULL OR startDate <= NOW()) AND (endDate IS NULL OR endDate >= NOW())
정렬: displayOrder ASC
자동 롤링: 3초 간격
클릭 시: PUT /api/admin/banners/:id/click → clickCount + 1
```

### 1.5 코치 로그인 시 진입 화면 분기

```
스플래시 (2초 후):
  JWT 확인 → User.role 분기
    비로그인        → 홈 화면 (2-1)
    role = STUDENT  → 홈 화면 (2-1)
    role = COACH    → 코치 스케줄 홈 (7-0)
    role = ADMIN    → 어드민 대시보드 (9-1)
```

### 1.5a 하단 네비게이션 분기

| 탭 | 비로그인 / 수강생 | 코치 |
|---|---|---|
| 1번 | 🏠 홈 → 2-1 | **📅 스케줄 → 7-0** |
| 2번 | 💬 메시지 → 4-1 | 💬 메시지 → 4-1 |
| 3번 | 🔍 검색 → 2-2 | 🔍 검색 → 2-2 |
| 4번 | 👤 마이 → 6-2 / 6-1 | 👤 마이 → 7-1 |

### 1.6 코치 등록 유도 배너 (최하단)

| 조건 | 노출 |
|------|------|
| 비로그인 | **표시** |
| 수강생 로그인 | **숨김** |
| 코치 로그인 | **숨김** |

```
노출 조건: JWT 없음 (비로그인 상태에서만)
클릭 시: → 구독 플랜 선택 화면 (1-5-coach-subscription.html)
목적: 비로그인 사용자 중 코치 가입 유도
```

---

## 2. 코치 검색/필터 로직

### 2.1 검색 조건

```
API: GET /api/coaches [공개]

파라미터:
  keyword        (String)  — 코치명 부분 일치 (LIKE %keyword%)
  sido           (String)  — 시·도 정확 일치
  sigungu        (String)  — 시·군·구 정확 일치
  gender         (Enum)    — MALE / FEMALE / 미지정(전체)
  ntrp           (String)  — NTRP 범위 필터 (ntrpMin <= 값 <= ntrpMax)
  priceMin       (Int)     — 최소 가격
  priceMax       (Int)     — 최대 가격
  lessonFormat   (Enum)    — INDIVIDUAL / GROUP / 미지정(전체)
  experienceMin  (Int)     — 최소 경력 (년)
  experienceMax  (Int)     — 최대 경력 (년)
  sort           (String)  — rating(기본) / popular / newest / price_asc / price_desc
  page           (Int)     — 페이지 번호 (기본 1)
  limit          (Int)     — 페이지당 건수 (기본 20)
```

### 2.1a 필터 바텀시트 UI 구성

각 필터 칩 클릭 → 바텀시트 열기 → 옵션 선택 → "적용하기" → 목록 재조회

| 필터 | 바텀시트 타입 | 옵션 |
|------|-------------|------|
| 지역 | 셀렉트 2개 (시·도 + 시·군·구 연동) | 전체 + 17개 시·도 → 시·군·구 |
| 성별 | 칩 단일 선택 | 전체 / 남성 / 여성 |
| 경력 | 칩 단일 선택 | 전체 / 1~3년 / 3~5년 / 5~10년 / 10년+ |

※ NTRP, 가격대, 정렬, 레슨유형 필터는 MVP에서 제외 (코치 상세에서 확인)

### 2.2 정렬 옵션

| sort 값 | 정렬 기준 |
|---------|----------|
| `rating` | averageRating DESC, reviewCount DESC |
| `popular` | popularityScore DESC (1.2 인기 점수) |
| `newest` | createdAt DESC |
| `price_asc` | lessonPrice ASC (비공개 제외) |
| `price_desc` | lessonPrice DESC (비공개 제외) |

### 2.3 가격 비공개 코치 처리

- `priceVisibility = PRIVATE` 코치: 가격 필터 적용 시 결과에서 제외
- 가격 필터 미사용 시: 비공개 코치도 포함 (가격 대신 "가격 문의" 표시)

---

## 3. 구독 플랜 정책

### 3.1 플랜별 기능 제한

| 기능 | 무료 | 월간 PRO | 연간 PRO |
|------|:----:|:--------:|:--------:|
| 프로필 기본 노출 | ✓ | ✓ | ✓ |
| 신청 수신 | 월 5건 | 무제한 | 무제한 |
| 검색 상위 노출 | ✗ | ✓ | ✓ |
| 통계 대시보드 | ✗ | ✓ | ✓ |
| PRO/ANNUAL 배지 | ✗ | PRO | ANNUAL |
| 인증 배지 우선 심사 | ✗ | ✗ | ✓ |
| 스케줄 등록 | ✗ | ✓ | ✓ |

### 3.1a 구독 배지 노출 정책

```
PRO / ANNUAL / FREE 구독 배지:
  → 코치 상세 페이지에서 관리자(User.role = ADMIN)에게만 노출
  → 일반 사용자(수강생/코치/비로그인)에게는 미표시
  → 목적: 구독 플랜은 코치 내부 관리 정보이므로 수강생에게 공개하지 않음
  → 인증 배지(✓ 인증)는 모든 사용자에게 공개 (관리자 심사 완료 표시)
```

### 3.2 검색 상위 노출 로직

```
코치 목록 정렬 시:
  1단계: 구독 플랜 우선순위 — YEARLY(1) > MONTHLY(2) > FREE(3)
  2단계: 동일 플랜 내에서 선택된 sort 기준 적용

예: sort=rating일 때
  [YEARLY 코치들 (rating순)] → [MONTHLY 코치들 (rating순)] → [FREE 코치들 (rating순)]
```

### 3.3 무료 플랜 신청 수신 한도

```
월 5건 한도 체크:
  SELECT COUNT(*) FROM Booking
  WHERE coachId = {coachId}
    AND status = 'PENDING'
    AND createdAt >= DATE_TRUNC('month', NOW())

  결과 >= 5 → 신규 신청 거부 + 수강생에게 "해당 코치의 이번 달 신청 한도가 가득 찼습니다" 안내
```

### 3.4 구독 자동 갱신

```
스케줄러: 매일 00:00 실행

1. endDate가 오늘인 CoachSubscription 조회
2. autoRenew = true:
   → 토스페이먼츠 자동 결제 요청
   → 성공: endDate = endDate + 1개월(월간) 또는 1년(연간)
   → 실패: status = EXPIRED, 코치에게 결제 실패 알림, 3일 유예
3. autoRenew = false:
   → status = EXPIRED
   → 코치 기능을 무료 플랜으로 자동 전환
```

### 3.5 구독 해지 정책

```
해지 요청 시:
  autoRenew = false로 변경
  status는 ACTIVE 유지 (endDate까지 기능 사용 가능)
  endDate 이후 → status = EXPIRED → 무료 플랜으로 전환
```

---

## 4. 레슨 신청/예약 로직

### 4.1 예약 상태 머신 (신청 방식별 분기)

```
[레슨 신청만 (미결제)]
  POST /api/bookings (status=PENDING, paymentId=null)
  
  PENDING (대기)
    ├── 코치 수락 (스케줄 확정) → CONFIRMED (확정, 미결제)
    ├── 코치 보류 → ON_HOLD (보류, holdReason 필수 → 수강생 알림톡 발송)
    ├── 코치 거절 → REJECTED (거절, 사유 필수)
    └── 수강생/코치 취소 → CANCELLED (취소, 사유 필수)
  
  ON_HOLD (보류)
    ├── 코치 수락 (스케줄 확정) → CONFIRMED (확정)
    ├── 코치 거절 → REJECTED (거절, 사유 필수)
    └── 수강생/코치 취소 → CANCELLED
  
  CONFIRMED (확정, 미결제)
    ├── 레슨 완료 → COMPLETED (완료)
    └── 취소 → CANCELLED
  
  ※ 미결제 CONFIRMED: 스케줄 관리 기능 이용 불가

[결제 후 신청]
  POST /api/payments → POST /api/bookings (status=CONFIRMED, paymentId=결제ID)
  
  CONFIRMED (확정, 결제 완료)
    ├── 스케줄 자동 블록 (즉시)
    ├── 수강생 스케줄 관리 기능 활성화
    ├── 레슨 완료 → COMPLETED (완료)
    └── 취소 → CANCELLED (환불 처리)

COMPLETED (완료)

[보류 처리]
  PUT /api/bookings/:id/hold { reason } [인증: 코치]
    → Booking.status = ON_HOLD
    → Booking.holdReason = reason (필수)
    → Booking.holdAt = NOW()
    → 수강생에게 BOOKING_ON_HOLD 알림톡 발송 (보류 사유 포함)
    → 보류 중 신청은 "대기 중 신청" 목록에 유지
```

### 4.1a 결제 회원 vs 미결제 회원 기능 차이

| 기능 | 미결제 (신청만) | 결제 후 신청 |
|------|:-------------:|:-----------:|
| 레슨 신청 | ✓ | ✓ |
| 코치 수락 필요 | ✓ (PENDING → CONFIRMED) | ✗ (바로 CONFIRMED) |
| 서비스 내 스케줄 관리 | ✗ | **✓** |
| 레슨 이력 조회 | 코치 수락 후 | **즉시** |
| 코치 메모 확인 | 코치 수락 후 | **즉시** |
| D-1 리마인더 알림 | 코치 수락 후 | **즉시** |
| 스케줄 자동 블록 | 코치 수락 시 | **결제 즉시** |
| 환불 | — | 취소 시 환불 처리 |

### 4.1b 환불 정책

#### 정규레슨 환불

```
레슨 시작 기준:
  3일 전 취소 → 전액 환불 (100%)
  1~2일 전 취소 → 90% 환불 (위약금 10%)
  당일 취소 → 환불 불가 (0%)

처리:
  수강생 마이페이지 → 신청 내역 → 취소 버튼
  → 환불 금액 안내 + 확인 다이얼로그
  → POST /api/payments/:id/refund { refundAmount, refundReason }
  → 토스페이먼츠 부분/전액 환불 API 호출
  → Booking.status = CANCELLED
  → Payment.status = REFUNDED, refundedAt = NOW()
  → 코치 스케줄 블록 해제
```

#### 쿠폰레슨 환불

```
미사용 횟수 비례 환불:
  환불 금액 = 결제 금액 - (사용 횟수 × 1회당 금액)
  1회당 금액 = 결제 금액 / 총 횟수

예시:
  10회 쿠폰 ₩500,000 결제, 3회 사용 시:
  1회당 = ₩50,000
  환불 = ₩500,000 - (3 × ₩50,000) = ₩350,000

유효기간 만료 후:
  → 환불 불가
  → 토스트: "유효기간이 만료되어 환불이 불가합니다"
```

#### 코치 책임 취소 (공통)

```
코치 노쇼, 코치 사유 취소 시:
  → 100% 전액 환불 (위약금 없음)
  → 코치에게 경고 알림 발송
  → 반복 시 (3회 이상) 관리자에게 알림 → 조치 검토
```

#### 환불 불가 케이스

```
1. 레슨 완료 (COMPLETED) 후 → 환불 불가 (리뷰로 해결 유도)
2. 쿠폰 유효기간 만료 후 → 환불 불가
3. 정규레슨 당일 수강생 취소 → 환불 불가
```

### 4.2 중복 신청 방지

```
동일 코치에게 동일 요일+시간 조합으로 PENDING 상태 신청이 이미 있으면:
  → 신청 거부 + "이미 해당 시간에 신청한 내역이 있습니다" 토스트
```

### 4.3 무료 플랜 신청 수신 한도

→ 3.3 참조

---

## 5. 스케줄 관리 로직

### 5.1 슬롯 단위

- 10분 단위 슬롯: "09:00", "09:10", "09:20", ..., "22:50"
- 1일 최대 슬롯: 102개 (06:00~22:50)

### 5.1b 코치 스케줄 홈 (7-0) 오늘 레슨 표시 규칙

```
오늘 레슨 목록 표시 상태:
  - 🎾 진행중 (코랄/빨강): status=CONFIRMED이고 현재 시간이 레슨 시작~종료 시간 범위 내인 건
    판정: now >= startTime AND now < endTime
    endTime = startTime + lessonDurationMinutes (기본 60분)
  - 📌 레슨 예정 (보라색): status=CONFIRMED이고 오늘 날짜이며 시작 시간이 현재 시간 이후인 건
  - 🔄 변경 요청 (주황색): 오늘 레슨 중 rescheduleStatus가 PENDING 또는 PROPOSED인 건
    변경 요청이 있는 레슨도 오늘 레슨 목록에 함께 표시
  - 🏁 레슨완료 (파란색): status=COMPLETED이고 오늘 날짜인 건
  - ※ "확정" 배지는 오늘 레슨 목록에 노출하지 않음 (레슨 예정/진행중으로 대체)

레슨 시간 표시: 시작 시간만 표시 (종료 시간 미노출)

레슨 상세 풀팝업:
  - 레슨 목표 항목은 표시하지 않음
  - [변경 요청] 상태: 레슨 정보(유형/형태/결제) 하단에 "변경 요청" 타이틀로 영역 구분 후
    변경 요청 UI 배치: 기존 일정(취소선) + 수강생 희망 날짜 + 자동 추천 가능 날짜(칩, 단일 선택 가능)
    추천 슬롯 칩 클릭 시 선택/해제 토글 (다중 선택 가능)
    하단 버튼 좌/우 배치: [선택 제안하기] (선택한 슬롯만 제안, 선택 시 활성화) | [모두 제안하기] (전체 슬롯 제안)
    선택 제안하기: 아웃라인 스타일 (초록 테두리+텍스트), 선택 없으면 비활성(회색)
    버튼 하단에 제안하기 안내 영역: 제안 시 12시간 임시 홀드 + 수강생에게 알림톡 발송 + 응답 없으면 자동 해제 설명
    추천 슬롯이 없으면 "불가 알림 보내기" 버튼 표시
  - 상태별 하단 액션:
    [진행중]   레슨 완료 처리 (단일 버튼)
    [레슨 예정] 취소 + 레슨 완료 처리
    [변경 요청] 모두 제안하기 또는 불가 알림 보내기
    [대기 중]   더보기(보류/거절) + 스케줄 확정하기
    [레슨완료]  닫기
```

### 5.2 자동 블록

```
예약 확정(CONFIRMED) 시:
  1. 해당 요일+시간의 Schedule 조회
  2. isBlocked = true, bookingId = {예약 ID}로 UPDATE
  3. 이미 블록된 슬롯이면 → 예약 충돌 에러

예약 취소(CANCELLED) 시:
  1. 해당 bookingId의 Schedule 조회
  2. isBlocked = false, bookingId = null로 UPDATE (블록 해제)
```

### 5.2a 스케줄 변경 요청

```
수강생이 확정된 레슨 일정 변경 요청:

1. 수강생 요청:
   POST /api/bookings/:id/reschedule
   { requestedDate: "2026-04-17", requestedTime: "T1000", reason: "개인 사정" }
   → Booking.rescheduleStatus = PENDING
   → 코치에게 변경 요청 알림

2. 시스템 자동 추천:
   코치 Schedule 테이블 조회:
     WHERE coachId = {코치ID}
       AND dayOfWeek = {희망 요일}   (또는 ±1일 범위)
       AND isBlocked = false
     ORDER BY slotTime ASC
   → 변경 가능 날짜+시간 목록 반환 (최대 5개)
   
   추천 범위:
     1순위: 수강생 희망 날짜의 동일 시간
     2순위: 수강생 희망 날짜의 다른 시간 (코치 가용)
     3순위: 희망 날짜 ±1일의 가용 시간

3. 변경 가능 여부 판정:
   자동 추천 결과에 따라 두 케이스로 분기:

   [변경 가능] 추천 슬롯 ≥ 1개:
     → 코치 화면에 초록색 "변경 가능" 카드 표시
     → 추천 날짜+시간 목록 (최대 5개) + "모두 제안하기" 버튼

   [변경 불가] 추천 슬롯 = 0개:
     → 코치 화면에 빨간색 "변경 불가" 카드 표시
     → 사유 메시지: "수강생이 희망한 날짜 근처에 변경 가능한 빈 시간이 없습니다."
     → "불가 알림 보내기" 버튼

4. 슬롯 임시 홀드 (하이브리드 정책):
   동시 다수 변경 요청에 의한 슬롯 충돌 방지:

   [홀드 생성]
     코치가 "모두 제안하기" 클릭 시:
       POST /api/bookings/:id/reschedule/propose { slotIds: [...] }
       → ScheduleHold 레코드 생성 (bookingId, slotId[], heldAt, expiresAt)
       → holdHours = CoachProfile.holdDurationHours ?? ScheduleSetting.holdDurationHours (기본 12)
       → expiresAt = heldAt + holdHours시간
       (코치별 개별 설정 우선, 없으면 전역 설정 적용)
       → 수강생에게 제안 알림 (카카오 알림톡)

   [홀드 중 다른 요청 처리]
     새로운 변경 요청의 자동 추천 시:
       WHERE isBlocked = false
         AND slotId NOT IN (SELECT slotId FROM ScheduleHold WHERE expiresAt > NOW())
       → 홀드된 슬롯은 추천 목록에서 제외
       → 남은 가용 슬롯이 0개이면 "변경 불가" 처리
         사유: "다른 변경 요청 처리 중으로 가용 시간이 없습니다."

   [수강생 응답 처리]
     수락: PUT /api/bookings/:id/reschedule/accept { selectedSlotId }
       → 기존 날짜 Schedule isBlocked=false (해제)
       → 선택된 슬롯 Schedule isBlocked=true (블록)
       → Booking 날짜/시간 업데이트
       → rescheduleStatus = ACCEPTED
       → 해당 bookingId의 ScheduleHold 전체 삭제 (나머지 홀드 해제)
       → 홀드 해제된 슬롯을 사용하는 다른 PENDING 변경 요청 자동 재추천 트리거
       → 수강생 알림: "스케줄이 변경되었습니다. {새 날짜} {새 시간}"

     거절 (수강생이 모든 제안 거절):
       PUT /api/bookings/:id/reschedule/reject-proposal
       → ScheduleHold 전체 삭제
       → rescheduleStatus = NEGOTIATING (재협의 필요)
       → 코치 알림: "수강생이 제안을 거절했습니다. 직접 조율이 필요합니다."
       → 채팅으로 유도

   [홀드 자동 만료]
     스케줄러 (CRON / 12시간 주기):
       DELETE FROM ScheduleHold WHERE expiresAt <= NOW()
       → 만료 시 코치 알림: "{수강생명}님이 12시간 내 응답하지 않았습니다."
       → rescheduleStatus 유지 (PENDING) → 코치가 재제안 또는 거절 선택

   [불가 알림 보내기]
     코치가 "불가 알림 보내기" 클릭 시:
       PUT /api/bookings/:id/reschedule/reject { reason: "UNAVAILABLE" }
       → rescheduleStatus = REJECTED
       → 기존 일정 유지
       → 수강생 알림: "변경 가능한 시간이 없어 기존 일정으로 진행됩니다."

5. 변경 완료 처리:
   수강생이 제안 수락 완료 후:
     → rescheduleStatus = COMPLETED
     → 코치 스케줄 홈에 "변경 완료" 카드로 표시 (당일까지)
     → 변경 전/후 일정 모두 표시 (확인용)
     → 다음날 00:00 이후 목록에서 자동 제거

변경 요청 정렬 규칙:
  먼저 요청한 수강생이 상단 노출 (요청일시 ASC — 선입선출)
  ORDER BY Booking.rescheduleRequestedAt ASC

  상태별 그룹 없이 순수 요청 시각순 정렬:
    → 먼저 요청한 수강생이 먼저 처리될 수 있도록 유도
    → 코치가 위에서 아래로 순서대로 처리하는 자연스러운 UX

변경 요청 제한:
  - 레슨 당일 변경 요청 불가 (D-1까지만)
  - 동일 예약에 대해 PENDING 상태 변경 요청 1건만 가능
  - 결제 건(isPaid=true)만 변경 요청 가능 (미결제는 취소 후 재신청)
  - 홀드 유효기간: 12시간 (만료 후 자동 해제)
  - 수강생 1인당 동시 홀드 가능 건수: 1건
```

### 5.3 코치 상세 → 레슨 신청 시 블록 표시

```
GET /api/coaches/:id/schedule [공개]

응답에서 isBlocked = true인 슬롯은 회색 비활성화 표시
수강생은 블록된 슬롯 선택 불가
```

### 5.4 스케줄 등록 접근 제한

```
스케줄 등록/관리 접근 시:
  GET /api/subscriptions/me → plan 확인
  plan = MONTHLY 또는 YEARLY → 접근 허용
  plan = FREE → 유료 전환 유도 Alert (PRO 플랜 필요)
```

---

## 6. 리뷰/평점 계산

### 6.1 평균 평점 계산

```
리뷰 등록 시 (POST /api/reviews):
  1. Review 테이블에 INSERT
  2. CoachProfile.averageRating 재계산:
     averageRating = SELECT AVG(rating) FROM Review WHERE coachId = {coachId}
  3. CoachProfile.reviewCount 갱신:
     reviewCount = SELECT COUNT(*) FROM Review WHERE coachId = {coachId}
```

### 6.2 리뷰 작성 조건

```
1. Booking.status = COMPLETED (레슨 완료)
2. 해당 bookingId에 Review가 없어야 함 (예약당 1개)
3. 작성자 = 해당 예약의 studentId
4. 별점: 1~5 필수
5. 텍스트: 최소 10자
```

---

## 7. 알림 발송 정책

### 7.1 알림 유형별 발송 조건

| 유형 | 발송 시점 | 수신자 | 설정 항목 |
|------|----------|--------|----------|
| BOOKING_REQUEST | 수강생이 레슨 신청 시 | 코치 | bookingAlert |
| BOOKING_CONFIRMED | 코치가 수락 시 | 수강생 | bookingAlert |
| BOOKING_REJECTED | 코치가 거절 시 | 수강생 | bookingAlert |
| BOOKING_ON_HOLD | 코치가 보류 시 | 수강생 | bookingAlert |
| BOOKING_CANCELLED | 취소 시 | 상대방 | bookingAlert |
| LESSON_REMINDER | 레슨 D-1 09:00 | 수강생 + 코치 | lessonReminder |
| RESCHEDULE_REQUEST | 수강생이 변경 요청 시 | 코치 | bookingAlert |
| RESCHEDULE_PROPOSED | 코치가 "모두 제안하기" 시 | 수강생 | bookingAlert |
| RESCHEDULE_UNAVAILABLE | 코치가 "불가 알림 보내기" 시 | 수강생 | bookingAlert |
| RESCHEDULE_ACCEPTED | 수강생이 제안 수락 시 | 코치 | bookingAlert |
| RESCHEDULE_REJECTED_BY_STUDENT | 수강생이 제안 거절 시 | 코치 | bookingAlert |
| RESCHEDULE_HOLD_EXPIRED | 홀드 12시간 만료 시 | 코치 | 항상 |
| CHAT_MESSAGE | 새 메시지 수신 시 | 상대방 | chatMessage |
| SUBSCRIPTION_RENEW | 구독 갱신 3일 전 | 코치 | 항상 (설정 무관) |
| SUBSCRIPTION_EXPIRE | 구독 만료 시 | 코치 | 항상 |
| VERIFY_APPROVED | 검증 승인 시 | 코치 | 항상 |
| VERIFY_REJECTED | 검증 반려 시 | 코치 | 항상 |

### 7.2 알림 채널

```
1순위: 카카오 알림톡 (비즈메시지 API)
2순위: 앱 내 알림 (Notification 테이블 저장)

카카오 알림톡은 NotificationSetting 해당 항목 = true일 때만 발송
앱 내 알림은 항상 저장 (설정과 무관)
```

### 7.3 카카오 알림톡 템플릿

> 별도 문서로 관리: **[alimtalk-templates.md](alimtalk-templates.md)**
> 전체 17개 템플릿 (예약 4, 레슨 2, 스케줄변경 6, 채팅 1, 구독 2, 검증 2)
> 템플릿별 문구, 변수, 버튼 동작, API 연동 스펙 포함

### 7.4 안 읽은 알림 배지

```
하단 네비 알림 아이콘 배지 숫자:
  SELECT COUNT(*) FROM Notification
  WHERE userId = {userId} AND isRead = false
```

---

## 8. 약관 버전 관리

### 8.1 약관 개정 플로우

```
어드민이 약관 개정 시:
  1. Terms 테이블에 동일 code로 새 레코드 생성 (version 증가)
  2. 기존 동일 code의 isActive = false
  3. 신규 레코드 isActive = true
```

### 8.2 재동의 요청 로직

```
사용자 로그인 시:
  1. GET /api/terms (isActive=true인 필수 약관 목록)
  2. GET /api/users/me/terms (사용자가 동의한 termsId 목록)
  3. 비교:
     필수 약관의 현재 활성 termsId ≠ 사용자 동의 termsId
     → 불일치 약관에 대해 재동의 바텀시트 표시
     → 동의 완료 시 UserTermsAgreement 갱신 (새 termsId로)
```

### 8.3 미동의 시 서비스 제한

```
필수 약관 미동의 상태:
  → 서비스 이용 차단 (재동의 바텀시트 닫기 불가)
  → 동의하지 않으면 로그아웃 처리
```

---

## 9. 인증/권한 정책

### 9.1 API 접근 구분

| 구분 | 인증 | 대상 |
|------|:----:|------|
| **공개 API** | 불필요 | 코치 검색/상세, 배너, 약관 조회 |
| **인증 필요** | JWT | 프로필 수정, 예약, 결제, 채팅, 찜 |
| **역할 제한** | JWT + role | 코치 전용 (스케줄, 프로필 등록), 어드민 전용 |

### 9.2 비로그인 허용 범위

| 기능 | 비로그인 |
|------|:--------:|
| 홈 화면 진입 | ✓ |
| 코치 검색/목록 | ✓ |
| 코치 상세 조회 | ✓ |
| 리뷰 조회 | ✓ |
| 레슨 신청 | ✗ → 로그인 유도 |
| 문의하기 (채팅) | ✗ → 로그인 유도 |
| 찜하기 | ✗ → 로그인 유도 |
| 메시지 탭 | ✗ → 로그인 유도 |

### 9.3 로그인 시 미가입 처리

```
소셜 로그인 API 응답:
  isNewUser = false → JWT 발급 → 홈
  isNewUser = true → 바텀시트 (약관은 프로필 등록에서) → 역할 선택
  isActive = false → "이용이 제한된 계정입니다" 토스트
```

### 9.4 차단 계정 정책

```
어드민이 User.isActive = false 설정 시:
  → 해당 사용자 JWT 무효화 (블랙리스트 또는 다음 요청 시 체크)
  → 로그인 시도 시 "이용이 제한된 계정입니다. 고객센터에 문의하세요" 토스트
  → 코치 차단 시: 코치 검색/목록에서 제외, 기존 예약은 유지
```

---

## 10. 캐시 정책

### 10.1 클라이언트 캐시 (TanStack Query)

| 데이터 | staleTime | 설명 |
|--------|-----------|------|
| 코치 목록 | 5분 | 검색 결과 캐시 |
| 코치 상세 | 10분 | 프로필 상세 |
| 배너 목록 | 30분 | 자주 변경되지 않음 |
| 약관 목록 | 1시간 | 거의 변경 없음 |
| 내 프로필 | 0 (항상 fresh) | 수정 즉시 반영 |
| 채팅 메시지 | 0 | WebSocket 실시간 |
| 알림 목록 | 1분 | 준실시간 |

### 10.2 서버 캐시 (Redis)

| 데이터 | TTL | 설명 |
|--------|-----|------|
| 인기 코치 (popular) | 1시간 | 인기 점수 배치 계산 결과 |
| 신규 코치 (newest) | 30분 | |
| 배너 목록 | 10분 | 어드민 변경 시 캐시 무효화 |
| 코드 관리 (specialty/goal 등) | 1시간 | 어드민 변경 시 캐시 무효화 |

---

## 11. 코치 프로필 이미지 정책

### 11.1 프로필 대표 사진

```
필수 여부: 코치 필수, 수강생 선택
파일 형식: JPG, PNG
최대 크기: 5MB
저장: S3 업로드 → URL을 User.profileImage에 저장
```

### 11.2 소개 이미지

```
필수: 최소 1장, 최대 5장
파일 형식: JPG, PNG
최대 크기: 5MB/장
저장: S3 업로드 → CoachProfileImage 테이블 (url, sortOrder)
순서 변경: 드래그 앤 드롭 → PUT /api/coaches/profile/images/reorder
삭제 제한: 마지막 1장은 삭제 불가 (최소 1장 유지)
히어로 표시: sortOrder = 0인 이미지가 코치 상세 상단에 표시
```

---

## 12. 찜(즐겨찾기) 정책

```
찜 추가: POST /api/favorites/:coachId [인증]
찜 해제: DELETE /api/favorites/:coachId [인증]
비로그인: 찜 불가 → 로그인 유도 토스트

찜 목록 정렬: createdAt DESC (최근 찜한 순)
탈퇴/비활성 코치: "활동 중지" 표시, 하단 이동, 레슨 신청 버튼 숨김
```

---

## 13. 차단 정책

```
차단하기: POST /api/users/block/:userId [인증]
차단 해제: DELETE /api/users/block/:userId [인증]

차단 시 영향:
  1. 채팅방 비활성화:
     - ChatRoom에 isBlocked=true 플래그 설정
     - 채팅 목록에서 해당 채팅방: opacity 40% + 🚫 아이콘 + "차단한 코치의 채팅방입니다" 문구
     - 비활성 채팅방은 목록 하단으로 이동
     - 메시지 전송 불가

  2. 레슨 신청 차단:
     - 해당 코치에게 레슨 신청 시 → "차단한 코치에게는 신청할 수 없습니다" 토스트

  3. 코치 프로필 접근:
     - 검색/목록에서는 표시 (차단 여부 무관)
     - 코치 상세에서 문의하기/레슨신청 버튼 비활성화

차단 해제:
  - 채팅 목록 → 차단된 채팅방 클릭 → "차단 해제" 바텀시트 → 해제 시 정상 복원
```

---

## 14. 신고 정책

### 14.1 신고 접수

```
API: POST /api/reports [인증]
Request: { targetId, targetType(USER/REVIEW), reasonCode, reasonDetail }

중복 방지:
  동일 reporterId + 동일 targetId → 24시간 이내 재신고 차단
  → "이미 신고한 사용자입니다. 검토 중입니다" 토스트

신고 접수 시:
  1. Report 테이블 INSERT (status=PENDING)
  2. 관리자에게 알림 발송 (Notification: type=REPORT_RECEIVED)
```

### 14.2 신고 사유 코드 (어드민 CRUD)

| 코드 | 라벨 |
|------|------|
| `INAPPROPRIATE_MSG` | 부적절한 메시지 |
| `FAKE_PROFILE` | 허위 프로필 |
| `SPAM` | 스팸/광고 |
| `NO_SHOW` | 레슨 불이행 |
| `FRAUD` | 사기/금전 피해 |
| `OTHER` | 기타 (상세 입력 필수) |

### 14.3 관리자 조치

```
PUT /api/admin/reports/:id/action

조치 유형:
  WARNING    — 경고: 대상에게 경고 알림 발송 (계정 제한 없음)
  SUSPEND_7D — 일시 정지: 7일간 로그인 차단 + 알림
  BAN        — 영구 차단: User.isActive=false + 알림

조치 시:
  1. Report.status = RESOLVED, resolvedAt = NOW()
  2. 대상 User에 조치 적용
  3. 신고자에게 "신고 처리 결과" 알림 발송
  4. 대상에게 "조치 안내" 알림 발송
```

### 14.4 일시 정지 처리

```
SUSPEND_7D 조치 시:
  User.suspendedUntil = NOW() + 7일
  로그인 시 suspendedUntil > NOW() → "계정이 일시 정지되었습니다. 해제일: {날짜}" 토스트
  7일 경과 후 자동 해제 (스케줄러 또는 로그인 시 체크)
```

---

## 15. 어드민 스케줄 관리 정책

### 15.1 어드민 강제 상태 변경

```
PUT /api/admin/reschedules/:id/action [인증: 어드민]
{ actionType, reason, targetSlotId? }

actionType 목록:
  FORCE_PROPOSE    — 강제 제안 (slotIds 지정) → ScheduleHold 생성 + 수강생 알림
  FORCE_ACCEPT     — 강제 수락 (targetSlotId) → 일정 확정 + 홀드 해제 + 양측 알림
  FORCE_REJECT     — 강제 거절 → REJECTED + 수강생 알림 (기존 일정 유지)
  FORCE_COMPLETE   — 강제 완료 (newDate, newTime) → 일정 변경 + COMPLETED + 양측 알림
  EXTEND_HOLD      — 홀드 연장 (+12h) → ScheduleHold.expiresAt 갱신
  RELEASE_HOLD     — 홀드 즉시 해제 → ScheduleHold 삭제 + rescheduleStatus = PENDING
  CANCEL           — 요청 취소 → rescheduleStatus = null (초기화) + 양측 알림
  ROLLBACK         — 원래 일정 복구 → COMPLETED → 이전 일정으로 복원 + 양측 알림
  FORCE_REASSIGN   — 다른 날짜 재지정 (newDate, newTime) → 일정 변경 + 양측 알림

모든 어드민 조치는:
  1. reason 필수 입력
  2. RescheduleActionLog 테이블에 이력 기록 (adminId, actionType, reason, timestamp)
  3. 정책 설정의 "어드민 강제 변경 시 양측 알림" on일 때 알림톡 발송
```

### 15.2 어드민 슬롯 직접 관리

```
PUT /api/admin/schedules/:coachId/action [인증: 어드민]
{ actionType, slotIds?, reason }

actionType 목록:
  FORCE_BLOCK      — 특정 슬롯 강제 블록 (isBlocked=true)
  FORCE_UNBLOCK    — 특정 슬롯 강제 해제 (isBlocked=false)
  RELEASE_ALL_HOLDS — 해당 코치의 모든 홀드 즉시 해제
  RESET_SCHEDULE   — 스케줄 전체 초기화 (모든 슬롯 삭제) — 확인 다이얼로그 필수

모든 조치는 RescheduleActionLog에 기록
```

### 15.3 정책 설정 (어드민 변경 가능)

```
GET/PUT /api/admin/settings/schedule [인증: 어드민]

설정 항목:
  holdDurationHours: 12        // 홀드 유효 시간 — 전역 기본값 (시간)
                               // ※ 코치별 개별 설정 가능 (CoachProfile.holdDurationHours)
                               //    개별값 존재 시 전역값보다 우선 적용
  holdExpiryNotification: true // 만료 시 코치 알림 발송 여부
  maxConcurrentHolds: 1        // 수강생 동시 홀드 제한
  rescheduleDeadlineDays: 1    // 변경 요청 가능 기한 (D-N)
  maxRecommendSlots: 5         // 자동 추천 최대 슬롯 수
  recommendRangeDays: 1        // 추천 범위 ±N일
  paidOnlyReschedule: true     // 결제 건만 변경 허용
  completedCardDays: 1         // 변경 완료 카드 노출 기간 (일)
  notifyOnRequest: true        // 변경 요청 시 코치 알림
  notifyOnUnavailable: true    // 불가 알림 시 수강생 알림
  notifyOnComplete: true       // 변경 완료 시 양측 알림
  notifyOnAdminAction: true    // 어드민 강제 변경 시 양측 알림

설정값은 ScheduleSetting 테이블에 key-value로 저장
변경 시 즉시 반영 (캐시 무효화)
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-12 | 초안 — 홈 섹션, 검색, 구독, 예약, 스케줄, 리뷰, 알림, 약관, 인증, 캐시 정책 |
| 1.1 | 2026-04-13 | 하이브리드 스케줄 변경 정책 (홀드/변경가능/불가/완료), 알림톡 템플릿 분리, 어드민 스케줄 관리 정책 추가 |
