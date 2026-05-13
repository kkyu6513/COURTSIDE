# COURTSIDE 개발 계획 (Coach SaaS, MVP)

> **기준**: 2026-05-08 Phase 2 피벗 (마켓플레이스 → Coach SaaS) 이후
> **이전 문서**: `tennis-coach-matching.plan.md` (마켓플레이스 기준 Sprint 1~6은 deprecated)

## 1. 비즈니스 모델 (확정)

**Coach SaaS** — 코치가 본인 학생 관리 + 정기 레슨 운영 도구
- 매출: 코치 구독료 (월간/연간 PRO)
- 학생 결제: 외부 정산 (코치가 현금/계좌이체로 직접 수령, 시스템은 확인만)
- 학생 유입: 코치가 학생을 초대 (마켓플레이스/검색 X)

## 2. 기술 스택 (확정)

| 구분 | 선택 |
|------|------|
| Frontend + Backend | **Next.js 14 (App Router) + TypeScript** — Server Actions + Route Handlers |
| DB | **Supabase PostgreSQL** + Prisma ORM |
| 인증 | **Supabase Auth** (카카오/네이버 소셜) |
| 파일 저장 | **Supabase Storage** (프로필/자격증 이미지) |
| 실시간 채팅 | **Supabase Realtime** |
| 결제 | **토스페이먼츠** (코치 구독료) |
| 알림톡 | **Solapi** (카카오 비즈채널 연동) |
| 스타일 | Tailwind CSS (프로토타입 그대로 이식) |
| 상태/폼 | Zustand + react-hook-form + zod |
| API 캐싱 | TanStack Query |
| 배포 | **Vercel** |
| 모니터링 | Sentry + Vercel Analytics |

**제외(2차 검토)**: NestJS 분리, AWS, Redis 분리 캐시, Socket.io (Supabase Realtime으로 대체)

## 3. MVP 범위 (FR 매핑)

### ✅ 포함 (1차 출시)

| FR | 기능 |
|----|------|
| FR-01·01a·01b·01c·02 | 회원가입/로그인 (소셜) + 역할 선택 + 프로필 등록 |
| FR-02b · FR-10 | 코치 스케줄 등록 (요일별 시:분 슬롯) |
| FR-06·07 | 코치 구독 플랜 + 토스페이먼츠 결제 |
| FR-15a | **학생 홈 = 내 스케줄** |
| FR-15b·15c | **코치 → 학생 초대** + 초대 가입 단축 플로우 |
| FR-10a | 변경요청 (학생 → 코치) + 코치 응답 (제안/불가) |
| FR-12b-3 | 보강 레슨 (코치가 일정 제안) |
| FR-12b-0·12b · 12a | 코치/학생 마이페이지 (최소) |
| FR-12b-4 | 코치 회원 검색 |
| FR-08 | 리뷰 (별점만 — 텍스트 리뷰는 Phase 2) |
| FR-09 | 알림톡 핵심 5종 (예약확정·변경요청·결강·보강·결제확인) |
| FR-05a | 코치-학생 1:1 채팅 (텍스트) |

### ⏳ 제외 (Phase 2)

- FR-13 코치 검증 배지, FR-14m 회차 통합/분할
- FR-14 어드민 페이지 전체 (1차는 Supabase Dashboard로 직접 운영)
- FR-14h·14i·14j 신고/차단
- FR-11 레슨 이력 메모 (단순 리스트 조회만)
- FR-12b-2 외부 수강생 (FR-15b 초대로 통합)
- 푸시 알림, PWA 고급 (오프라인 등)

## 4. Sprint 계획 (8주, 4 Sprint)

### Sprint 1 (1~2주차) — 셋업 + 인증 + 프로필

| 태스크 | DoD | 공수 |
|--------|-----|------|
| Next.js 14 프로젝트 셋업 | `app/` 구조, Tailwind, 절대경로, ESLint/Prettier | 0.5d |
| Supabase 프로젝트 + Prisma | `prisma/schema.prisma` 작성, `npx prisma db push` | 1d |
| 카카오/네이버 소셜 로그인 | Supabase Auth provider 설정, 콜백 처리 | 1d |
| FR-01b 역할 선택 | 학생/코치 선택 → 프로필 등록 분기 | 0.5d |
| FR-01c 학생 프로필 등록 | NTRP/지역/목표/약관 동의 | 1d |
| FR-02 코치 프로필 등록 | 전문분야/지역/가격/이미지 업로드 | 2d |
| FR-02b 코치 스케줄 등록 | 요일별 10분 슬롯 토글 + 반복 | 1.5d |
| 공통 레이아웃 + 네비바 | 코치 5탭 / 학생 4탭 + 라우팅 | 1d |

**마일스톤**: 코치/학생이 가입하고 본인 프로필을 등록할 수 있다. 코치는 스케줄을 등록한다.

### Sprint 2 (3~4주차) — 초대 + 구독결제 + 정기레슨

| 태스크 | DoD | 공수 |
|--------|-----|------|
| FR-15b 코치 → 학생 초대 | 전화번호 입력 → Solapi 카톡/SMS 발송 | 1.5d |
| FR-15c 초대 가입 플로우 | 토큰 검증 → 역할 자동 학생 → 자동 연결 | 1d |
| 정기레슨 설정 | 코치가 학생별 요일/시간 지정 → Booking 자동 생성 | 2d |
| FR-06·07 구독 플랜 + 토스페이먼츠 | 무료/월간/연간 + 결제 + Webhook | 2d |
| FR-15a 학생 홈 (스케줄) | 프로토타입 그대로 이식 | 1.5d |
| FR-12b-0 코치 스케줄 홈 | 프로토타입 그대로 이식 | 1.5d |

**마일스톤**: 코치가 학생을 초대 → 학생이 가입 → 코치가 정기레슨 시간 설정 → 양쪽 홈에 표시. 코치 구독 결제 작동.

### Sprint 3 (5~6주차) — 변경요청/보강/결강 + 알림톡

| 태스크 | DoD | 공수 |
|--------|-----|------|
| FR-10a 변경요청 (학생→코치) | 변경 요청 + 추천 슬롯 + ScheduleHold | 2.5d |
| 코치 응답 (제안/불가) | 코치 스케줄 홈 변경 카드 | 1.5d |
| FR-12b-3 보강 처리 | 결강 → 보강 일정 제안 + 학생 선택 | 2d |
| 결강 처리 | 사유 선택 + 회차 처리 정책 | 1d |
| FR-09 알림톡 5종 + Solapi | 예약확정·변경·결강·보강·결제확인 | 2d |
| 결제 확인 (현금/계좌이체) | 코치 [잔액 수령 확인] → PAID 전환 | 1d |

**마일스톤**: 변경요청·보강·결강 전체 플로우 + 알림톡 발송.

### Sprint 4 (7~8주차) — 채팅 + 리뷰 + 마이페이지 + QA

| 태스크 | DoD | 공수 |
|--------|-----|------|
| FR-05a 채팅 (Supabase Realtime) | 1:1 텍스트 채팅 | 2d |
| FR-08 리뷰 (별점) | 레슨 완료 후 별점 입력 | 1d |
| FR-12a·12b 마이페이지 | 최소 메뉴 (프로필·로그아웃·탈퇴) | 1.5d |
| FR-12b-4 코치 회원 검색 | 검색 + 정렬 + 카드 | 1d |
| E2E 테스트 + 버그 수정 | Playwright 주요 플로우 5종 | 2d |
| 베타 코치 3~5명 온보딩 | 강남 한정 클로즈드 베타 | 2.5d |

**마일스톤**: 코어 MVP 완성. 베타 코치 모집 시작.

## 5. Sprint 1 첫 태스크 — 프로젝트 셋업

다음 작업으로 시작:

1. `app/` Next.js 14 프로젝트 생성 (TypeScript, Tailwind, App Router, src dir 사용 안 함)
2. `prisma/` 디렉토리 + `database-schema.md` 기반 `schema.prisma` 작성
3. Supabase 프로젝트 생성 후 connection string 연결
4. `npx prisma db push`로 스키마 적용
5. ESLint/Prettier + 절대경로 alias `@/` 설정
6. Vercel preview 배포 연결

**산출물**: `https://courtside.vercel.app` 에 빈 홈페이지 떠야 함.

## 6. 디렉토리 구조 (목표)

```
COURTSIDE/
├── app/                    # Next.js 14 App Router
│   ├── (auth)/             # 로그인/가입
│   ├── (student)/          # 학생 화면 (홈/내레슨/마이)
│   ├── (coach)/            # 코치 화면 (스케줄홈/검색/마이)
│   ├── api/                # Route Handlers (Webhook 등)
│   └── invite/[token]/     # FR-15c 초대 가입
├── components/             # 공용 UI
├── lib/                    # Supabase 클라이언트, 알림톡, 결제
├── prisma/                 # schema.prisma
├── docs/                   # 기존 기획 문서 유지
└── public/                 # 정적 자산
```

기존 `docs/03-prototype/` 는 보존 (개발 중 레퍼런스).
