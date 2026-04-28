# COURTSIDE — DB 테이블 정의서

> **Project**: tennis-coach-matching (COURTSIDE)
> **Version**: 1.0.0
> **Date**: 2026-04-10
> **ORM**: Prisma
> **Database**: PostgreSQL

---

## 목차

1. [사용자/인증](#1-사용자인증)
2. [코치 프로필](#2-코치-프로필)
3. [수강생 프로필](#3-수강생-프로필)
4. [예약/레슨 신청](#4-예약레슨-신청)
5. [결제](#5-결제)
6. [구독](#6-구독)
7. [리뷰](#7-리뷰)
8. [스케줄](#8-스케줄)
9. [채팅](#9-채팅)
10. [레슨 이력](#10-레슨-이력)
11. [찜(즐겨찾기)](#11-찜즐겨찾기)
12. [알림](#12-알림)
13. [배너](#13-배너)
14. [어드민 코드 관리](#14-어드민-코드-관리)
15. [약관 동의](#15-약관-동의)
16. [ERD 관계도](#16-erd-관계도)

---

## Enum 정의

```
enum Role {
  STUDENT
  COACH
  ADMIN
}

enum SocialProvider {
  KAKAO
  NAVER
  // APPLE — PWA 웹 서비스 제외, 네이티브 앱 출시 시 추가
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

enum AgeGroup {
  TEENS        // 10대
  TWENTIES     // 20대
  THIRTIES     // 30대
  FORTIES      // 40대
  FIFTIES_PLUS // 50대 이상
}

enum PriceVisibility {
  PUBLIC
  PRIVATE
}

enum LessonType {
  REGULAR  // 정규레슨
  COUPON   // 쿠폰레슨
}

enum LessonFormat {
  INDIVIDUAL  // 1:1 개인
  GROUP       // 그룹 (2~4인)
}

enum LessonDuration {
  MIN_20  // 20분 (10분 슬롯 × 2)
  MIN_30  // 30분 (10분 슬롯 × 3)
  MIN_40  // 40분 (10분 슬롯 × 4)
}

enum BookingStatus {
  PENDING
  ON_HOLD
  CONFIRMED
  COMPLETED
  CANCELLED
  REJECTED
  ABSENT
  MAKEUP_REQUESTED  // 보강 요청 — 수강생이 직접 보강 요청, 코치 수락 전
  MAKEUP_PENDING    // 보강 일정 선택중 — 코치가 보강 등록, 수강생 수락 전
  MAKEUP_CONFIRMED  // 보강확정 — 수강생이 보강 일정 수락 완료
}

enum PaymentStatus {
  PENDING           // 미결제 (스케줄 확정됐으나 결제 전)
  DEPOSIT_RECEIVED  // 예약금 수령 (코치가 현금/계좌이체로 일부 수령 확인)
  PAID              // 전액 결제 완료
  REFUNDED          // 환불
}

enum PaymentType {
  LESSON        // 레슨 결제
  SUBSCRIPTION  // 구독 결제
}

enum SubscriptionStatus {
  ACTIVE
  CANCELLED
  EXPIRED
}

enum ChatMessageType {
  TEXT
  IMAGE
  SYSTEM
}

enum NotificationType {
  BOOKING_REQUEST     // 레슨 신청
  BOOKING_CONFIRMED   // 신청 수락
  BOOKING_REJECTED    // 신청 거절
  BOOKING_CANCELLED   // 예약 취소
  LESSON_REMINDER     // D-1 리마인더
  REVIEW_REQUEST      // 리뷰 요청
  CHAT_MESSAGE        // 새 메시지
  SUBSCRIPTION_RENEW  // 구독 갱신
  SUBSCRIPTION_EXPIRE // 구독 만료 예정
  VERIFY_APPROVED     // 검증 승인
  VERIFY_REJECTED     // 검증 반려
}

enum CtaStyle {
  PRIMARY
  SECONDARY
}
```

---

## 1. 사용자/인증

### User

> FR-01, FR-01a, FR-01b, FR-12

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 사용자 고유 ID | |
| email | String | Unique, Not Null | 소셜 로그인 이메일 | FR-01 |
| name | String | Not Null | 사용자 이름 | FR-01 |
| role | Role | Not Null | 역할 (STUDENT / COACH / ADMIN) | FR-01b |
| socialProvider | SocialProvider | Not Null | 소셜 로그인 제공자 (KAKAO / NAVER) | FR-01 |
| socialId | String | Not Null | 소셜 로그인 고유 ID | FR-01 |
| profileImage | String | Not Null (코치 필수) | 프로필 대표 사진 URL (S3). 코치 가입 시 필수, 수강생은 선택 | FR-02, FR-12a-1 |
| phone | String? | Nullable | 전화번호 | |
| isActive | Boolean | Default: true | 활성 상태 (차단 시 false) | FR-14 |
| marketingConsent | Boolean | Default: false | 마케팅 수신 동의 여부 | FR-01a |
| createdAt | DateTime | Default: now() | 가입일 | |
| updatedAt | DateTime | @updatedAt | 수정일 | |

**Unique**: `@@unique([socialProvider, socialId])`
**Relations**: CoachProfile(1:1), StudentProfile(1:1), Booking(1:N), Payment(1:N), Review(1:N), ChatRoomParticipant(1:N), Notification(1:N), Favorite(1:N), UserTermsAgreement(1:N)

---

## 2. 코치 프로필

### CoachProfile

> FR-02, FR-05, FR-13

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 코치 프로필 ID | |
| userId | Int | FK → User, Unique | 사용자 FK (1:1) | |
| bio | String | Not Null | 소개 글 | FR-02 |
| gender | Gender | Not Null | 성별 | FR-02 |
| experienceYears | Int? | Nullable | 경력 (년, 선택) | FR-02 |
| lessonPrice | Int? | Nullable | 레슨 가격 (1회, 공개 시 필수) | FR-02 |
| priceVisibility | PriceVisibility | Not Null, Default: PUBLIC | 가격 공개 여부 | FR-02 |
| areaSido | String | Not Null | 레슨 지역 — 시·도 | FR-02 |
| areaSigungu | String | Not Null | 레슨 지역 — 시·군·구 | FR-02 |
| ntrpMin | Float? | Nullable | 지도 가능 NTRP 하한 | FR-02 |
| ntrpMax | Float? | Nullable | 지도 가능 NTRP 상한 | FR-02 |
| isVerified | Boolean | Default: false | 검증 배지 여부 | FR-13 |
| verifiedAt | DateTime? | Nullable | 검증 승인일 | FR-13 |
| averageRating | Float | Default: 0 | 평균 평점 (계산 필드) | FR-08 |
| reviewCount | Int | Default: 0 | 총 리뷰 수 (계산 필드) | FR-08 |
| bookingCount | Int | Default: 0 | 총 신청 수 (계산 필드) | FR-03 |
| allowRegular | Boolean | Default: true | 정규레슨 제공 가능 여부 | FR-02 |
| allowCoupon | Boolean | Default: false | 쿠폰레슨 제공 가능 여부 | FR-02 |
| couponValidWeeks | Int? | Nullable | 쿠폰레슨 유효기간 (주 단위, 예: 4). allowCoupon=true일 때 필수. 수강생 레슨 신청 시 안내 문구로 노출 | FR-02 |
| holdDurationHours | Int? | Nullable | 코치별 홀드 유효 시간 (시간). null이면 전역 설정(ScheduleSetting.holdDurationHours) 적용. 어드민이 코치 상세에서 개별 설정 | FR-14k |
| createdAt | DateTime | Default: now() | 등록일 | |
| updatedAt | DateTime | @updatedAt | 수정일 | |

**Relations**: User(1:1), CoachProfileImage(1:N), CoachSpecialtyMapping(1:N), CoachLessonType(1:N), CoachSubscription(1:N), Schedule(1:N), Booking(1:N), Review(1:N), LessonRecord(1:N)

### CoachProfileImage

> FR-02 (소개 이미지 다중 업로드 + 드래그 앤 드롭 순서 변경)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 이미지 ID | |
| coachProfileId | Int | FK → CoachProfile | 코치 프로필 FK | FR-02 |
| url | String | Not Null | S3 업로드 URL | FR-02 |
| sortOrder | Int | Not Null, Default: 0 | 노출 순서 (0부터 시작, 드래그 앤 드롭 시 재계산) | FR-02 |
| createdAt | DateTime | Default: now() | 업로드일 | |

**제약**: 코치당 최소 1장 (필수), 최대 5장
**Index**: `@@index([coachProfileId, sortOrder])` — sortOrder 순 정렬 조회
**비즈니스 규칙**: 코치 프로필 등록 시 소개 이미지 최소 1장 필수 (API에서 검증). 마지막 1장은 삭제 불가 (클라이언트 + 서버 양쪽에서 체크).

**sortOrder 규칙**:
- 0부터 시작, 연속 정수 (0, 1, 2, 3, 4)
- `sortOrder=0` 이미지가 코치 상세 페이지 히어로 영역에 표시
- 이미지 추가 시: `sortOrder = 기존 최대값 + 1` (맨 뒤에 추가)
- 드래그 앤 드롭 순서 변경 시: 클라이언트에서 변경된 순서의 ID 배열 전송 → 서버에서 배열 index를 sortOrder로 일괄 UPDATE
- 이미지 삭제 시: 삭제 후 나머지 이미지의 sortOrder를 0부터 재계산

**순서 변경 API**:
```
PUT /api/coaches/profile/images/reorder
Request:  { "imageIds": [3, 1, 2] }   ← 변경된 순서대로 ID 배열
Response: { "images": [
  { "id": 3, "sortOrder": 0 },  ← 첫 번째 = 히어로
  { "id": 1, "sortOrder": 1 },
  { "id": 2, "sortOrder": 2 }
]}
```
서버 처리: `imageIds` 배열을 순회하며 `UPDATE CoachProfileImage SET sortOrder = {index} WHERE id = {imageId} AND coachProfileId = {coachId}` 일괄 실행 (트랜잭션)

### CoachSpecialtyMapping

> FR-02 (코치 전문 분야 선택 — N:M 중간 테이블)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| coachProfileId | Int | FK → CoachProfile | 코치 FK | FR-02 |
| specialtyId | Int | FK → CoachSpecialty | 전문 분야 코드 FK | FR-14d |

**Unique**: `@@unique([coachProfileId, specialtyId])`

### CoachLessonType

> FR-02 (가능한 레슨 유형)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| coachProfileId | Int | FK → CoachProfile | 코치 FK | FR-02 |
| lessonFormat | LessonFormat | Not Null | 레슨 형태 (INDIVIDUAL / GROUP) | FR-02 |

**Unique**: `@@unique([coachProfileId, lessonFormat])`

### CoachCertification

> FR-13 (자격증 업로드)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| coachProfileId | Int | FK → CoachProfile | 코치 FK | FR-13 |
| imageUrl | String | Not Null | 자격증 이미지 URL (S3) | FR-13 |
| certName | String? | Nullable | 자격증명 | FR-13 |
| status | String | Default: 'PENDING' | 심사 상태 (PENDING / APPROVED / REJECTED) | FR-13 |
| reviewedAt | DateTime? | Nullable | 심사 처리일 | FR-14 |
| reviewedBy | Int? | FK → User (ADMIN) | 심사 관리자 | FR-14 |
| createdAt | DateTime | Default: now() | 업로드일 | |

---

## 3. 수강생 프로필

### StudentProfile

> FR-01c, FR-12a-2

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 수강생 프로필 ID | |
| userId | Int | FK → User, Unique | 사용자 FK (1:1) | |
| gender | Gender | Not Null | 성별 | FR-01c |
| ageGroup | AgeGroup | Not Null | 연령대 | FR-01c |
| ntrpLevel | String | Not Null | NTRP 레벨 (예: "1.0~2.0") | FR-01c |
| preferredAreaSido | String | Not Null | 희망 지역 — 시·도 | FR-01c |
| preferredAreaSigungu | String | Not Null | 희망 지역 — 시·군·구 | FR-01c |
| preferredLessonFormat | LessonFormat? | Nullable | 선호 레슨 형태 | FR-12a-2 |
| preferredTimeSlots | String[]? | Nullable | 선호 시간대 (오전/오후/저녁/주말) | FR-12a-2 |
| createdAt | DateTime | Default: now() | 등록일 | |
| updatedAt | DateTime | @updatedAt | 수정일 | |

**Relations**: User(1:1), StudentLessonGoalMapping(1:N)

### StudentLessonGoalMapping

> FR-01c (수강생 레슨 목표 — N:M 중간 테이블)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| studentProfileId | Int | FK → StudentProfile | 수강생 FK | FR-01c |
| lessonGoalId | Int | FK → LessonGoal | 레슨 목표 코드 FK | FR-14c |

**Unique**: `@@unique([studentProfileId, lessonGoalId])`

---

## 4. 예약/레슨 신청

### Booking

> FR-05b, FR-05c, FR-07a

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 예약 ID | |
| studentId | Int | FK → User | 수강생 FK | FR-05b |
| coachId | Int | FK → User | 코치 FK | FR-05b |
| lessonType | LessonType | Not Null | 레슨 유형 (REGULAR / COUPON) | FR-05b |
| lessonFormat | LessonFormat | Not Null | 레슨 형태 (INDIVIDUAL / GROUP) | FR-05b |
| lessonDuration | LessonDuration | Not Null, Default: MIN_30 | 레슨 시간 (MIN_20 / MIN_30 / MIN_40). 10분 슬롯 단위로 환산하여 BookingSchedule slot 점유 수 결정 | FR-05b |
| status | BookingStatus | Not Null, Default: PENDING | 예약 상태 | FR-05c |
| rejectionReason | String? | Nullable | 거절 사유 (거절 시 필수) | FR-05c |
| holdReason | String? | Nullable | 보류 사유 (보류 시 필수). 수강생에게 알림톡으로 전달 | FR-05c |
| holdAt | DateTime? | Nullable | 보류 처리 시각 | FR-05c |
| cancellationReason | String? | Nullable | 취소 사유 (취소 시 필수) | FR-05c |
| price | Int? | Nullable | 결제 금액 | FR-07a |
| paymentId | Int? | FK → Payment, Nullable | 결제 FK | FR-07a |
| isPaid | Boolean | Default: false | 결제 여부. true=결제 후 신청 (바로 CONFIRMED + 스케줄 관리 가능), false=미결제 신청 (코치 수락 대기). 실제 결제 상태는 Payment.status로 관리 | FR-05b |
| isExternal | Boolean | Default: false | 외부 수강생 여부. true=코치가 직접 등록한 외부 수강생 레슨 | FR-13a |
| externalStudentId | Int? | FK → ExternalStudent, Nullable | 외부 수강생 FK (isExternal=true일 때) | FR-13a |
| bookingType | String | Default: 'REGULAR_BOOKING' | 예약 유형 — `REGULAR_BOOKING`(일반) / `SUPPLEMENTARY`(보강) | FR-13a |
| supplementaryReason | String? | Nullable | 보강 사유 (보강일 때 선택 입력) | FR-13a |
| rescheduleStatus | String? | Nullable | 변경 요청 상태 — `PENDING`(요청중) / `PROPOSED`(제안됨) / `ACCEPTED`(수락) / `COMPLETED`(변경완료) / `REJECTED`(거절) / `NEGOTIATING`(재협의). null=변경 요청 없음 | FR-10a |
| rescheduleRequestedDate | DateTime? | Nullable | 수강생 희망 변경 날짜 | FR-10a |
| rescheduleRequestedTime | String? | Nullable | 수강생 희망 변경 시간 (HH:mm) | FR-10a |
| rescheduleRequestedAt | DateTime? | Nullable | 변경 요청 시각 (정렬용 — 선입선출) | FR-10a |
| rescheduleReason | String? | Nullable | 변경 요청 사유 | FR-10a |
| rescheduleCompletedDate | DateTime? | Nullable | 변경 확정된 새 날짜 | FR-10a |
| rescheduleCompletedTime | String? | Nullable | 변경 확정된 새 시간 (HH:mm) | FR-10a |
| createdAt | DateTime | Default: now() | 신청일 | |
| updatedAt | DateTime | @updatedAt | 수정일 | |

**Relations**: User(student), User(coach), BookingRegularDetail(1:1), BookingCouponDetail(1:1), BookingSchedule(1:N), Payment(0:1), Review(0:1), LessonRecord(0:1)

### BookingRegularDetail

> FR-05b (정규레슨 세부)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| bookingId | Int | FK → Booking, Unique | 예약 FK (1:1) | FR-05b |
| weeklyCount | Int | Not Null | 주 횟수 (1, 2, 3) | FR-05b |

### BookingCouponDetail

> FR-05b (쿠폰레슨 세부)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| bookingId | Int | FK → Booking, Unique | 예약 FK (1:1) | FR-05b |
| totalSessions | Int | Not Null | 총 횟수 (4, 8, 10) | FR-05b |
| validWeeks | Int | Not Null | 유효 기간 (4주, 6주) | FR-05b |

### BookingSchedule

> FR-05b (선택한 요일·시간)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| bookingId | Int | FK → Booking | 예약 FK | FR-05b |
| dayOfWeek | Int | Not Null | 요일 (0=일~6=토) | FR-05b |
| startTime | String | Not Null | 시작 시간 (예: "10:00") | FR-05b |

---

## 5. 결제

### Payment

> FR-07, FR-07a

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 결제 ID | |
| userId | Int | FK → User | 결제자 FK | FR-07a |
| paymentType | PaymentType | Not Null | 결제 유형 (LESSON / SUBSCRIPTION) | FR-07 |
| amount | Int | Not Null | 총 결제 금액 (원) — 계약 기준 전액 | FR-07a |
| depositAmount | Int? | Nullable | 예약금 금액 (원) — status=DEPOSIT_RECEIVED일 때 코치가 수령한 금액. 잔액 = amount - depositAmount | FR-07a |
| depositReceivedAt | DateTime? | Nullable | 예약금 수령 확인 일시 | FR-07a |
| method | String? | Nullable | 결제 수단 — `CARD`(카드/PG) / `CASH`(현금) / `TRANSFER`(계좌이체) / `OTHER`(기타) | FR-07a |
| pgTransactionId | String? | Unique, Nullable | 토스페이먼츠 거래 ID (PG 결제 시) | FR-07a |
| pgOrderId | String? | Unique, Nullable | 토스페이먼츠 주문 ID (PG 결제 시) | FR-07a |
| status | PaymentStatus | Not Null, Default: PENDING | 결제 상태 | FR-07a |
| paidAt | DateTime? | Nullable | 전액 결제 완료 일시 | FR-07a |
| refundAmount | Int? | Nullable | 환불 금액 (부분 환불 시 결제 금액과 다를 수 있음) | FR-07b |
| refundReason | String? | Nullable | 환불 사유 | FR-07b |
| refundType | String? | Nullable | 환불 유형 — `FULL`(전액) / `PARTIAL`(부분) / `COACH_FAULT`(코치 책임 전액) | FR-07b |
| refundedAt | DateTime? | Nullable | 환불 처리 일시 | FR-07b |
| createdAt | DateTime | Default: now() | 생성일 | |

---

## 6. 구독

### SubscriptionPlan

> FR-06, FR-14a (어드민 관리)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 플랜 ID | |
| name | String | Not Null | 플랜명 (어드민 입력, 예: "무료") | FR-14a |
| price | Int | Not Null | 월 가격 (원) | FR-14a |
| discountText | String? | Nullable | 할인 문구 (예: "33% 할인 — 연 ₩238,800") | FR-14a |
| isBest | Boolean | Default: false | BEST 표시 여부 | FR-14a |
| ctaText | String | Not Null | CTA 버튼 문구 | FR-14a |
| ctaStyle | CtaStyle | Not Null, Default: SECONDARY | CTA 스타일 | FR-14a |
| sortOrder | Int | Not Null, Default: 0 | 정렬 순서 | FR-14a |
| isActive | Boolean | Default: true | 활성 여부 | FR-14a |
| createdAt | DateTime | Default: now() | 등록일 | |
| updatedAt | DateTime | @updatedAt | 수정일 | |

**Relations**: SubscriptionPlanFeature(1:N), CoachSubscription(1:N)

### SubscriptionPlanFeature

> FR-06, FR-14b (플랜별 부가 기능 선택 — N:M 중간 테이블)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| planId | Int | FK → SubscriptionPlan | 플랜 FK | FR-14b |
| featureId | Int | FK → SubscriptionFeatureCode | 부가 기능 FK | FR-14b |
| enabled | Boolean | Default: true | 포함 여부 (✓/✗) | FR-14b |

**Unique**: `@@unique([planId, featureId])`

### CoachSubscription

> FR-07 (코치 구독 내역)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 구독 ID | |
| coachId | Int | FK → User | 코치 FK | FR-07 |
| planId | Int | FK → SubscriptionPlan | 구독 플랜 FK | FR-07 |
| paymentId | Int? | FK → Payment, Nullable | 결제 FK (무료는 null) | FR-07 |
| amount | Int | Not Null | 결제 금액 | FR-07 |
| startDate | DateTime | Not Null | 구독 시작일 | FR-07 |
| endDate | DateTime | Not Null | 구독 종료일 | FR-07 |
| autoRenew | Boolean | Default: true | 자동 갱신 여부 | FR-07 |
| status | SubscriptionStatus | Not Null, Default: ACTIVE | 구독 상태 | FR-07 |
| createdAt | DateTime | Default: now() | 생성일 | |

---

## 7. 리뷰

### Review

> FR-08

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 리뷰 ID | |
| bookingId | Int | FK → Booking, Unique | 예약 FK (예약당 1개) | FR-08 |
| studentId | Int | FK → User | 작성자 (수강생) FK | FR-08 |
| coachId | Int | FK → User | 대상 코치 FK | FR-08 |
| rating | Int | Not Null, Check: 1~5 | 별점 (1~5) | FR-08 |
| content | String | Not Null | 리뷰 내용 | FR-08 |
| createdAt | DateTime | Default: now() | 작성일 | |

---

## 8. 스케줄

### Schedule

> FR-10

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 스케줄 ID | |
| coachId | Int | FK → User | 코치 FK | FR-10 |
| dayOfWeek | Int? | Nullable | 요일 (0=일~6=토, 반복 시) | FR-10 |
| specificDate | DateTime? | Nullable | 특정 날짜 (단일 일정) | FR-10 |
| slotTime | String | Not Null | 레슨 가능 시:분 (예: "09:00", "09:30", "14:00") — HH:mm 형식, 10분 단위 | FR-10 |
| ~~startTime~~ | — | — | ~~삭제: 시작~종료 범위 → slotTime 개별 단위로 변경~~ | |
| ~~endTime~~ | — | — | ~~삭제~~ | |
| isRecurring | Boolean | Default: true | 반복 일정 여부 | FR-10 |
| isBlocked | Boolean | Default: false | 블록 처리 여부 (예약 시 자동) | FR-10 |
| bookingId | Int? | FK → Booking, Nullable | 연결된 예약 (자동 블록 시) | FR-10 |
| createdAt | DateTime | Default: now() | 생성일 | |
| updatedAt | DateTime | @updatedAt | 수정일 | |

### ExternalStudent

> FR-13a (코치가 직접 등록하는 외부 수강생)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| coachId | Int | FK → User, Not Null | 등록한 코치 | FR-13a |
| name | String | Not Null | 수강생 이름 | FR-13a |
| phone | String | Not Null | 연락처 (알림톡 발송용) | FR-13a |
| lessonType | LessonType | Not Null | 레슨 유형 (REGULAR / COUPON) | FR-13a |
| lessonFormat | LessonFormat | Not Null | 레슨 형태 (INDIVIDUAL / GROUP) | FR-13a |
| memo | String? | Nullable | 코치 전용 메모 | FR-13a |
| linkedUserId | Int? | FK → User, Nullable | 서비스 가입 시 자동 매칭된 회원 ID | FR-13a |
| createdAt | DateTime | Default: now() | 등록일 | |

**Relations**: User(coach, N:1), User(linkedUser, 0:1)

**정책**:
- 코치만 CRUD 가능
- phone 기준으로 서비스 가입 시 linkedUserId 자동 연결
- 연결 후에도 ExternalStudent 레코드 유지 (이력 보존)

### ScheduleHold

> FR-10a (스케줄 변경 시 슬롯 임시 홀드)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 홀드 ID | |
| bookingId | Int | FK → Booking, Not Null | 변경 요청 대상 예약 | FR-10a |
| scheduleId | Int | FK → Schedule, Not Null | 임시 홀드된 슬롯 | FR-10a |
| coachId | Int | FK → User, Not Null | 코치 FK (조회 최적화) | FR-10a |
| heldAt | DateTime | Default: now() | 홀드 시작 시각 | FR-10a |
| expiresAt | DateTime | Not Null | 홀드 만료 시각 (heldAt + 12시간) | FR-10a |
| createdAt | DateTime | Default: now() | 생성일 | |

**Relations**: Booking(N:1), Schedule(N:1), User(coach, N:1)

**인덱스**: `idx_hold_expires` (expiresAt) — 만료 스케줄러 조회용, `idx_hold_coach` (coachId, expiresAt) — 코치별 홀드 조회용

**정책**:
- 코치가 "모두 제안하기" 클릭 시 추천 슬롯별 ScheduleHold 레코드 생성
- 수강생 수락/거절/만료 시 해당 bookingId의 ScheduleHold 전체 삭제
- 다른 변경 요청의 자동 추천 시 유효한 ScheduleHold 슬롯은 제외
- 홀드 만료 (12시간): CRON 스케줄러가 expiresAt ≤ NOW() 레코드 삭제 + 코치 알림

---

## 9. 채팅

### ChatRoom

> FR-05a

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 채팅방 ID | |
| createdAt | DateTime | Default: now() | 생성일 | |
| updatedAt | DateTime | @updatedAt | 마지막 활동 | |

**Relations**: ChatRoomParticipant(1:N), ChatMessage(1:N)

### ChatRoomParticipant

> FR-05a (채팅방 참여자)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| chatRoomId | Int | FK → ChatRoom | 채팅방 FK | FR-05a |
| userId | Int | FK → User | 참여자 FK | FR-05a |
| lastReadAt | DateTime? | Nullable | 마지막 읽은 시각 | FR-05a |

**Unique**: `@@unique([chatRoomId, userId])`

### ChatMessage

> FR-05a

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 메시지 ID | |
| chatRoomId | Int | FK → ChatRoom | 채팅방 FK | FR-05a |
| senderId | Int | FK → User | 발신자 FK | FR-05a |
| content | String | Not Null | 메시지 내용 | FR-05a |
| type | ChatMessageType | Default: TEXT | 메시지 유형 | FR-05a |
| sentAt | DateTime | Default: now() | 발송 시각 | |

**Index**: `@@index([chatRoomId, sentAt])`

---

## 10. 레슨 이력

### LessonRecord

> FR-11

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 이력 ID | |
| bookingId | Int | FK → Booking | 예약 FK | FR-11 |
| coachId | Int | FK → User | 코치 FK | FR-11 |
| studentId | Int | FK → User | 수강생 FK | FR-11 |
| coachNote | String? | Nullable | 코치 메모 | FR-11 |
| studentMemo | String? | Nullable | 수강생 기록 | FR-11 |
| lessonDate | DateTime | Not Null | 레슨 날짜 | FR-11 |
| createdAt | DateTime | Default: now() | 작성일 | |
| updatedAt | DateTime | @updatedAt | 수정일 | |

---

## 11. 찜(즐겨찾기)

### Favorite

> FR-12a-3

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| studentId | Int | FK → User | 수강생 FK | FR-12a-3 |
| coachId | Int | FK → User | 코치 FK | FR-12a-3 |
| createdAt | DateTime | Default: now() | 찜한 일시 | |

**Unique**: `@@unique([studentId, coachId])`

---

## 12. 알림

### Notification

> FR-09

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 알림 ID | |
| userId | Int | FK → User | 수신자 FK | FR-09 |
| type | NotificationType | Not Null | 알림 유형 | FR-09 |
| title | String | Not Null | 알림 제목 | FR-09 |
| content | String | Not Null | 알림 내용 | FR-09 |
| link | String? | Nullable | 이동 URL | FR-09 |
| isRead | Boolean | Default: false | 읽음 여부 | FR-09 |
| readAt | DateTime? | Nullable | 읽은 시각 | FR-09 |
| createdAt | DateTime | Default: now() | 생성일 | |

**Index**: `@@index([userId, isRead, createdAt])`

### NotificationSetting

> FR-12a (알림 설정)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| userId | Int | FK → User, Unique | 사용자 FK (1:1) | FR-12a |
| bookingAlert | Boolean | Default: true | 레슨 신청 알림 | FR-09 |
| lessonReminder | Boolean | Default: true | D-1 레슨 리마인더 | FR-09 |
| chatMessage | Boolean | Default: true | 채팅 메시지 알림 | FR-09 |
| reviewRequest | Boolean | Default: false | 리뷰 요청 알림 | FR-08 |
| marketing | Boolean | Default: false | 마케팅 알림 | FR-01a |
| updatedAt | DateTime | @updatedAt | 수정일 | |

---

## 13. 배너

### Banner

> FR-03, FR-14

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 배너 ID | |
| title | String | Not Null | 배너 제목 | FR-14 |
| imageUrl | String | Not Null | 배너 이미지 URL (S3) | FR-14 |
| linkUrl | String? | Nullable | 클릭 시 이동 URL | FR-14 |
| isActive | Boolean | Default: true | 활성 여부 | FR-14 |
| displayOrder | Int | Not Null, Default: 0 | 노출 순서 | FR-14 |
| startDate | DateTime? | Nullable | 노출 시작일 | FR-14 |
| endDate | DateTime? | Nullable | 노출 종료일 | FR-14 |
| clickCount | Int | Default: 0 | 클릭 수 | FR-14 |
| createdAt | DateTime | Default: now() | 등록일 | |
| updatedAt | DateTime | @updatedAt | 수정일 | |

---

## 14. 어드민 코드 관리

### SubscriptionFeatureCode

> FR-14b

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| code | String | Unique, Not Null | 고유 코드 (예: PROFILE_EXPOSURE) | FR-14b |
| label | String | Not Null | 노출 라벨 (예: "프로필 기본 노출") | FR-14b |
| isActive | Boolean | Default: true | 활성 여부 | FR-14b |
| sortOrder | Int | Not Null, Default: 0 | 정렬 순서 | FR-14b |
| createdAt | DateTime | Default: now() | 등록일 | |
| updatedAt | DateTime | @updatedAt | 수정일 | |

**기본 데이터**: PROFILE_EXPOSURE, SEARCH_PRIORITY, REQUEST_LIMIT, REQUEST_UNLIMITED, STATS_DASHBOARD, PRO_BADGE, ANNUAL_BADGE, VERIFY_PRIORITY

### LessonGoal

> FR-14c

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| code | String | Unique, Not Null | 고유 코드 (예: FOREHAND) | FR-14c |
| label | String | Not Null | 노출 라벨 (예: "포핸드 교정") | FR-14c |
| isActive | Boolean | Default: true | 활성 여부 | FR-14c |
| sortOrder | Int | Not Null, Default: 0 | 정렬 순서 | FR-14c |
| createdAt | DateTime | Default: now() | 등록일 | |
| updatedAt | DateTime | @updatedAt | 수정일 | |

**기본 데이터**: FOREHAND, SERVE, FITNESS, STRATEGY, DIET, HOBBY, BACKHAND, FOOTWORK, DOUBLES, MENTAL

### CoachSpecialty

> FR-14d

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| code | String | Unique, Not Null | 고유 코드 (예: FOREHAND) | FR-14d |
| label | String | Not Null | 노출 라벨 (예: "포핸드") | FR-14d |
| isActive | Boolean | Default: true | 활성 여부 | FR-14d |
| sortOrder | Int | Not Null, Default: 0 | 정렬 순서 | FR-14d |
| createdAt | DateTime | Default: now() | 등록일 | |
| updatedAt | DateTime | @updatedAt | 수정일 | |

**기본 데이터**: FOREHAND, BACKHAND, SERVE, VOLLEY, FOOTWORK, DOUBLES, STRATEGY, MENTAL, FITNESS, BEGINNER, KIDS

---

## 15. 약관 관리

### Terms

> FR-14f (어드민 약관 관리)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 약관 ID | |
| code | String | Unique, Not Null | 약관 코드 (예: TERMS_OF_SERVICE, PRIVACY_POLICY, MARKETING) | FR-14f |
| title | String | Not Null | 약관 제목 (예: "이용약관") | FR-14f |
| content | Text | Not Null | 약관 본문 (HTML/마크다운) | FR-14f |
| version | String | Not Null | 버전 (예: "1.0", "1.1") | FR-14f |
| isRequired | Boolean | Not Null | 필수 동의 여부 (true=필수, false=선택) | FR-14f |
| isActive | Boolean | Default: true | 현재 활성 버전 여부 | FR-14f |
| sortOrder | Int | Not Null, Default: 0 | 노출 순서 | FR-14f |
| effectiveDate | DateTime | Not Null | 시행일 | FR-14f |
| createdAt | DateTime | Default: now() | 등록일 | |
| updatedAt | DateTime | @updatedAt | 수정일 | |

**Index**: `@@index([code, isActive])` — 코드별 활성 버전 조회
**제약**: 동일 code에 isActive=true는 최대 1건 (비즈니스 로직으로 관리)

**기본 데이터**:
| code | title | isRequired | version |
|------|-------|:----------:|---------|
| TERMS_OF_SERVICE | 이용약관 | true | 1.0 |
| PRIVACY_POLICY | 개인정보 처리방침 | true | 1.0 |
| MARKETING | 마케팅 정보 수신 동의 | false | 1.0 |
| REFUND_POLICY | 결제취소 및 환불정책 | false (동의 불필요, 열람용) | 1.0 |

### UserTermsAgreement

> FR-01a (사용자 약관 동의 이력)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| userId | Int | FK → User | 사용자 FK | FR-01a |
| termsId | Int | FK → Terms | 약관 FK (버전 포함) | FR-14f |
| agreed | Boolean | Not Null | 동의 여부 | FR-01a |
| agreedAt | DateTime | Default: now() | 동의 일시 | |

**Unique**: `@@unique([userId, termsId])`
**Relations**: User(N:1), Terms(N:1)

**약관 버전 관리 로직**:
- 약관 개정 시 → 새 Terms 레코드 생성 (version 증가) → 기존 isActive=false, 신규 isActive=true
- 사용자 로그인 시 → 동의한 약관 version과 현재 활성 version 비교 → 불일치 시 재동의 요청

---

## 16. 신고

### Report

> FR-14h, FR-14i (사용자 신고 + 관리자 조치)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 신고 ID | |
| reporterId | Int | FK → User | 신고자 FK | FR-14h |
| targetId | Int | FK → User | 신고 대상 FK | FR-14h |
| targetType | String | Not Null | 신고 대상 유형 — `USER` / `REVIEW` | FR-14h |
| reasonId | Int | FK → ReportReasonCode | 신고 사유 코드 FK | FR-14h |
| reasonDetail | String? | Nullable | 상세 내용 (기타 선택 시 필수) | FR-14h |
| status | String | Not Null, Default: 'PENDING' | 상태 — `PENDING`(대기) / `REVIEWED`(검토중) / `RESOLVED`(완료) | FR-14i |
| actionType | String? | Nullable | 조치 유형 — `WARNING` / `SUSPEND_7D` / `BAN` | FR-14i |
| adminNote | String? | Nullable | 관리자 메모 | FR-14i |
| resolvedAt | DateTime? | Nullable | 조치 처리 일시 | FR-14i |
| resolvedBy | Int? | FK → User (ADMIN) | 조치 처리 관리자 | FR-14i |
| createdAt | DateTime | Default: now() | 신고 접수 일시 | |

**Unique**: 동일 reporterId + targetId → 24시간 이내 중복 방지 (비즈니스 로직으로 처리)
**Index**: `@@index([status, createdAt])` — 대기 신고 목록 조회

### ReportReasonCode

> FR-14j (어드민 신고 사유 코드 관리)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| code | String | Unique, Not Null | 고유 코드 (예: INAPPROPRIATE_MSG) | FR-14j |
| label | String | Not Null | 노출 라벨 (예: "부적절한 메시지") | FR-14j |
| isActive | Boolean | Default: true | 활성 여부 | FR-14j |
| sortOrder | Int | Not Null, Default: 0 | 정렬 순서 | FR-14j |
| createdAt | DateTime | Default: now() | 등록일 | |
| updatedAt | DateTime | @updatedAt | 수정일 | |

**기본 데이터**: INAPPROPRIATE_MSG, FAKE_PROFILE, SPAM, NO_SHOW, FRAUD, OTHER

---

## 17. ERD 관계도

```
User ──1:1── CoachProfile ──1:N── CoachProfileImage
  │              │──1:N── CoachSpecialtyMapping ──N:1── CoachSpecialty (어드민)
  │              │──1:N── CoachLessonType
  │              │──1:N── CoachCertification
  │              └──1:N── Schedule
  │
  ├──1:1── StudentProfile ──1:N── StudentLessonGoalMapping ──N:1── LessonGoal (어드민)
  │
  ├──1:N── Booking ──1:1── BookingRegularDetail
  │           │──1:1── BookingCouponDetail
  │           │──1:N── BookingSchedule
  │           │──0:1── Payment
  │           │──0:1── Review
  │           └──0:1── LessonRecord
  │
  ├──1:N── CoachSubscription ──N:1── SubscriptionPlan ──1:N── SubscriptionPlanFeature
  │                                                              └──N:1── SubscriptionFeatureCode (어드민)
  ├──1:N── Payment
  ├──1:N── Favorite
  ├──1:N── Notification
  ├──1:1── NotificationSetting
  ├──1:N── UserTermsAgreement ──N:1── Terms (어드민 약관 관리)
  └──1:N── ChatRoomParticipant ──N:1── ChatRoom ──1:N── ChatMessage

Banner (독립)
Terms (어드민 약관 관리, 독립)
Report ──N:1── ReportReasonCode (어드민 신고 사유)
  ├── reporterId ──N:1── User
  └── targetId ──N:1── User

RescheduleActionLog ──N:1── Booking (변경 요청 이력)
  └── adminId ──N:1── User (어드민)
ScheduleSetting (어드민 정책 설정, 독립)
```

### RescheduleActionLog

> FR-14k (어드민 스케줄 변경 이력)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | 이력 ID | |
| bookingId | Int? | FK → Booking, Nullable | 대상 예약 (슬롯 직접 관리 시 null) | FR-14k |
| coachId | Int | FK → User, Not Null | 대상 코치 | FR-14k |
| actionType | String | Not Null | 조치 유형 (FORCE_PROPOSE / FORCE_ACCEPT / FORCE_REJECT / FORCE_COMPLETE / EXTEND_HOLD / RELEASE_HOLD / CANCEL / ROLLBACK / FORCE_REASSIGN / FORCE_BLOCK / FORCE_UNBLOCK / RELEASE_ALL_HOLDS / RESET_SCHEDULE) | FR-14k |
| performedBy | String | Not Null | 처리자 유형 (STUDENT / COACH / SYSTEM / ADMIN) | FR-14k |
| adminId | Int? | FK → User, Nullable | 어드민 조치 시 관리자 ID | FR-14k |
| reason | String? | Nullable | 조치 사유 (어드민 필수) | FR-14k |
| beforeDate | DateTime? | Nullable | 변경 전 날짜 | FR-14k |
| beforeTime | String? | Nullable | 변경 전 시간 | FR-14k |
| afterDate | DateTime? | Nullable | 변경 후 날짜 | FR-14k |
| afterTime | String? | Nullable | 변경 후 시간 | FR-14k |
| createdAt | DateTime | Default: now() | 이력 생성일 | |

**Relations**: Booking(N:1), User(coach, N:1), User(admin, N:1)

**인덱스**: `idx_log_coach` (coachId, createdAt DESC) — 코치별 이력 조회, `idx_log_booking` (bookingId) — 예약별 이력

### ScheduleSetting

> FR-14k (어드민 스케줄 정책 설정)

| Column | Type | Constraints | Description | FR |
|--------|------|-------------|-------------|-----|
| id | Int | PK, Auto Increment | PK | |
| settingKey | String | Unique, Not Null | 설정 키 (holdDurationHours, maxConcurrentHolds 등) | FR-14k |
| settingValue | String | Not Null | 설정 값 (문자열 저장, 타입 변환은 서버) | FR-14k |
| updatedBy | Int? | FK → User, Nullable | 마지막 변경 어드민 | FR-14k |
| updatedAt | DateTime | @updatedAt | 수정일 | |

**기본값**: holdDurationHours=12, holdExpiryNotification=true, maxConcurrentHolds=1, rescheduleDeadlineDays=1, maxRecommendSlots=5, recommendRangeDays=1, paidOnlyReschedule=true, completedCardDays=1, notifyOnRequest=true, notifyOnUnavailable=true, notifyOnComplete=true, notifyOnAdminAction=true

---

## 테이블 수 요약

| 분류 | 테이블 | 수 |
|------|--------|----|
| 사용자 | User | 1 |
| 코치 | CoachProfile, CoachProfileImage, CoachSpecialtyMapping, CoachLessonType, CoachCertification | 5 |
| 수강생 | StudentProfile, StudentLessonGoalMapping | 2 |
| 예약 | Booking, BookingRegularDetail, BookingCouponDetail, BookingSchedule | 4 |
| 결제 | Payment | 1 |
| 구독 | SubscriptionPlan, SubscriptionPlanFeature, CoachSubscription | 3 |
| 리뷰 | Review | 1 |
| 스케줄 | Schedule, ScheduleHold | 2 |
| 채팅 | ChatRoom, ChatRoomParticipant, ChatMessage | 3 |
| 레슨이력 | LessonRecord | 1 |
| 찜 | Favorite | 1 |
| 알림 | Notification, NotificationSetting | 2 |
| 배너 | Banner | 1 |
| 코드관리 | SubscriptionFeatureCode, LessonGoal, CoachSpecialty | 3 |
| 약관 | Terms, UserTermsAgreement | 2 |
| 신고 | Report, ReportReasonCode | 2 |
| 외부수강생 | ExternalStudent | 1 |
| 어드민 | RescheduleActionLog, ScheduleSetting | 2 |
| **합계** | | **38** |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-10 | 요구사항 정의서(FR-01~FR-14e) 기반 초안 작성 — 31개 테이블 |
| 1.1 | 2026-04-10 | Terms(약관 마스터) 테이블 추가, UserTermsAgreement에 termsId FK 추가 — 32개 테이블 |
| 1.2 | 2026-04-13 | ScheduleHold 테이블 추가 (슬롯 임시 홀드), Booking.rescheduleStatus에 PROPOSED/NEGOTIATING/COMPLETED 상태 추가 — 35개 테이블 |
| 1.3 | 2026-04-13 | RescheduleActionLog, ScheduleSetting 테이블 추가 (어드민 스케줄 관리) — 37개 테이블 |
| 1.4 | 2026-04-17 | ExternalStudent 테이블 추가 + Booking에 isExternal/externalStudentId/bookingType/supplementaryReason 컬럼 추가 — 38개 테이블 |
