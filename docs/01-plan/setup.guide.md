# COURTSIDE 개발 환경 셋업 가이드

> Sprint 1 시작 전 사용자가 직접 수행할 외부 서비스 셋업 + 로컬 환경 가이드

## 0. 환경 표준 (확정)

- **Node.js 20 LTS** (https://nodejs.org)
- **패키지 매니저**: pnpm (`npm i -g pnpm`)
- **에디터**: VSCode + 확장 (Tailwind CSS IntelliSense, Prisma, ESLint, Prettier)
- **터미널**: macOS Terminal / iTerm2 / Windows Terminal

## 1. Sprint 1에서 즉시 필요 — Supabase

### 1-1. 프로젝트 생성
1. https://supabase.com 가입 (GitHub 연동 추천)
2. **New project** 클릭
   - Name: `courtside`
   - Database Password: **강력하게 설정 후 별도 저장** (DB connection string에 들어감)
   - Region: **Northeast Asia (Seoul) — `ap-northeast-2`**
   - Pricing Plan: Free (1차 출시 충분)
3. 프로젝트 생성 완료 대기 (약 2분)

### 1-2. 키 / URL 복사 (4개)
**Project Settings → API**:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (서버 전용, 외부 노출 금지)

**Project Settings → Database → Connection string**:
- Mode: **Session** 탭 선택
- `URI` 형식 복사 → `DATABASE_URL`
- 패스워드 부분 `[YOUR-PASSWORD]` 를 1-1에서 저장한 값으로 치환

### 1-3. 소셜 로그인 Provider 활성화

**Authentication → Providers** 에서 Kakao / Naver 토글 ON.

#### Kakao
1. https://developers.kakao.com 가입
2. **내 애플리케이션 → 애플리케이션 추가** → 이름 `COURTSIDE`
3. **요약 정보** → `REST API 키` 복사
4. **카카오 로그인** 메뉴 → 활성화 ON
5. **Redirect URI** 등록: `https://<project-ref>.supabase.co/auth/v1/callback`
6. **동의 항목** → 닉네임/프로필 사진/이메일 (선택)
7. Supabase Kakao Provider 설정:
   - Client ID: REST API 키
   - Client Secret: 카카오 로그인 → 보안 → 시크릿 키 (생성 필요)

#### Naver
1. https://developers.naver.com 로그인 → **Application → 애플리케이션 등록**
2. 이름 `COURTSIDE`, 사용 API: **네이버 로그인**
3. 서비스 URL: `https://courtside.vercel.app` (Vercel 배포 후 확정)
4. Callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`
5. Client ID / Secret 복사
6. Supabase Naver Provider 설정에 입력

**완료 산출물**: `.env.local` 에 들어갈 5개 값 확보

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres
```

## 2. Sprint 1 — Vercel 연결

1. https://vercel.com 가입 (GitHub 연동)
2. **Add New → Project** → `kkyu6513/COURTSIDE` 선택
3. **Framework Preset**: Next.js 자동 감지
4. **Root Directory**: `./` (모노레포 아님)
5. **Environment Variables**: 1-2에서 복사한 5개 입력
6. **Deploy** → 첫 빌드는 코드가 아직 없어서 실패해도 OK (Next.js 셋업 후 자동 재배포)

생성될 URL: `https://courtside.vercel.app` (또는 `courtside-kkyu6513.vercel.app`)

## 3. Sprint 2 — 토스페이먼츠 (Sprint 1 끝까지 준비)

코치 구독 결제 PG. **사업자등록증 필요** — 준비 시간 5~7일.

1. https://www.tosspayments.com 가맹 신청
2. **개인사업자** 또는 **법인** 선택
3. 서류 제출: 사업자등록증, 통장 사본, 대표자 신분증
4. 심사 완료 → 테스트 키 즉시 발급
5. 실 결제는 사업자 검증 후 활성화

**Sprint 1에서 할 일**: 가맹 신청만 (Sprint 2 시작 시점에 키 사용)

## 4. Sprint 3 — Solapi 알림톡 (Sprint 2 끝까지 준비)

카카오 알림톡 발송. 카카오 비즈채널 별도 필요.

1. https://solapi.com 가입
2. **카카오 비즈채널** 등록
   - https://business.kakao.com 카카오 비즈니스 가입 (개인사업자 가능)
   - 채널 개설 → 채널명 `COURTSIDE`
   - 채널 인증 (사업자등록증 필요)
3. Solapi에서 비즈채널 연동
4. 발신번호 등록 (사업자 명의 휴대폰)
5. 알림톡 템플릿 18개 등록 (`docs/02-design/alimtalk-templates.md` 기반)
6. API 키 발급 → `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`

**Sprint 1~2에서 할 일**: 카카오 비즈채널 + Solapi 가입까지

## 5. 셋업 체크리스트 (Sprint 1 시작 전)

- [ ] Node 20 LTS 설치
- [ ] pnpm 글로벌 설치
- [ ] Supabase 프로젝트 생성
- [ ] Supabase 키 4개 + DB URL 확보
- [ ] Kakao Developers OAuth 등록
- [ ] Naver Developers OAuth 등록
- [ ] Supabase에 Kakao/Naver Provider 활성화
- [ ] GitHub → Vercel 프로젝트 연결
- [ ] Vercel Environment Variables 5개 입력
- [ ] (병행) 토스페이먼츠 가맹 신청

## 6. Sprint 1 시작 이후 (내가 작업)

위 체크리스트 완료되면 알려주세요. 그 다음 내가 작업할 것:

1. `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`
2. `prisma/schema.prisma` (database-schema.md 기반)
3. `app/layout.tsx`, `app/page.tsx` 기본 골격
4. `lib/supabase/client.ts`, `lib/supabase/server.ts` (클라이언트 분리)
5. `.env.example` (실제 키 없이 키 이름만)
6. ESLint/Prettier/Tailwind 설정
7. `npx prisma db push` 로 Supabase에 스키마 적용
8. Vercel preview 배포 확인

## 7. 비용 (1차 출시 기준)

| 항목 | 무료 한도 | 유료 시작 |
|------|----------|----------|
| Supabase | 500MB DB, 1GB Storage, 50K MAU | $25/월 (Pro) |
| Vercel | 100GB bandwidth | $20/월 (Pro) |
| 토스페이먼츠 | — | 카드 결제 수수료 2.7~3.3% |
| Solapi | — | 알림톡 건당 ~10원 |
| 카카오 비즈채널 | 무료 | — |
| 도메인 (선택) | — | 1~2만원/년 |

**초기 운영비**: 무료 ~ 월 5만원 수준 (베타 단계)
