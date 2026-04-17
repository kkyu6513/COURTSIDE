# COURTSIDE — 디자인 가이드

> **참고 레퍼런스**: Habitz 앱 (습관 관리 앱) — 플레이풀하고 친근한 모바일 UI 스타일
> **적용 방향**: Habitz의 컬러풀하고 라운드한 감성을 유지하되, 테니스/스포츠 앱에 맞는 활동적이고 신뢰감 있는 톤으로 조정
> **Date**: 2026-04-09

---

## 1. 디자인 원칙

| 원칙 | 설명 |
|------|------|
| **Playful & Trustworthy** | 친근하고 가볍지만, 코치-학생 간 신뢰를 줄 수 있는 무게감 |
| **Mobile First** | 모든 UI는 375px 기준 모바일 우선 설계, PWA 최적화 |
| **Color-coded** | 코치 상태·레슨 유형·구독 플랜을 색상으로 직관적으로 구분 |
| **Rounded & Soft** | 날카로운 모서리 없이 전체적으로 부드러운 라운드 처리 |

---

## 2. 컬러 시스템

### 2.1 Primary Palette

| 이름 | Hex | 용도 |
|------|-----|------|
| **Courtside Green** | `#2DD4BF` | Primary CTA 버튼, 활성 탭, 체크 상태 |
| **Courtside Navy** | `#1E3A5F` | 헤드라인, 주요 텍스트, 아이콘 |
| **Courtside Yellow** | `#F9C846` | 평점 별, 하이라이트, 배지 |
| **White** | `#FFFFFF` | 카드 배경, 기본 배경 |
| **Light Gray** | `#F5F5F7` | 페이지 배경, 인풋 필드 배경 |

### 2.2 Accent Palette (Habitz 스타일 — 레슨/카테고리 구분)

| 이름 | Hex | 용도 |
|------|-----|------|
| **Coral** | `#FF6B6B` | 정규레슨 카드 |
| **Orange** | `#FF9F43` | 쿠폰레슨 카드 |
| **Teal** | `#2DD4BF` | 완료 상태, 확정 예약 |
| **Purple** | `#7C5CBF` | 프리미엄 구독 배지, 강조 배너 |
| **Pink** | `#F9A8D4` | 신규 코치 배지, 추천 섹션 |
| **Sky Blue** | `#93C5FD` | 무료 플랜 배지 |

### 2.3 Semantic Colors

| 이름 | Hex | 용도 |
|------|-----|------|
| **Success** | `#22C55E` | 예약 확정, 결제 성공 |
| **Warning** | `#F59E0B` | 대기 중(Pending) 상태 |
| **Error** | `#EF4444` | 거절, 오류 메시지 |
| **Info** | `#3B82F6` | 알림, 안내 메시지 |

---

## 3. 타이포그래피

> 기준 폰트: **Pretendard** (한국어 최적화, 모던 산세리프)

### 3.1 Type Scale

| 이름 | Size | Weight | Line Height | 용도 |
|------|------|--------|-------------|------|
| **Display** | 32px | 800 (ExtraBold) | 1.2 | 앱 타이틀, 온보딩 헤드라인 |
| **Heading 1** | 24px | 700 (Bold) | 1.3 | 페이지 타이틀 |
| **Heading 2** | 20px | 700 (Bold) | 1.4 | 섹션 타이틀 |
| **Heading 3** | 17px | 600 (SemiBold) | 1.4 | 카드 타이틀, 코치 이름 |
| **Body** | 15px | 400 (Regular) | 1.6 | 본문 텍스트 |
| **Body Small** | 13px | 400 (Regular) | 1.5 | 보조 설명, 날짜 |
| **Caption** | 11px | 400 (Regular) | 1.4 | 태그, 배지 텍스트 |
| **Label** | 12px | 600 (SemiBold) | 1.0 | 버튼, 탭 레이블 |

---

## 4. 스페이싱 시스템

> 기준 단위: **4px**

| 토큰 | 값 | 용도 |
|------|-----|------|
| `spacing-1` | 4px | 아이콘-텍스트 간격 |
| `spacing-2` | 8px | 태그 내부 패딩 |
| `spacing-3` | 12px | 카드 내부 요소 간격 |
| `spacing-4` | 16px | 카드 패딩, 기본 여백 |
| `spacing-5` | 20px | 섹션 내부 패딩 |
| `spacing-6` | 24px | 섹션 간 간격 |
| `spacing-8` | 32px | 페이지 상단 여백 |

**페이지 기본 좌우 패딩**: `20px`

---

## 5. 보더 레이디어스

| 토큰 | 값 | 용도 |
|------|-----|------|
| `radius-sm` | 8px | 인풋 필드, 작은 버튼 |
| `radius-md` | 12px | 작은 카드, 배지 |
| `radius-lg` | 16px | 코치 카드, 일반 카드 |
| `radius-xl` | 20px | 모달, 바텀시트 상단 |
| `radius-full` | 9999px | CTA 버튼 (pill 형태), 아바타 |

---

## 6. 컴포넌트 명세

### 6.1 Bottom Navigation Bar (플로팅 라운딩)
```
형태: 플로팅 캡슐형 (position:absolute, bottom:20px, left/right:16px)
높이: 60px
border-radius: 30px
배경: White (#fff)
보더: 1px solid var(--gray-100)
그림자: 0 2px 16px rgba(0,0,0,0.1)
아이콘: 18px 이모지
레이블: 9px, 활성(Courtside Green, Bold), 비활성(Gray-400, SemiBold)
디바이스 배경: var(--gray-50) — 네비 뒤 배경과 자연스럽게 통합

수강생/비로그인: 🏠홈 / 💬메시지 / 🔍검색 / 👤마이
코치 전용:       📅스케줄 / 💬메시지 / 🔍검색 / 👤마이

※ 기존 전체 너비 + 상단 border 방식에서 변경 (v2)
```

### 6.1a 레슨 스케줄 슬롯 카드
```
배경: White (#fff)
보더: 1px solid var(--gray-100) — 전체 테두리 (상태별 색상 구분 없음)
border-radius: 12px (radius-md)
상태 구분: 우측 배지(badge-sm)로만 구분
좌측 세로 보더 사용 안 함

※ 기존 좌측 컬러 보더 + 상태별 배경색 방식에서 변경 (v2)
```

### 6.1b 전체 스케줄 타임테이블
```
형태: 풀팝업 (top-nav + flex column)
시간 범위: 06:00 ~ 22:00 (10분 단위, 96행)
컬럼: 월~일 (7열) + 시간 라벨 (좌측 40px)
셀 높이: 40px
가로 구분선: 정시 — 2px solid var(--gray-300), 10분 — 1px solid var(--gray-300)
세로 구분선: 2px solid var(--gray-300) (border-right)
시간 라벨: 11px, 정시 — Navy bold, 10분 — gray-400
현재 시간 하이라이트: 코랄 반투명 배경 rgba(255,107,107,0.08) + 라벨 코랄 bold + ◀
빈 슬롯 선택: 초록 배경 (#D1FAE5)
하단 플로팅 바: 네이비 배경, border-radius 14px, absolute bottom 16px
상단 토스트: sticky top, 흰색 배경 + shadow

※ v2에서 추가
```

### 6.2 코치 카드 (Coach Card)
```
배경: White
보더 레이디어스: radius-lg (16px)
그림자: 0 2px 12px rgba(0,0,0,0.08)
구성:
  - 프로필 사진: 56x56px, radius-full
  - 코치명: Heading 3
  - 위치 + 전문분야: Body Small, #6B7280
  - 평점: Yellow ★ + 숫자
  - 구독 배지: Purple(프리미엄) / Sky Blue(무료)
  - 레슨 신청 버튼: radius-full, Courtside Green
```

### 6.3 레슨 신청 카드 (Booking Card)
> Habitz 습관 카드 스타일 참고 — 컬러 배경 + 흰색 텍스트

```
배경: Coral(정규) / Orange(쿠폰)
보더 레이디어스: radius-lg (16px)
구성:
  - 레슨 유형 + 코치명: White, Heading 3
  - 상태 배지: 우측 상단 (Pending/Confirmed/Completed)
  - D-day 카운터: Caption, White 70%
  - 토글/체크: 우측
```

### 6.4 CTA 버튼 (Primary Button)
```
배경: Courtside Green (#2DD4BF)
텍스트: White, Label(12px, SemiBold)
높이: 52px
보더 레이디어스: radius-full (pill)
너비: 100% (full-width, 좌우 padding 20px)
상태:
  - Hover: 10% 어두워짐
  - Disabled: #D1D5DB 배경, #9CA3AF 텍스트
```

### 6.5 인풋 필드 (Input Field)
```
배경: #F5F5F7
보더: 1px solid #E5E7EB
보더 레이디어스: radius-sm (8px)
높이: 48px
패딩: 0 16px
포커스 보더: Courtside Green
텍스트: Body(15px), #1E3A5F
플레이스홀더: #9CA3AF
```

### 6.6 동기부여 배너 (Motivation Banner)
> Habitz 보라색 배너 스타일 참고

```
배경: Purple (#7C5CBF) 또는 Coral 그라디언트
보더 레이디어스: radius-lg (16px)
구성:
  - 이모지/캐릭터 아이콘: 좌측 40x40px
  - 메시지 텍스트: White, Body(15px)
  - CTA 링크: White, Caption, 밑줄
```

### 6.7 구독 플랜 배지 (Subscription Badge)
```
Free:    배경 #EFF6FF, 텍스트 #3B82F6, "FREE"
Monthly: 배경 #F3E8FF, 텍스트 #7C5CBF, "PRO"
Annual:  배경 #FFF7ED, 텍스트 #EA580C, "ANNUAL"
크기: padding 4px 8px, radius-md, Caption(11px, SemiBold)
```

### 6.8 평점 & 리뷰 표시
```
별 아이콘: Yellow (#F9C846), 16x16px
평점 숫자: Body Small, #1E3A5F, SemiBold
리뷰 수: Body Small, #6B7280
예: ★ 4.8 (리뷰 32개)
```

### 6.9 섹션 헤더 (Section Header)
```
구성: 타이틀(Heading 2) + 전체보기(Body Small, Courtside Green)
마진 하단: spacing-3 (12px)
```

### 6.10 빈 상태 (Empty State)
```
중앙 정렬, 아이콘(48px) + 메시지(Body) + CTA 버튼
배경: 투명
```

---

## 7. 화면별 레이아웃

### 7.1 홈 화면
```
├── 상단 배너 (동적, DB 연동)         — 높이 160px
├── 검색바 (지역 + 성별 필터)
├── [섹션] 우리동네 코치님             — 가로 스크롤 카드
├── [섹션] 지금 핫한 코치님            — 가로 스크롤 카드
├── [섹션] 신규등록 코치님             — 가로 스크롤 카드
└── 코치 등록 유도 배너
```

### 7.2 코치 목록 페이지
```
├── 필터 바 (가로 스크롤 칩)
└── 코치 카드 리스트 (세로 스크롤)
```

### 7.3 코치 상세 페이지
```
├── 프로필 이미지 (히어로)
├── 코치 정보 (이름, 위치, 평점, 배지)
├── 소개
├── 전문분야 / 경력
├── 자격증
├── 레슨 가격
├── 리뷰 목록
└── 하단 고정 버튼: [문의하기] [레슨신청]
```

### 7.4 레슨 신청 플로우 (Step UI)
```
Step 1: 유형 선택 (정규레슨 / 쿠폰레슨)
Step 2: 세부 항목 (횟수, 형태)
Step 3: 요일·시간 선택
Step 4: 신청 확인 + 제출
```

---

## 8. 아이콘 & 일러스트 가이드

- **아이콘 라이브러리**: [Lucide Icons](https://lucide.dev) (line style, 24px 기준)
- **일러스트 스타일**: Habitz 참고 — 카와이(Kawaii) 감성의 심플한 캐릭터/이모지 사용 가능 (온보딩, 빈 상태, 배너)
- **프로필 사진**: 원형(radius-full) 처리, 기본 아바타는 테니스 라켓 모양 placeholder

---

## 9. 모션 & 인터랙션

| 요소 | 애니메이션 |
|------|-----------|
| 페이지 전환 | slide (수평, 300ms ease) |
| 바텀시트 | slide-up (250ms ease-out) |
| 버튼 탭 | scale 0.97, 100ms |
| 카드 등장 | fade-up, 200ms stagger |
| 토글 | 200ms ease |

---

## 10. 다크모드

MVP에서는 **라이트 모드만** 지원. 다크모드는 v2 이후 검토.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-04-09 | Habitz 레퍼런스 분석 기반 초안 작성 |
