# 3. 구독 플랜 정책 (Coach SaaS, 2026-05-14 갱신)

> 본 문서는 `business-logic.md` 의 **3장 구독 플랜 정책**을 Coach SaaS 피벳(2026-05-08) 이후 기준으로 재작성한 버전입니다. 마켓플레이스 시절 정책(검색 상위 노출/신청 수신 한도)은 폐기되었습니다.

## 3.0 어드민 동적 관리

플랜의 가격·기능·한도는 모두 `subscription_plans` / `subscription_plan_features` 테이블에 저장됩니다. 어드민(또는 Supabase Studio)에서 값만 바꾸면 즉시 화면·정책에 반영되며 코드 배포는 불필요합니다.

운영 가이드: [`docs/01-plan/admin-supabase-guide.md`](../01-plan/admin-supabase-guide.md)

## 3.1 플랜별 기능 제한 (Coach SaaS 기준)

| 기능 | 🆓 Starter (FREE) | 💎 월간 PRO (MONTHLY) | 🏆 연간 PRO (YEARLY) |
|------|:--:|:--:|:--:|
| 가격 | ₩0 | ₩24,900/월 (첫 3개월 ₩9,900) | ₩16,900/월 (연 ₩202,800) |
| 학생 등록 한도 | **3명** | 무제한 | 무제한 |
| 스케줄 등록 | ✓ | ✓ | ✓ |
| 1:1 채팅 | ✓ | ✓ | ✓ |
| 결제 확인 (현금/계좌이체) | ✓ | ✓ | ✓ |
| 변경/보강 요청 처리 | ✓ (수동) | ✓ (제안 슬롯 자동) | ✓ (제안 슬롯 자동) |
| 알림톡 발송 | **월 30건** | 무제한 | 무제한 |
| 정기 레슨 자동 생성 | ✗ | ✓ | ✓ |
| 통계 대시보드 (매출·출석·회차) | ✗ | ✓ | ✓ |
| 회원 검색·정렬 | ✗ | ✓ | ✓ |
| 레슨 이력 CSV 내보내기 | ✗ | ✗ | ✓ |
| 우선 고객 지원 (카톡 1:1) | ✗ | ✗ | ✓ |
| 인증 배지 우선 심사 | ✗ | ✗ | ✓ |
| 배지 (어드민만 노출) | FREE | PRO | ANNUAL |

## 3.1a 구독 배지 노출 정책

```
PRO / ANNUAL / FREE 구독 배지:
  → 코치 상세 페이지에서 관리자(User.role = ADMIN)에게만 노출
  → 일반 사용자(수강생/코치/비로그인)에게는 미표시
  → 목적: 구독 플랜은 코치 내부 관리 정보이므로 수강생에게 공개하지 않음
  → 인증 배지(✓ 인증)는 모든 사용자에게 공개 (관리자 심사 완료 표시)
```

## 3.2 (폐기) 검색 상위 노출 로직

마켓플레이스 폐지로 검색 기능 자체 제거됨. Coach SaaS는 코치 검색이 자기 학생 관리 화면 안에서만 일어나므로(FR-12b-4) 정렬 우선순위 정책 불필요.

## 3.3 무료 플랜 학생 등록 한도

```
학생 등록 시 한도 체크:
  현재 코치의 활성 학생 수 = SELECT COUNT(*) FROM CoachStudentMapping
    WHERE coachId = {coachId} AND status = 'ACTIVE'

  현재 코치 플랜의 studentLimit = SELECT studentLimit FROM subscription_plans
    WHERE code = {coach.plan}  -- FREE: 3, MONTHLY/YEARLY: NULL(무제한)

  studentLimit != NULL && 현재 수 >= studentLimit:
    → 신규 등록 차단
    → 모달: "Starter 플랜은 학생 3명까지 관리할 수 있어요. PRO로 업그레이드하시면 무제한 등록이 가능합니다."
    → CTA: [업그레이드] → 1-5 플랜선택
```

## 3.3a 알림톡 월 발송 한도

```
알림톡 발송 시도 시 한도 체크:
  이번 달 발송 건수 = SELECT COUNT(*) FROM AlimtalkLog
    WHERE coachId = {coachId}
      AND status = 'SENT'
      AND createdAt >= DATE_TRUNC('month', NOW())

  현재 플랜의 alimtalkLimit = subscription_plans.alimtalkLimit
    (FREE: 30, PRO: NULL(무제한))

  alimtalkLimit != NULL && 이번 달 발송 >= alimtalkLimit:
    → 발송 큐에 hold + 코치에게 알림 ("이번 달 알림톡 한도 도달")
    → 다음 달 1일 00:00 자동 리셋
```

## 3.4 구독 자동 갱신

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

## 3.5 구독 해지 정책

```
해지 요청 시:
  autoRenew = false로 변경
  status는 ACTIVE 유지 (endDate까지 기능 사용 가능)
  endDate 이후 → status = EXPIRED → 무료 플랜으로 전환
```

## 3.6 첫 3개월 프로모션 (B+C 결정, 2026-05-14)

월간 PRO 플랜에 한해 **첫 결제 후 3개월간 ₩9,900** 적용. 4개월차부터 정상가 ₩24,900으로 자동 갱신.

```
가입 시 CoachSubscription 생성:
  plan = MONTHLY
  promotionEndDate = startDate + 3개월
  현재 결제액 = 9900 (프로모션)

  매월 결제 시:
    if NOW() < promotionEndDate → 9900 결제
    else → 24900 결제 (정상가 복귀)

  프로모션 자동 종료 알림 (D-3):
    → 코치에게 알림톡 "다음 결제부터 ₩24,900으로 정상 청구됩니다"
```

연간 PRO는 프로모션 미적용(이미 32% 할인 적용된 가격).
