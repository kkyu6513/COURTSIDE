# COURTSIDE — 테니스 코치 매칭 서비스 Planning Document

> **Summary**: 테니스 학생과 코치를 연결하는 O2O 매칭 + 관리 SaaS 플랫폼 — 학생은 무료로 코치를 탐색·신청하고, 코치는 구독 플랜(무료/월간/연간)으로 차별화된 서비스를 이용
>
> **Project**: tennis-coach-matching (COURTSIDE)
> **Version**: 1.0.0
> **Author**: User
> **Date**: 2026-04-09
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 테니스를 배우고 싶은 사람이 신뢰할 수 있는 코치를 찾는 과정이 비효율적이며, 코치는 수강생을 체계적으로 모집할 채널이 없다 |
| **Solution** | 학생은 무료로 코치를 탐색·레슨 신청하고, 코치는 구독 플랜(무료/월간/연간)으로 차별화된 노출·기능을 이용하는 B2B SaaS 모델 플랫폼 |
| **Function/UX Effect** | 학생은 결제 없이 간편하게 레슨을 신청하고, 코치는 구독 등급에 따라 프로필 노출 우선순위·신청 수신 한도·통계 등 기능이 달라진다 |
| **Core Value** | 학생 유입 장벽을 낮추고, 코치 구독 수익으로 지속 가능한 비즈니스 모델을 구축한다 |

---

## Context Anchor

> Auto-generated from Executive Summary. Propagated to Design/Do documents for context continuity.

| Key | Value |
|-----|-------|
| **WHY** | 테니스 코치-학생 간 정보 비대칭 해소; 코치 구독 모델로 지속 가능한 수익 창출 |
| **WHO** | 학생(무료 탐색·신청), 테니스 코치(구독 결제 주체·플랫폼 핵심 고객), 관리자(코치 검증·운영) |
| **RISK** | 초기 코치 공급 부족; 유료 플랜 전환율 낮을 경우 수익성 확보 어려움; 직거래 이탈 |
| **SUCCESS** | 코어 MVP 배포, 코치 50명 온보딩, 레슨 신청 플로우 E2E 동작, 구독 결제 플로우 동작, 첫 예약 전환율 30% 이상 |
| **SCOPE** | Phase 1: 기반 구축 (온보딩·검색·예약·결제) / Phase 2: 리텐션 장치 (리뷰·스케줄·채팅·이력) / Phase 3: 런칭·검증 (관리자·QA·소프트 런칭) |

---

## 1. Overview

### 1.1 Purpose

학생은 결제 없이 코치를 탐색하고 레슨을 신청할 수 있다.
코치는 구독 플랜(무료/월간/연간)을 선택하여 플랫폼 노출·기능·신청 수신 한도 등 차별화된 서비스를 이용한다.
플랫폼의 핵심 수익원은 코치 구독 요금이다.

### 1.2 Background

국내 테니스 인구는 빠르게 증가하고 있으나 코치를 찾는 방법은 지인 소개·SNS·카페 등 비구조적 채널에 의존한다.
O2O(Online-to-Offline) 매칭 플랫폼을 통해 양측의 거래 비용을 줄이고 신뢰를 높인다.

### 1.3 Related Documents

- 참고: 야놀자, 숨고, Bark.com (코치 매칭 레퍼런스)

---

## 2. Scope

### 2.1 In Scope (코어 MVP)

- [x] 회원가입 / 로그인 (카카오·네이버 소셜 로그인, 학생 / 코치 / 관리자 역할 구분)
- [x] 코치 프로필 등록 (경력, 전문 분야, 자격증, 레슨 가격 안내, 위치)
- [x] 코치 탐색 (검색·필터: 위치, 수준, 가격대, 평점)
- [x] 매칭 알고리즘 (수준·위치·스케줄 기반 추천)
- [x] 레슨 신청 시스템 (학생 → 코치 신청, 코치 수락/거절) — 플랫폼 내 결제 없음
- [x] 레슨 예약 + 결제 (토스페이먼츠 PG 연동)
- [x] 코치 구독 플랜 (무료 / 월간 / 연간) + 플랜별 기능 차등
- [x] 코치 구독 결제 (토스페이먼츠 — 코치만 결제)
- [x] 리뷰 & 평점 (레슨 완료 후 학생이 작성)
- [x] 기본 알림 (카카오 알림톡 — 신청·수락·거절·리마인더)
- [x] 1:1 채팅 (Socket.io 기반 실시간 채팅)
- [x] 코치 스케줄 관리 (가용 시간 캘린더)
- [x] 레슨 이력 관리 (코치 메모, 수강생 기록)
- [x] 코치 검증 배지 (자격증 업로드 → 관리자 심사)
- [x] 관리자 페이지 (코치 승인/차단, 회원 관리)
- [x] PWA (모바일 퍼스트 반응형 웹)

### 2.2 Out of Scope

- 네이티브 모바일 앱 (iOS / Android) — MVP 이후 검토
- 영상 레슨 / 화상 코칭 기능
- 코치 간 커뮤니티 포럼
- 고급 분석 대시보드 (코치 수익 리포트 등)
- 다국어 지원

---

## 3. Technology Stack

| 구분 | 선택 | 비고 |
|------|------|------|
| **Frontend** | Next.js 14 (App Router) + TypeScript | SSR/SEO 대응, 모바일 퍼스트 반응형 웹 (PWA) |
| **Backend** | Node.js + NestJS + TypeScript | 타입 안전성, 모듈 구조, 1인 개발 생산성 |
| **Database** | PostgreSQL + Prisma ORM | 관계형 데이터(예약·결제·리뷰), 타입 자동 생성 |
| **Cache** | Redis | 세션, 실시간 스케줄 블록 처리 |
| **인증** | NextAuth.js / Passport.js | 카카오·네이버 소셜 로그인 (PWA 웹 서비스, 애플 제외) |
| **결제** | 토스페이먼츠 SDK | 국내 PG 점유율 1위, 개인사업자 가맹 용이 |
| **알림** | 카카오 알림톡 (비즈메시지 API) | 예약 확정·변경·결강·리마인더·결제 알림. 앱 설치 없이 카카오톡으로 수신 |
| **채팅** | Socket.io 또는 Firebase Realtime DB | 실시간 1:1 채팅 |
| **파일 저장** | AWS S3 / Cloudflare R2 | 코치 프로필 사진, 자격증 이미지 |
| **상태 관리** | Zustand | 경량, 보일러플레이트 최소 |
| **API Client** | TanStack Query | 캐싱·동기화·낙관적 업데이트 |
| **폼** | react-hook-form + zod | 성능, 타입 안전 유효성 검사 |
| **스타일링** | Tailwind CSS | 빠른 UI 개발 |
| **테스트** | Vitest + Playwright | 속도, E2E 커버리지 |
| **배포** | Vercel (Web) + AWS EC2/RDS 또는 Railway (API) | CI/CD 자동화, 프리뷰 배포 |
| **모니터링** | Sentry + Vercel Analytics | 에러 트래킹, 성능 모니터링 |

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    클라이언트                          │
│       ┌──────────────────┐       ┌──────────────┐    │
│       │  Next.js Web PWA │       │  Admin Web   │    │
│       │ (수강생/코치/모바일) │       │  (관리자)     │    │
│       └────────┬─────────┘       └──────┬───────┘    │
└────────────────┼────────────────────────┼────────────┘
                 │                        │
                 ▼                        ▼
┌─────────────────────────────────────────────────────┐
│                   API Gateway                        │
│              NestJS REST API + Socket.io              │
├──────────┬──────────┬──────────┬────────────────────┤
│  Auth    │ Booking  │ Payment  │  Notification       │
│  Module  │ Module   │ Module   │  Module             │
├──────────┴──────────┴──────────┴────────────────────┤
│                  Prisma ORM                          │
├─────────────────┬───────────────────────────────────┤
│   PostgreSQL    │        Redis (Cache/Session)       │
└─────────────────┴───────────────────────────────────┘
          │                         │
    ┌─────┴─────┐    ┌──────┴──────┐    ┌─────────────┐
    │  AWS S3   │    │ 토스페이먼츠  │    │ 카카오 알림톡 │
    │ (이미지)   │    │  (결제 PG)   │    │ (비즈메시지)  │
    └───────────┘    └─────────────┘    └─────────────┘
```

---

## 5. Database Models

```
User
├── id, email, name, role (STUDENT | COACH | ADMIN)
├── socialProvider, socialId
├── profileImage, phone
└── createdAt, updatedAt

CoachProfile (1:1 → User)
├── id, userId
├── bio, specialties[], certifications[]
├── lessonPrice, lessonTypes[], priceVisibility (PUBLIC | PRIVATE)
├── availableAreas[], experienceYears
├── gender, ntrpLevel
├── isVerified, verifiedAt
├── subscriptionPlan (FREE | MONTHLY | YEARLY), subscriptionExpiresAt
└── averageRating, reviewCount

StudentProfile (1:1 → User)
├── id, userId
├── gender, ageGroup
├── ntrpLevel, lessonGoals[]
├── preferredAreas[], preferredLessonType (INDIVIDUAL | GROUP)
├── preferredTimeSlots[]
└── createdAt, updatedAt

Booking
├── id, studentId, coachId
├── lessonType (REGULAR | COUPON)
├── regularDetail: { weeklyCount, lessonFormat, selectedDays[], selectedTimes[] }
├── couponDetail: { totalSessions, validWeeks, lessonFormat, selectedDays[], selectedTimes[] }
├── status (PENDING | CONFIRMED | COMPLETED | CANCELLED | REJECTED)
├── rejectionReason, cancellationReason
├── price, paymentId
└── createdAt, updatedAt

Payment
├── id, bookingId, userId
├── amount, method, pgTransactionId
├── status (PENDING | PAID | REFUNDED)
└── paidAt, refundedAt

CoachSubscription
├── id, coachId
├── plan (FREE | MONTHLY | YEARLY)
├── paymentId, amount
├── startDate, endDate, autoRenew
└── status (ACTIVE | CANCELLED | EXPIRED)

Review
├── id, bookingId, studentId, coachId
├── rating (1~5), content
└── createdAt

Schedule (코치 가용 시간)
├── id, coachId
├── dayOfWeek, startTime, endTime
├── isRecurring, specificDate
└── isBlocked

ChatRoom / ChatMessage
├── roomId, participants[]
├── messageId, senderId, content, type
└── sentAt, readAt

LessonRecord (레슨 이력)
├── id, bookingId, coachId, studentId
├── coachNote, studentMemo
└── createdAt

Favorite (찜한 코치)
├── id, studentId, coachId
└── createdAt

Notification
├── id, userId, type
├── title, content, link
├── isRead, readAt
└── createdAt

Banner (홈 동적 배너)
├── id, title, imageUrl, linkUrl
├── isActive, displayOrder
└── startDate, endDate
```

---

## 6. Requirements

### 6.1 Functional Requirements

| ID | Group | Requirement | Priority | Status |
|----|-------|-------------|----------|--------|
| FR-01 | 인증·로그인 | **로그인 화면**: 카카오·네이버 소셜 로그인 버튼 (2종) + 하단 "아직 계정이 없으신가요? 회원가입하기" 링크. **소셜 로그인 후 응답 분기**: ① 기존 회원(isNewUser=false) → JWT 발급 → 홈 화면 이동 ② **미가입 사용자(isNewUser=true) → 바텀시트로 약관 동의 UI 표시 (소셜 프로필 정보 + 약관 동의) → 동의 후 자동 가입 → 역할 선택(FR-01b)으로 이동** (소셜 인증을 2번 하지 않고, 로그인 화면에서 바로 가입 전환) ③ 차단 계정 → 에러 토스트. ※ 애플 로그인은 PWA 웹 서비스이므로 제외 (네이티브 앱 출시 시 추가 검토) | High | Pending |
| FR-01a | 인증·회원가입 | **회원가입 화면**: 뒤로가기(← 로그인) + 카카오·네이버 소셜 회원가입 버튼 (2종); 약관 동의는 이 화면에서 받지 않고 **프로필 등록 화면(FR-01c / FR-02)에서 입력받음**; **약관 동의** 영역 (전체 동의 / [필수] 이용약관 / [필수] 개인정보 처리방침 / [선택] 마케팅 수신); 하단 "이미 계정이 있으신가요? 로그인" 링크; 가입 완료 시 역할 선택(FR-01b) 화면으로 이동 | High | Pending |
| FR-01b | 인증·회원가입 | **역할 선택**: 회원가입 후 수강생/코치 역할 선택; 수강생 선택 시 학생 프로필 등록(FR-01c)으로 이동, 코치 선택 시 구독 플랜 선택(FR-06)으로 이동 | High | Pending |
| FR-01c | 인증·회원가입 | **학생 프로필 등록**: 성별, 연령대, NTRP 레벨 (툴팁으로 NTRP 설명 제공), 레슨 희망 지역 (시·도 → 시·군·구 2단계, **대한민국 17개 시·도 전체 + 해당 시·군·구 연동**), **레슨 목표 (다중 선택, 어드민 관리 항목 — `LessonGoal` 테이블에서 CRUD)**; **약관 동의 영역** (전체 동의 / [필수] 이용약관 / [필수] 개인정보 처리방침 / [선택] 마케팅 수신) — 필수 약관 미동의 시 "완료" 버튼 비활성화 | High | Pending |
| FR-01d | 인증·회원가입 | **수강생 가입 완료 화면**: 학생 프로필 등록 완료 후 "수강생 회원가입이 완료되었습니다!" 축하 화면 표시; 가입 정보 요약 (역할·NTRP·희망 지역) + **"가입 정보는 마이페이지 > 나의 테니스 정보에서 언제든지 수정할 수 있어요" 안내 문구**; "코치 둘러보기" CTA 버튼 → **코치 목록 페이지(FR-03b)로 이동** + "홈으로 이동" 버튼 → **홈 화면(FR-03)으로 이동**; 스텝 인디케이터 3/3 완료 상태 | High | Pending |
| FR-02 | 인증·회원가입 | **코치 프로필 등록**: 회원가입 → 구독 플랜 선택 → 프로필 등록 순서 (스텝 인디케이터 3/3). **[필수]** 이름, 성별, 소개, 전문 분야 (다중 on/off 토글, **어드민 코드 관리 — `CoachSpecialty` 테이블 CRUD, code/label/isActive/sortOrder, isActive=true 항목만 노출**), 가격 공개 여부 (공개/비공개), **레슨 가격 (조건부 필수: 공개 시 필수, 비공개 시 선택 — 비공개 선택 시 입력 비활성화 + "가격 문의" 표시)**, 레슨 지역 (**대한민국 17개 시·도 전체 + 시·군·구 연동**), 가능한 레슨 형태 (1:1 개인/그룹), **레슨 방식** (정규레슨/쿠폰레슨, 다중 선택 — 쿠폰레슨 선택 시 **유효기간 선택**: 2주/3주/4주/6주/8주, 수강생에게 안내 문구로 노출), **약관 동의** (전체 동의 / [필수] 이용약관 / [필수] 개인정보 처리방침 / [선택] 마케팅 수신 — 필수 약관 미동의 시 "프로필 등록 완료" 버튼 비활성화). **[필수]** 프로필 대표 사진 (코치 카드 노출용, 영역 클릭 → 앨범에서 가져오기), **소개 이미지 (필수 최소 1장, 최대 5장, 다중 업로드, 영역/추가 버튼 클릭 → 앨범에서 가져오기 — `CoachProfileImage` 테이블: coachId/url/sortOrder, 코치 상세 페이지 상단 슬라이드로 노출, 드래그 순서 변경, 첫 번째 이미지가 히어로 영역 표시, 미등록 시 기본 그라디언트 배경)**, 경력 (년), 지도 가능 NTRP 범위, 자격증 이미지 업로드. 필수 항목 미입력 시 "프로필 등록 완료" 버튼 비활성화. **"프로필 등록 완료" 버튼은 화면 하단 고정 (스크롤 영역 밖 배치)** | High | Pending |
| FR-02a | 인증·회원가입 | **코치 가입 완료 화면**: 프로필 등록 완료 후 "코치 프로필 등록이 완료되었습니다!" 축하 화면 표시; 프로필 요약 (역할·구독 플랜·전문 분야·레슨 지역) + **"프로필 정보는 마이페이지 > 내 프로필 관리에서 언제든지 수정할 수 있어요" 안내 문구**; 다음 단계 안내 (스케줄 등록 유도, 소개 이미지 추가 유도); "홈으로 이동" CTA 버튼 → **홈 화면(FR-03)으로 이동** + "스케줄 등록하기" 버튼 → **스케줄 관리(FR-10)로 이동**; 스텝 인디케이터 3/3 완료 상태 | High | Pending |
| FR-02b | 인증·회원가입 | **코치 스케줄 등록 화면**: 코치 가입 완료(FR-02a) → "스케줄 등록" 클릭 시 **구독 플랜 체크** — 월간/연간 PRO 회원만 스케줄 등록 화면 이동, **무료 회원은 유료 전환 유도 Alert 표시** (PRO 혜택 안내 + "플랜 업그레이드" 버튼 → 구독 플랜 선택 화면 / "나중에" 버튼 → Alert 닫기); 건너뛰기 가능; **요일 탭 선택 (일~토)** → 해당 요일의 **시:분 슬롯을 개별 토글 선택** (10분 단위, 06:00~22:50, 오전/오후/저녁 그룹 표시) + 매주 반복 토글; 요일별 선택 건수 dot 표시; 하단 등록 요약 (요일 배지 + 선택된 시:분 태그 목록 + 요일 전체 삭제); "등록 완료" → 홈 화면 이동; "건너뛰기" → 홈 화면 이동 (미등록); API: `POST /api/schedule` (요일+시:분 단위 일괄 등록) | High | Pending |
| FR-03 | 홈 화면 | **홈 화면 (서비스 시작 화면)**: **비로그인 사용자도 홈 화면부터 진입** — 로그인 없이 코치 탐색·검색·상세 조회 가능. 구성: ① DB 연동 동적 배너 (상단, 공개 API, **어드민 Banner 테이블에서 등록·관리, 좌우 자동 롤링 3초 간격 + 스와이프 수동 전환 + 인디케이터 dot**); ② 코치 검색 — **검색바 클릭 시 바텀시트 팝업 노출**: 조회 조건 — 코치명(텍스트 입력) + 지역(시·도 → 시·군·구 2단계 셀렉트, "전체" 기본값) + 성별(전체/남성/여성 칩 선택) + "검색하기" 버튼 → 코치 목록 이동 (비로그인 가능); ③ **우리동네 코치님** (4가지 케이스 분기: A.비로그인→로그인 유도 / B.지역 미설정→지역 설정 유도 / C.코치 있음→가로 스크롤 카드 최대 5명 평점순 + 전체보기 / D.코치 없음→빈 상태 + 다른 지역 유도); ④ **지금 핫한 코치님** (공개); ⑤ **신규등록 코치님** (공개); ⑥ **코치 등록 배너** (**비로그인 상태에서만 표시**, 로그인 시 숨김, 클릭 → 구독 플랜 선택 화면 이동). **비로그인 시 로그인 필요 액션**: 레슨 신청 / 문의하기(채팅) / 찜하기 / 메시지 탭 → 로그인 화면 이동 + 토스트 안내 | High | Pending |
| FR-03a | 홈 화면 | **하단 네비게이션 바 (플로팅 라운딩)**: 홈 / 메시지 / 검색 / 마이메뉴 (4탭). 흰색 캡슐형 플로팅 바 (border-radius:30px, box-shadow, 디바이스 하단 20px 띄움). 코치 로그인 시 1번 탭 📅스케줄로 변경. 레슨 스케줄 슬롯 카드는 흰색 배경 + 1px gray-100 전체 테두리, 상태는 배지로만 구분 | High | Pending |
| FR-03b | 코치 탐색 | 코치 목록 페이지: 지역·성별·수준·가격 필터, 평점 정렬 | High | Pending |
| FR-04 | 코치 탐색 | 매칭 추천: 학생 프로필 기반 코치 Top-5 추천 | High | Pending |
| FR-05 | 코치 프로필 | **코치 프로필 상세 페이지**: 하단에 **문의하기** + **레슨신청** 버튼 구성. 우측 상단 **찜 버튼** (♡↔♥ 토글, 비로그인 시 로그인 유도). **PRO/ANNUAL 구독 배지는 관리자(ADMIN) 계정에서만 노출** (일반 사용자 미표시). **별점+리뷰 개수 클릭 → 리뷰 목록 화면(FR-05d)으로 이동**. 코치 상세 하단 리뷰 섹션 삭제 (리뷰는 별도 화면에서 조회) | High | Pending |
| FR-05d | 코치 프로필 | **코치 리뷰 목록 화면**: 코치 상세 → 별점/리뷰 개수 클릭 시 진입; 상단 평점 요약 (평균 점수 + 별점 분포 바 차트 1~5점) + 리뷰 카드 목록 (프로필 사진 + 작성자명 + 날짜 + 별점 + 리뷰 텍스트); API: `GET /api/coaches/:id/reviews` [공개] | High | Pending |
| FR-05a | 메시지 | **문의하기**: 코치-학생 간 1:1 DM 채팅 (Socket.io 기반 실시간 텍스트 채팅). **우측 상단 ⋯ 더보기 메뉴**: 채팅방 나가기 (확인 → 대화 삭제) / **차단하기** (확인 → 채팅방 비활성화 + 채팅 목록에서 "차단한 코치의 채팅방입니다" 문구 표시 + 레슨 신청 차단) / 신고하기 | High | Pending |
| FR-05b | 레슨 신청 | **레슨신청 플로우 (2단계)**: ① 레슨 선택 (유형 + 세부항목 + 요일 + **코치가 등록한 가능 시간대만 노출** — `GET /api/coaches/:id/schedule`) → ② 확인·제출 — **신청 방식 선택**: "레슨 신청만" (미결제, 코치 수락 대기) 또는 **"결제 후 신청"** (토스페이먼츠 결제 → 바로 확정 + 서비스 내 스케줄 관리 기능 이용 가능)<br>**정규레슨**: 주 횟수(주 1·2·3회), 레슨 형태(1:1 개인 / 그룹 2~4인), 요일 다중 선택, 시간 1시간 단위 다중 선택<br>**쿠폰레슨**: 총 횟수(1~10회 선택), **유효기간(코치가 설정한 값 안내 문구로 노출)**, 레슨 형태(1:1 개인 / 그룹 2~4인), 요일 다중 선택 + **"선택한 요일은 희망 요일이며, 코치 확인 후 최종 확정됩니다" 안내 문구**, 시간 10분 단위 다중 선택 (코치 가능 시간만) | High | Pending |
| FR-05c | 레슨 신청 | **코치 레슨신청 상세**: 수신한 신청 내용 확인 후 상태 선택 (수락 / 거절 / 취소) + **사유 작성** (거절·취소 시 필수); 작성된 사유는 수강생 신청 내역 상세에 노출 | High | Pending |
| FR-06 | 구독·결제 | **코치 구독 플랜 (어드민 관리)**: 플랜 데이터는 어드민에서 등록·관리하며 코치 화면에 동적 렌더링. 스텝 인디케이터 2/3 표시. **어드민 관리 항목**: ① 플랜명 (어드민 입력 텍스트, 예: "무료", "월간 PRO", "연간 PRO") ② 가격 (어드민 입력 숫자) ③ 빌링 주기 "/월" (하드코딩) ④ 부가 기능 목록 (어드민 코드 관리에서 항목별 선택 — `SubscriptionFeatureCode`: PROFILE_EXPOSURE, SEARCH_PRIORITY, REQUEST_LIMIT, REQUEST_UNLIMITED, STATS_DASHBOARD, PRO_BADGE, ANNUAL_BADGE, VERIFY_PRIORITY) ⑤ BEST 표시 여부 (어드민 토글) ⑥ 할인 문구 (어드민 입력, nullable) ⑦ CTA 버튼 문구 (어드민 입력) ⑧ CTA 스타일 (primary/secondary 선택) ⑨ 정렬 순서 (어드민 입력) | High | Pending |
| FR-07 | 구독·결제 | 코치 구독 결제: 토스페이먼츠 PG 결제, 자동 갱신, 해지 | High | Pending |
| FR-07a | 레슨 결제 | 레슨 예약 결제: 날짜·시간 선택 → 토스페이먼츠 결제 → 결제 완료 콜백 → 예약 확정 | High | Pending |
| FR-07b | 레슨 환불 | **결제취소 및 환불정책 화면**: 레슨 신청 확인 화면(3-4)에서 "결제취소 및 환불정책 보기" 링크 → 바텀시트로 환불 정책 본문 표시. **데이터: Terms 테이블 (code=REFUND_POLICY)에서 조회** — 어드민 약관 관리(FR-14g)에서 등록·개정 가능. `GET /api/terms/REFUND_POLICY` [공개 API]. |
| FR-07c | 레슨 환불 | **환불 정책**: ① 정규레슨 — 3일 전 전액(100%), 1~2일 전 90%(위약금 10%), 당일 환불 불가 ② 쿠폰레슨 — 미사용 횟수 비례 환불 (사용 횟수 × 1회 금액 차감), 유효기간 만료 후 환불 불가 ③ 코치 책임 취소 — 100% 전액 환불 (노쇼, 코치 사유). 수강생 마이페이지 → 신청 내역 → 취소 버튼 → 환불 금액 안내 + 확인 → `POST /api/payments/:id/refund` (토스페이먼츠 환불 API) | High | Pending |
| FR-08 | 리뷰 | 리뷰 작성: 레슨 완료 후 학생이 별점(1~5) + 텍스트 리뷰 작성; 완료 24시간 후 리뷰 유도 알림 | Medium | Pending |
| FR-09 | 알림 | **카카오 알림톡**: 예약 요청·확정·취소·D-1 리마인더, 구독 갱신 안내 (카카오 비즈메시지 API 연동) | High | Pending |
| FR-10 | 스케줄 | **코치 스케줄 관리**: 가용 시간 캘린더 등록/수정, 예약 시 자동 블록, 반복/단일 일정 지원 | High | Pending |
| FR-11 | 레슨 이력 | **레슨 이력 관리**: 코치 메모, 수강생 기록 탭, 레슨별 이력 조회 | Medium | Pending |
| FR-12 | 마이페이지 | **마이페이지 분기**: 비로그인 → 로그인/회원가입 화면 랜딩; 로그인(수강생) → 수강생 마이페이지; 로그인(코치) → 코치 전용 마이페이지 | High | Pending |
| FR-12a | 마이페이지 | **수강생 마이페이지**: 신청한 레슨 내역 (거절·취소 시 코치 사유 + 문의하기 버튼 → DM 연결), 찜한 코치, 작성한 리뷰, 알림 설정 (알림톡 수신 여부), 계정 관리 (로그아웃·탈퇴) | High | Pending |
| FR-12a-1 | 마이페이지 | **기본 프로필 수정**: 프로필 사진, 이름, 성별 (남성/여성/기타), 연령대 (10대/20대/30대/40대/50대 이상) | High | Pending |
| FR-12a-2 | 마이페이지 | **나의 테니스 정보 설정**: NTRP 레벨 (툴팁 제공), 레슨 목표 (다중 선택), 레슨 희망 지역 (시·도 → 시·군·구 2단계), 선호 레슨 형태 (1:1/그룹), 선호 시간대 (오전·오후·저녁·주말) | High | Pending |
| FR-12a-4 | 마이페이지 | **수강생 스케줄 관리 (결제 회원 전용)**: 결제 후 신청한 레슨의 스케줄을 서비스 내에서 관리; 캘린더 뷰 (예약된 레슨 일정 표시) + 레슨별 상세 (코치명, 시간, 장소) + D-1 리마인더 알림; **결제하지 않은 레슨은 스케줄 관리 미표시** (코치 수락 후에도 미결제면 미표시); 수강생 마이페이지 > "내 스케줄" 메뉴로 진입 | High | Pending |
| FR-12a-3 | 마이페이지 | **찜한 코치**: 코치 카드 목록 (사진·이름·위치·전문분야·평점·구독 플랜 뱃지) + 레슨 신청 버튼 + 찜 해제 버튼; 정렬: 최근 찜한 순; 빈 상태 메시지 + 코치 탐색하기 버튼; 탈퇴·비활성 코치는 "활동 중지" 표시 후 하단 이동 | High | Pending |
| FR-10a | 스케줄 | **스케줄 변경 요청 (수강생 → 코치)**: 수강생이 확정된 레슨의 일정 변경 요청 — ① 수강생이 기존 일정 선택 → 희망 변경 날짜 입력 → `POST /api/bookings/:id/reschedule` ② 시스템이 코치 가용 시간 자동 조회 → **변경 가능 날짜 목록 자동 추천** (코치 Schedule에서 isBlocked=false이고 ScheduleHold에 없는 슬롯) ③ 코치 스케줄 홈에 **변경 가능/변경 불가/제안됨** 3가지 카드 타입으로 표시 ④ **변경 가능**: 추천 날짜 목록 + "모두 제안하기" → 슬롯 12시간 임시 홀드(ScheduleHold) → 수강생 알림 ⑤ **변경 불가**: 가용 슬롯 없음 안내 + "불가 알림 보내기" → 기존 일정 유지 ⑥ **제안됨**: 수강생 응답 대기 상태 (홀드 남은 시간 표시) → 수강생 수락 시 확정 + 나머지 홀드 해제 → 거절 시 홀드 해제 + 재협의(NEGOTIATING) → 12시간 미응답 시 홀드 자동 만료 + 코치 알림 | High | Pending |
| FR-12b-0 | 마이페이지 | **코치 스케줄 홈 (코치 전용 첫 화면)**: 코치 로그인 시 **스플래시 → 스케줄 홈 화면으로 이동** (수강생/비로그인은 홈). 구성: **타이틀** ("나의 스케줄" 상단 + 코치명 하단) + **주간 미니 캘린더** (날짜별 점 3종 — 초록:레슨/보라:변경요청/주황:대기신청, 날짜 클릭 시 해당일 레슨 목록 전환, 빈 날짜 빈 상태 메시지, 범례 ? 툴팁) + **상태 안내 바** (그레이 박스, 클릭 시 상태별 설명 팝업) + **오늘 레슨 탭** (진행중/예정/변경요청/완료 4상태, 레슨 상세 풀팝업 — top-nav, 수강생 프로필+대화하기+일정 라디오+레슨 정보+회차+결제+보류/거절 더보기) + **변경 요청 탭** (변경가능/불가/제안됨/완료 카드, 일정 통합 박스, 추천 슬롯 체크박스 세로 리스트, 희망일 가용 시 중복 제거+확정하기 코랄 버튼) + **대기 중 신청** (신청 날짜 표시, 클릭 시 레슨 상세 풀팝업) + 이번 주 요약 (총 레슨/대기/완료). **코치 전용 하단 네비게이션**: 📅 스케줄(홈) / 💬 메시지 / 🔍 검색 / 👤 마이 | High | Pending |
| FR-12b | 마이페이지 | **코치 전용 마이페이지**: 내 프로필 관리, 구독 플랜 확인·변경, 레슨 신청 수신 목록 + 상세 (상태 선택·사유 작성 — FR-05c), 예약 현황, 리뷰 현황, 이번 주 스케줄 요약, 통계 (구독 플랜별 차등 노출), 알림 설정, 계정 관리 (로그아웃·탈퇴) | High | Pending |
| FR-13 | 코치 검증 | **코치 검증 배지**: 자격증 업로드 → 관리자 심사 → 인증 배지 부여 | Medium | Pending |
| FR-14 | 관리자 | **관리자 페이지 (데스크탑 전용)**: 좌측 사이드바 네비게이션 + 우측 메인 콘텐츠 레이아웃; 사이드바 메뉴: 대시보드 / 회원 관리 / 코치 검증 / 배너 관리 / 신고 관리 / 구독 플랜 / 코드 관리 / 약관 관리; 운영 대시보드 (회원·코치·검증대기·예약 통계, KPI — 재예약률·리뷰율·이탈률, 구독 현황, 최근 활동 로그) | Medium | Pending |
| FR-14a | 관리자 | **구독 플랜 관리 (어드민)**: 구독 플랜 CRUD — 플랜명(텍스트), 가격(숫자), 할인 문구(텍스트, nullable), BEST 표시(토글), CTA 버튼 문구(텍스트), CTA 스타일(primary/secondary 선택), 정렬 순서(숫자) 입력·수정·삭제 | High | Pending |
| FR-14b | 관리자 | **구독 부가 기능 코드 관리 (어드민)**: `SubscriptionFeatureCode` 항목 관리 — 코드(영문 키), 노출 라벨(텍스트) 등록·수정·삭제; 플랜별로 해당 코드 항목을 선택(enabled/disabled)하여 부가 기능 구성 | High | Pending |
| FR-14c | 관리자 | **레슨 목표 관리 (어드민)**: `LessonGoal` 테이블 CRUD — 코드(영문 키, 예: FOREHAND, SERVE, FITNESS 등), 노출 라벨(텍스트), 활성 여부(토글), 정렬 순서(숫자) 등록·수정·삭제; 수강생 프로필 등록 및 마이페이지 테니스 정보 화면에서 활성 항목만 다중 선택 칩으로 노출 | High | Pending |
| FR-14d | 관리자 | **코치 전문 분야 관리 (어드민)**: `CoachSpecialty` 테이블 CRUD — 코드(영문 키, 예: FOREHAND, BACKHAND, SERVE, VOLLEY, FOOTWORK, DOUBLES, STRATEGY, MENTAL, FITNESS, BEGINNER, KIDS 등), 노출 라벨(텍스트), 활성 여부(on/off 토글), 정렬 순서(숫자) 등록·수정·삭제; 코치 프로필 등록 및 프로필 관리 화면에서 isActive=true 항목만 on/off 토글 칩으로 노출 | High | Pending |
| FR-14e | 관리자 | **코드 관리 통합 화면 (어드민)**: 구독 부가기능(FR-14b) / 레슨 목표(FR-14c) / 전문 분야(FR-14d)를 **탭 UI**로 통합 관리; 각 탭에서 코드(영문), 라벨(텍스트), 활성 on/off 토글, 정렬 순서 확인; 항목별 추가(+) / 수정(✏️) / 삭제 기능; 관리자 대시보드에서 "코드 관리" 메뉴로 진입 | High | Pending |
| FR-14f | 관리자 | **약관 상세 페이지 (사용자)**: 약관 항목의 "보기 ›" 클릭 시 약관 상세 화면 이동 (`terms-detail.html?code={TERMS_CODE}`); 약관 제목·버전·시행일·본문(HTML)을 `GET /api/terms/:code` [공개 API] 로 조회하여 동적 렌더링; 하단 "확인" 버튼으로 이전 화면 복귀. **약관 본문은 어드민(FR-14g)에서 등록·개정한 Terms 테이블의 content(HTML) 데이터** | High | Pending |
| FR-14h | 관리자 | **신고하기 (사용자)**: 채팅 ⋯ 메뉴 → 🚨 신고하기 클릭 → 바텀시트에서 **신고 사유 선택** (부적절한 메시지 / 허위 프로필 / 스팸·광고 / 레슨 불이행 / 사기·금전 피해 / 기타 — `ReportReasonCode` 어드민 CRUD) + 상세 내용 입력 (기타 선택 시 필수) → "신고 접수" → `POST /api/reports`; **중복 방지**: 동일 신고자→동일 대상 24시간 이내 재신고 차단 | High | Pending |
| FR-14i | 관리자 | **신고 관리 (어드민)**: 신고 목록 테이블 (신고자, 대상, 사유, 상세, 날짜, 상태) + 필터 (전체/대기/검토중/완료) + **조치 버튼** (경고 / 일시 정지 7일 / 영구 차단) → 조치 시 대상 User 상태 변경 + 신고자에게 처리 결과 알림 자동 발송 | High | Pending |
| FR-14j | 관리자 | **신고 사유 코드 관리 (어드민)**: `ReportReasonCode` 테이블 CRUD — 코드(영문), 라벨(텍스트), 활성 여부(토글), 정렬 순서(숫자) 등록·수정·삭제 | High | Pending |
| FR-14k | 관리자 | **스케줄 관리 (어드민)**: 모든 코치의 스케줄 현황 및 변경 요청을 통합 관리하는 어드민 화면. **4개 탭 구성**: ① 코치 스케줄 현황 (코치별 등록 슬롯/확정/대기/변경요청/홀드 요약 테이블 + 검색/필터 + 코치 상세 슬라이드 패널: 주간 스케줄 미니맵 + 변경 이력 타임라인 + 어드민 직접 조치) ② 변경 요청 관리 (전체/대기/제안됨/완료/거절 필터 + 어드민 상태 강제 변경: 강제 제안/강제 수락/강제 거절/강제 완료/홀드 연장/홀드 해제/요청 취소/원래 일정 복구) ③ 변경 이력 (코치/수강생 검색 + 유형 필터 + 모든 변경 이력 로그: 처리자(수강생/코치/시스템/어드민) + 비고) ④ 정책 설정 (홀드 유효 시간/만료 알림/동시 홀드 제한/변경 요청 기한/자동 추천 최대 슬롯 수/추천 범위/결제 건 제한/완료 카드 노출 기간/알림 on/off 토글) | High | Pending |
| FR-14g | 관리자 | **약관 관리 (어드민)**: `Terms` 테이블 CRUD — 약관 코드(TERMS_OF_SERVICE/PRIVACY_POLICY/MARKETING 등), 제목(텍스트), 본문(HTML/마크다운 에디터), 버전(텍스트), 필수 여부(토글), 활성 여부(토글), 시행일, 정렬 순서 등록·수정; **버전 관리**: 약관 개정 시 새 버전 생성 → 기존 버전 비활성화 → 신규 버전 활성화; 사용자 로그인 시 동의한 버전과 현재 활성 버전 비교 → 불일치 시 재동의 요청 바텀시트 표시; 약관별 동의 현황 통계 (동의율, 미동의 사용자 수) 조회 | High | Pending |

### 6.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 주요 페이지 LCP < 2.5s | Lighthouse |
| Security | OWASP Top 10 준수, PG 결제 데이터 PCI-DSS 분리 | 보안 점검 체크리스트 |
| Scalability | 동시 예약 요청 충돌 방지 (낙관적 잠금) | 통합 테스트 |
| Availability | 99% 가동률 (월 기준) | Sentry + Vercel Analytics |
| Accessibility | WCAG 2.1 AA (핵심 플로우) | axe DevTools |
| Mobile | PWA 대응, 홈 화면 추가, Service Worker | Lighthouse PWA 감사 |

---

## 7. API Endpoints

```
Auth
  POST   /api/auth/login/kakao        카카오 소셜 로그인 (응답: isNewUser 분기)
  POST   /api/auth/login/naver        네이버 소셜 로그인 (응답: isNewUser 분기)
  POST   /api/auth/signup              미가입 사용자 회원가입 (소셜 데이터 + 약관 동의)
  POST   /api/auth/refresh             토큰 갱신
  DELETE /api/auth/logout              로그아웃

Users
  GET    /api/users/me                 내 프로필 조회
  PUT    /api/users/me                 내 프로필 수정
  POST   /api/users/me/avatar          프로필 이미지 업로드

Banners (공개 API)
  GET    /api/banners                  활성 배너 목록 [공개] (isActive=true, displayOrder순)

Terms (공개 API)
  GET    /api/terms/:code              약관 상세 조회 [공개] (code별 isActive=true 최신 버전 — title, content, version, effectiveDate)
  GET    /api/terms                    전체 약관 목록 [공개] (회원가입 시 약관 목록 조회용, isActive=true만)

Coaches (공개 API — 비로그인 접근 가능)
  GET    /api/coaches                  코치 검색 [공개] (필터: area, level, type, price, time)
  GET    /api/coaches/:id              코치 상세 프로필 [공개]
  GET    /api/coaches/:id/reviews      코치 리뷰 목록 [공개]
  GET    /api/coaches/:id/schedule     코치 가용 스케줄 조회 [공개]

Coaches (인증 필요)
  POST   /api/coaches/profile          코치 프로필 등록 [인증]
  PUT    /api/coaches/profile          코치 프로필 수정 [인증]
  POST   /api/coaches/profile/images   소개 이미지 업로드 [인증: 코치] (S3 업로드 + sortOrder 자동 부여)
  DELETE /api/coaches/profile/images/:id  소개 이미지 삭제 [인증: 코치] (삭제 후 sortOrder 재계산)
  PUT    /api/coaches/profile/images/reorder  소개 이미지 순서 변경 [인증: 코치] (imageIds 배열 → sortOrder 일괄 UPDATE)
  GET    /api/coaches/recommended      학생 프로필 기반 코치 Top-5 추천 [인증: 수강생]

Schedule
  GET    /api/schedule                 내 스케줄 조회 (코치용)
  POST   /api/schedule                 가용 시간 등록
  PUT    /api/schedule/:id             가용 시간 수정
  DELETE /api/schedule/:id             가용 시간 삭제

Bookings
  POST   /api/bookings                 레슨 예약 요청
  GET    /api/bookings                 내 예약 목록
  GET    /api/bookings/:id             예약 상세
  PUT    /api/bookings/:id/confirm     예약 수락 (코치)
  PUT    /api/bookings/:id/reject      예약 거절 (코치, 사유 필수)
  PUT    /api/bookings/:id/cancel      예약 취소 (사유 필수)
  PUT    /api/bookings/:id/complete    레슨 완료 처리
  POST   /api/bookings/:id/reschedule                스케줄 변경 요청 [인증: 수강생] (requestedDate, requestedTime, reason)
  GET    /api/bookings/:id/reschedule/options         변경 가능 날짜 자동 추천 [인증] (코치 가용 시간 조회, ScheduleHold 제외)
  POST   /api/bookings/:id/reschedule/propose         모두 제안하기 [인증: 코치] (slotIds[]) → ScheduleHold 생성 (12h 홀드)
  PUT    /api/bookings/:id/reschedule/accept           수강생 수락 [인증: 수강생] (selectedSlotId) → 확정 + 홀드 해제
  PUT    /api/bookings/:id/reschedule/reject-proposal   수강생 거절 [인증: 수강생] → 홀드 해제 + NEGOTIATING
  PUT    /api/bookings/:id/reschedule/reject            변경 불가 알림 [인증: 코치] (reason: UNAVAILABLE) → REJECTED
  GET    /api/schedule-holds                             코치 활성 홀드 목록 [인증: 코치]

Payments
  POST   /api/payments                 결제 요청 (토스페이먼츠)
  POST   /api/payments/confirm         결제 승인 콜백
  POST   /api/payments/:id/refund      환불 요청 [인증] (refundAmount, refundReason, refundType — 환불 규칙 자동 계산)
  GET    /api/payments/history         결제 내역 조회

Subscriptions
  GET    /api/subscriptions/plans      구독 플랜 목록
  POST   /api/subscriptions            구독 신청 + 결제
  PUT    /api/subscriptions/change     플랜 변경
  DELETE /api/subscriptions/cancel     구독 해지
  GET    /api/subscriptions/me         내 구독 정보

Reviews
  POST   /api/reviews                  리뷰 작성
  GET    /api/reviews/me               내가 작성한 리뷰

Chat
  GET    /api/chat/rooms               채팅방 목록
  GET    /api/chat/rooms/:id/messages  메시지 목록
  WS     /ws/chat                      실시간 채팅 (Socket.io)

Favorites
  POST   /api/favorites/:coachId       즐겨찾기 추가
  DELETE /api/favorites/:coachId       즐겨찾기 해제
  GET    /api/favorites                즐겨찾기 목록

Lesson Records
  POST   /api/lessons/:bookingId/record  레슨 기록 작성
  GET    /api/lessons/records            내 레슨 이력 조회

Notifications
  GET    /api/notifications            알림 목록
  PUT    /api/notifications/:id/read   알림 읽음 처리
  PUT    /api/notifications/settings   알림 설정 변경

Admin — 회원/코치 관리
  GET    /api/admin/users                    회원 목록 (필터: role, status)
  GET    /api/admin/users/:id                회원 상세
  PUT    /api/admin/users/:id/status         회원 상태 변경 (활성/차단)
  PUT    /api/admin/coaches/:id/verify       코치 검증 처리 (승인/반려)
  PUT    /api/admin/coaches/:id/block        코치 차단
  GET    /api/admin/dashboard                운영 지표 대시보드

Admin — 배너 관리
  GET    /api/admin/banners                  배너 목록
  POST   /api/admin/banners                  배너 등록
  PUT    /api/admin/banners/:id              배너 수정
  DELETE /api/admin/banners/:id              배너 삭제
  PUT    /api/admin/banners/:id/toggle       배너 활성/비활성 토글

Admin — 구독 플랜 관리 (FR-14a)
  GET    /api/admin/subscription-plans       구독 플랜 목록
  POST   /api/admin/subscription-plans       구독 플랜 등록
  PUT    /api/admin/subscription-plans/:id   구독 플랜 수정
  DELETE /api/admin/subscription-plans/:id   구독 플랜 삭제

Admin — 구독 부가 기능 코드 관리 (FR-14b)
  GET    /api/admin/subscription-features           부가 기능 코드 목록
  POST   /api/admin/subscription-features           부가 기능 코드 등록
  PUT    /api/admin/subscription-features/:id       부가 기능 코드 수정
  DELETE /api/admin/subscription-features/:id       부가 기능 코드 삭제

Admin — 레슨 목표 관리 (FR-14c)
  GET    /api/admin/lesson-goals             레슨 목표 목록
  POST   /api/admin/lesson-goals             레슨 목표 등록
  PUT    /api/admin/lesson-goals/:id         레슨 목표 수정
  DELETE /api/admin/lesson-goals/:id         레슨 목표 삭제

Admin — 코치 전문 분야 관리 (FR-14d)
  GET    /api/admin/coach-specialties        전문 분야 목록
  POST   /api/admin/coach-specialties        전문 분야 등록
  PUT    /api/admin/coach-specialties/:id    전문 분야 수정
  DELETE /api/admin/coach-specialties/:id    전문 분야 삭제

Admin — 약관 관리 (FR-14f)
  GET    /api/admin/terms                    약관 목록 (전체 버전 포함)
  POST   /api/admin/terms                    약관 등록 (신규 약관 또는 새 버전)
  PUT    /api/admin/terms/:id                약관 수정 (제목, 본문, 시행일)
  PUT    /api/admin/terms/:id/activate       약관 버전 활성화 (기존 동일 code 비활성화)
  DELETE /api/admin/terms/:id                약관 삭제 (미사용 버전만)
  GET    /api/admin/terms/:id/stats          약관별 동의 현황 (동의율, 미동의 수)

Admin — 신고 관리 (FR-14i)
  GET    /api/admin/reports                  신고 목록 (필터: status)
  GET    /api/admin/reports/:id              신고 상세 (대화 내용 포함)
  PUT    /api/admin/reports/:id/action       신고 조치 (경고/정지/차단 + 관리자 메모)

Admin — 신고 사유 코드 관리 (FR-14j)
  GET    /api/admin/report-reasons           신고 사유 코드 목록
  POST   /api/admin/report-reasons           등록
  PUT    /api/admin/report-reasons/:id       수정
  DELETE /api/admin/report-reasons/:id       삭제

Reports (사용자 API)
  POST   /api/reports                        신고 접수 [인증] (targetId, targetType, reasonCode, reasonDetail)
```

---

## 8. Sprint Plan

### Phase 1 — 기반 구축 (1~4주)

#### Sprint 1 (1~2주): 온보딩 + 검색

| 태스크 | 상세 | 예상 공수 |
|--------|------|-----------|
| 프로젝트 초기 세팅 | Next.js + NestJS monorepo 구성, DB 스키마, CI/CD | 2일 |
| 소셜 로그인 | 카카오·네이버·애플 OAuth 연동, JWT 발급 | 2일 |
| 코치 프로필 등록 | 프로필 폼 (경력, 전문분야, 단가, 지역, 자격증, 사진 업로드) | 3일 |
| 수강생 프로필 등록 | 실력 수준, 선호 레슨 유형, 선호 지역 | 1일 |
| 코치 검색 + 필터 | 위치·실력·유형·가격·시간 필터, 코치 리스트 UI | 2일 |

**마일스톤:** 코치가 프로필을 등록하고, 수강생이 조건별로 코치를 검색할 수 있다.

#### Sprint 2 (3~4주): 예약 + 결제

| 태스크 | 상세 | 예상 공수 |
|--------|------|-----------|
| 예약 시스템 | 날짜·시간 선택 UI, 레슨 신청 플로우 (정규/쿠폰), 코치 수락/거절 | 3일 |
| 토스페이먼츠 연동 | PG 가맹, 결제 API 연동, 결제 완료 콜백 처리 | 3일 |
| 카카오 알림톡 연동 | 비즈메시지 API 세팅, 예약 요청·확정·취소 알림톡 템플릿 등록 | 2일 |
| 예약 상태 관리 | PENDING → CONFIRMED → COMPLETED 상태 전이 + 거절/취소 사유 | 1일 |
| API 테스트 | 예약·결제 플로우 통합 테스트 | 1일 |

**마일스톤:** 수강생이 코치를 선택 → 레슨 신청 → 결제까지 완전한 플로우가 작동한다.

---

### Phase 2 — 리텐션 장치 (5~8주)

#### Sprint 3 (5~6주): 리뷰 + 스케줄

| 태스크 | 상세 | 예상 공수 |
|--------|------|-----------|
| 리뷰 시스템 | 레슨 완료 후 평점+텍스트 리뷰, 코치 프로필에 누적 | 2일 |
| 리뷰 유도 UX | 레슨 완료 24시간 후 알림톡, 리뷰 작성 유도 플로우 | 1일 |
| 코치 스케줄 관리 | 가용 시간 캘린더 등록/수정, 예약 시 자동 블록 | 3일 |
| 코치 즐겨찾기 | 수강생이 관심 코치 저장, 즐겨찾기 목록 조회 | 1일 |
| 코치 대시보드 v1 | 예약 현황, 리뷰 현황, 이번 주 스케줄 요약 | 3일 |

**마일스톤:** 코치의 리뷰 자산이 쌓이기 시작하고, 스케줄 관리가 플랫폼에 종속된다. (Lock-in 시작)

#### Sprint 4 (7~8주): 채팅 + 이력

| 태스크 | 상세 | 예상 공수 |
|--------|------|-----------|
| 앱 내 1:1 채팅 | Socket.io 기반 실시간 채팅, 예약 전 Q&A 용도 | 3일 |
| 채팅 알림 | 새 메시지 알림톡, 안 읽은 메시지 배지 | 1일 |
| 레슨 이력 저장 | 코치 메모, 수강생 기록 탭, 레슨별 이력 조회 | 2일 |
| 수강생 마이페이지 | 예약 내역, 레슨 이력, 리뷰 작성 내역, 찜한 코치 조회 | 2일 |
| PWA 설정 | Service Worker, 매니페스트, 홈 화면 추가 유도 배너 | 2일 |

**마일스톤:** 카카오톡 직거래 대신 플랫폼 안에서 소통하는 습관이 형성된다. 수강생 레슨 이력이 플랫폼에 쌓이고, PWA로 모바일 접근성 확보.

---

### Phase 3 — 런칭 + 검증 (9~12주)

#### Sprint 5 (9~10주): 검증 + QA

| 태스크 | 상세 | 예상 공수 |
|--------|------|-----------|
| 코치 검증 배지 | 자격증 업로드 → 관리자 심사 → 배지 부여 플로우 | 2일 |
| 관리자 페이지 | 코치 승인/차단, 회원 관리, 신고 처리, 배너 관리 | 3일 |
| 코치 구독 플랜 | 무료/월간/연간 플랜 UI + 결제 + 기능 차등 적용 | 3일 |
| QA 테스트 | 전체 플로우 E2E 테스트, 버그 수정 | 2일 |

**마일스톤:** 코치 검증·구독 시스템 완성, 전체 플로우 QA 통과.

#### Sprint 6 (11~12주): 소프트 런칭

| 태스크 | 상세 | 예상 공수 |
|--------|------|-----------|
| 운영 대시보드 | 재예약률·리뷰율·이탈률 핵심 지표 모니터링 | 2일 |
| 랜딩 페이지 | 서비스 소개, 코치 가입 유도, SEO 최적화 | 2일 |
| 베타 코치 모집 | 강남·마포 코치 50명 DM 모집, 온보딩 가이드 제작 | 2일 |
| 소프트 런칭 | 서울 강남·마포 한정 오픈, 초기 유저 모니터링 | - |
| 핫픽스 대응 | 실사용 피드백 기반 긴급 수정 | 3일 |
| 성과 리포트 | 2주 운영 데이터 분석, 피벗/확장 판단 | 1일 |

**마일스톤:** 서울 2개 지역 소프트 런칭 완료. 핵심 지표 추적 시작.

---

## 9. Folder Structure

```
courtside/
├── apps/
│   ├── web/                    # Next.js 웹 (수강생/코치/관리자)
│   │   ├── app/
│   │   │   ├── (auth)/         # 로그인, 회원가입
│   │   │   ├── (student)/      # 수강생 페이지
│   │   │   ├── (coach)/        # 코치 전용 페이지
│   │   │   ├── (admin)/        # 관리자 페이지
│   │   │   ├── api/            # API 라우트 (BFF)
│   │   │   └── layout.tsx
│   │   ├── components/         # 웹 전용 UI 컴포넌트
│   │   ├── features/
│   │   │   ├── auth/           # 인증 관련
│   │   │   ├── coach/          # 코치 프로필·탐색
│   │   │   ├── booking/        # 예약·레슨 신청
│   │   │   ├── payment/        # 결제
│   │   │   ├── review/         # 리뷰
│   │   │   ├── chat/           # 채팅
│   │   │   ├── schedule/       # 스케줄
│   │   │   └── subscription/   # 구독
│   │   ├── lib/                # 유틸, API 클라이언트
│   │   ├── stores/             # Zustand 스토어
│   │   └── types/              # 프론트엔드 타입
│   └── api/                    # NestJS 백엔드
│       ├── src/
│       │   ├── auth/           # 인증 모듈
│       │   ├── users/          # 회원 모듈
│       │   ├── coaches/        # 코치 모듈
│       │   ├── bookings/       # 예약 모듈
│       │   ├── payments/       # 결제 모듈
│       │   ├── subscriptions/  # 구독 모듈
│       │   ├── reviews/        # 리뷰 모듈
│       │   ├── schedule/       # 스케줄 모듈
│       │   ├── chat/           # 채팅 모듈
│       │   ├── notifications/  # 알림 모듈
│       │   └── admin/          # 관리자 모듈
│       └── prisma/
│           └── schema.prisma
├── packages/
│   ├── shared/                 # 공통 타입, 유틸, 상수
│   └── ui/                     # 공유 UI 컴포넌트
├── turbo.json
├── package.json
└── README.md
```

---

## 10. KPI (핵심 지표)

런칭 후 2주간 아래 지표를 추적하여 피벗/확장을 판단한다.

| 지표 | 목표 | 측정 방법 |
|------|------|-----------|
| 코치 가입 전환율 | 50% (DM 대비) | 가입 수 / DM 발송 수 |
| 첫 예약 전환율 | 30% (가입 수강생 대비) | 첫 예약 수 / 가입 수강생 수 |
| 재예약률 | 40% 이상 | 2회 이상 예약 수강생 / 전체 예약 수강생 |
| 리뷰 작성률 | 50% 이상 | 리뷰 수 / 완료 레슨 수 |
| 코치 이탈률 | 20% 미만 (월간) | 비활성 코치 / 전체 코치 |
| 플랫폼 결제 비율 | 60% 이상 | 앱 내 결제 건 / 전체 레슨 건 |
| NPS | 30 이상 | 설문 기반 |

---

## 11. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 초기 코치 공급 부족 | High | High | 베타 무료 이용권으로 초기 모집; 인스타·당근·카페 4채널 동시 모집; 코치 온보딩 UX 간소화 |
| 직거래 이탈 | High | High | Lock-in 3종 (리뷰 자산 + 레슨 이력 + 스케줄 관리); 플랫폼 결제 시 할인 혜택 |
| 경쟁사 매칭 기능 추가 | High | Medium | 6개월 선점; 코치 SaaS 도구 차별화로 전환 비용 형성 |
| PG 결제 연동 복잡도 | Medium | Medium | 토스페이먼츠 SDK 사용; MVP는 카드 결제만 지원 |
| 예약 동시성 충돌 | High | Low | DB 트랜잭션 + 낙관적 잠금; Redis 기반 스케줄 블록; 예약 상태 머신 명확히 정의 |
| 개인정보 보안 | High | Low | HTTPS 전용, 비밀번호 bcrypt 해싱, 결제 정보 토큰화 |
| 매칭 알고리즘 정확도 | Medium | Medium | MVP는 룰 기반 필터링; 데이터 축적 후 ML 개선 |
| 코치 검증 실패 | Medium | Medium | 초기 자기 신고 + 관리자 수동 확인; 자격증 체계 연구 후 자동화 |
| 1인 개발 병목 | Medium | High | Must 기능만 MVP 포함; 핵심 외 기능은 후순위 |

---

## 12. Success Criteria

### 12.1 Definition of Done

- [ ] FR-01 ~ FR-14 모두 구현 완료
- [ ] 레슨 신청 플로우 E2E 테스트 통과 (학생 신청 → 코치 수락 → 결제 → 레슨 완료 → 리뷰)
- [ ] 코치 구독 결제 플로우 E2E 테스트 통과 (플랜 선택 → 결제 → 기능 차등 적용)
- [ ] 매칭 알고리즘 단위 테스트 통과
- [ ] 실시간 채팅 통합 테스트 통과
- [ ] Gap Analysis Match Rate >= 90%
- [ ] 코드 리뷰 완료

### 12.2 Quality Criteria

- [ ] TypeScript strict 모드, lint 에러 0
- [ ] 핵심 비즈니스 로직 테스트 커버리지 >= 80%
- [ ] 빌드 성공 (CI 통과)
- [ ] Lighthouse Performance >= 80
- [ ] PWA 감사 통과

---

## 13. Checklist

### 개발 착수 전

- [ ] 구글폼 설문 30건 수집, 긍정 응답 40% 이상 확인
- [ ] 토스페이먼츠 가맹점 신청 및 승인
- [ ] 통신판매업 신고 완료
- [ ] AWS / Vercel 계정 및 도메인 준비
- [ ] 디자인 시스템 (Figma) 기본 컴포넌트 완성
- [ ] 카카오 비즈니스 채널 개설 + 알림톡 템플릿 등록

### Phase 1 완료 시

- [ ] 소셜 로그인 2종 (카카오·네이버) 정상 작동
- [ ] 코치 프로필 등록 → 검색 → 상세 조회 플로우 완성
- [ ] 레슨 신청 (정규/쿠폰) → 코치 수락/거절 플로우 정상
- [ ] 예약 → 결제 → 확정 알림톡 E2E 정상 작동
- [ ] 결제 테스트 (토스 테스트 모드) 통과

### Phase 2 완료 시

- [ ] 리뷰 작성 → 코치 프로필 평점 반영 정상
- [ ] 코치 캘린더 가용 시간 등록/블록 정상 작동
- [ ] 채팅 실시간 메시지 송수신 정상
- [ ] 레슨 이력 저장 및 조회 정상
- [ ] PWA 배포 완료 (홈 화면 추가 유도 정상 작동)

### Phase 3 완료 시

- [ ] 코치 검증 배지 플로우 정상
- [ ] 코치 구독 플랜 결제·기능 차등 정상
- [ ] 베타 코치 50명 온보딩 완료
- [ ] 전체 플로우 QA 통과 (크리티컬 버그 0건)
- [ ] 운영 대시보드 핵심 지표 표시 정상
- [ ] 소프트 런칭 체크리스트 완료

---

## 14. Impact Analysis

### 14.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| User 테이블 | DB Model | 역할(role: STUDENT/COACH/ADMIN) 필드, 소셜 로그인 정보 |
| CoachProfile | DB Model | 신규 엔티티: 경력, 위치, 가격, 자격증, 구독 플랜, 검증 상태 |
| StudentProfile | DB Model | 신규 엔티티: NTRP 레벨, 선호 지역, 레슨 목표 |
| Booking | DB Model | 신규 엔티티: 예약 상태 머신 (PENDING/CONFIRMED/COMPLETED/CANCELLED/REJECTED) |
| Payment | DB Model | 신규 엔티티: 결제 정보 (토스페이먼츠 토큰 기반) |
| CoachSubscription | DB Model | 신규 엔티티: 구독 플랜, 자동 갱신, 상태 |
| Review | DB Model | 신규 엔티티: 별점, 텍스트 |
| Schedule | DB Model | 신규 엔티티: 코치 가용 시간, 반복/단일 |
| ChatRoom/ChatMessage | DB Model | 신규 엔티티: 1:1 채팅 |
| LessonRecord | DB Model | 신규 엔티티: 레슨 이력, 코치 메모 |

### 14.2 Current Consumers

신규 프로젝트이므로 기존 소비자 없음.

### 14.3 Verification

- [ ] 예약 상태 전이 로직 통합 테스트
- [ ] 결제 웹훅 처리 테스트 (성공/실패/취소/환불)
- [ ] 실시간 채팅 연결/메시지 전송 테스트
- [ ] 구독 자동 갱신/해지 로직 테스트

---

## 15. Architecture Considerations

### 15.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | 정적 사이트 구조 | 포트폴리오, 랜딩 페이지 | - |
| **Dynamic** | Feature 모듈 + BaaS/API 통합 | 풀스택 SaaS MVP | **Selected** |
| **Enterprise** | 마이크로서비스, 엄격한 레이어 분리 | 대규모 고트래픽 시스템 | - |

### 15.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Monorepo | Turborepo / Nx / pnpm workspace | **Turborepo** | 빌드 캐싱, 간단한 설정 |
| Frontend | Next.js / React / Vue | **Next.js 14 (App Router)** | SSR/SEO 필요, 생태계 성숙도 |
| Backend | NestJS / Express / Fastify | **NestJS** | 타입 안전, 모듈 구조, DI |
| ORM | Prisma / TypeORM / Drizzle | **Prisma** | 타입 자동 생성, 마이그레이션 |
| State Management | Zustand / Redux / Context | **Zustand** | 경량, 보일러플레이트 최소 |
| API Client | fetch / axios / react-query | **TanStack Query** | 캐싱·동기화·낙관적 업데이트 |
| Form Handling | react-hook-form / formik | **react-hook-form + zod** | 성능, 타입 안전 유효성 검사 |
| Styling | Tailwind / CSS Modules | **Tailwind CSS** | 빠른 UI 개발 |
| Testing | Jest / Vitest / Playwright | **Vitest + Playwright** | 속도, E2E 커버리지 |
| 결제 PG | 토스페이먼츠 / 포트원 | **토스페이먼츠** | 국내 PG 점유율 1위, 개인사업자 가맹 용이 |
| 인증 | NextAuth / Passport / Custom | **NextAuth.js + Passport.js** | 소셜 로그인 간편 연동 |
| 채팅 | Socket.io / Firebase | **Socket.io** | 실시간 양방향 통신, NestJS 통합 |
| 파일 저장 | AWS S3 / Cloudflare R2 | **AWS S3** | 안정성, CDN 연동 |

---

## 16. Convention Prerequisites

### 16.1 Existing Project Conventions

- [ ] `CLAUDE.md` 코딩 컨벤션 섹션
- [ ] ESLint + Prettier 설정
- [ ] TypeScript strict 모드

### 16.2 Conventions to Define

| Category | To Define | Priority |
|----------|-----------|:--------:|
| **Naming** | 컴포넌트 PascalCase, 훅 use 접두사, 상수 UPPER_SNAKE | High |
| **Folder structure** | features/ 내 index.ts 배럴 export | High |
| **API 응답** | `{ data, error, pagination }` 통일 | High |
| **에러 처리** | 서버: NestJS Exception Filter, 클라이언트: Error Boundary | Medium |
| **NestJS 모듈** | Controller → Service → Repository 패턴 통일 | High |

### 16.3 Environment Variables Needed

| Variable | Purpose | Scope |
|----------|---------|-------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | Server |
| `REDIS_URL` | Redis 연결 문자열 | Server |
| `NEXTAUTH_SECRET` | 세션 암호화 | Server |
| `KAKAO_CLIENT_ID` | 카카오 OAuth 앱 키 | Server |
| `KAKAO_CLIENT_SECRET` | 카카오 OAuth 시크릿 | Server |
| `NAVER_CLIENT_ID` | 네이버 OAuth 클라이언트 ID | Server |
| `NAVER_CLIENT_SECRET` | 네이버 OAuth 시크릿 | Server |
| ~~`APPLE_CLIENT_ID`~~ | ~~애플 OAuth~~ (PWA 제외, 네이티브 앱 시 추가) | — |
| `TOSS_CLIENT_KEY` | 토스페이먼츠 클라이언트 키 | Client |
| `TOSS_SECRET_KEY` | 토스페이먼츠 시크릿 키 | Server |
| `KAKAO_BIZ_API_KEY` | 카카오 비즈메시지 API 키 | Server |
| `AWS_S3_BUCKET` | S3 버킷명 | Server |
| `AWS_ACCESS_KEY_ID` | AWS 액세스 키 | Server |
| `AWS_SECRET_ACCESS_KEY` | AWS 시크릿 키 | Server |
| `SENTRY_DSN` | Sentry 에러 트래킹 DSN | Both |

---

## 17. Next Steps

1. [x] `/pdca design tennis-coach-matching` — 디자인 가이드 작성 완료
2. [x] DB 테이블 정의서 작성 — `docs/02-design/database-schema.md` (31개 테이블)
3. [ ] Prisma 스키마 정의 (`schema.prisma`) — DB 정의서 기반
3. [ ] 코딩 컨벤션 정의 (`/phase-2-convention`)
4. [ ] Figma 디자인 시스템 기본 컴포넌트 완성
5. [ ] 토스페이먼츠 가맹점 신청
6. [ ] 카카오 비즈니스 채널 개설
7. [ ] 구현 시작 (Sprint 1)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-06 | Initial draft | User |
| 1.0 | 2026-04-09 | COURTSIDE 개발 실행 계획 병합: NestJS 백엔드, 토스페이먼츠, 소셜 로그인, 스프린트 계획, API 설계, DB 모델, KPI, 체크리스트 추가 | User |
