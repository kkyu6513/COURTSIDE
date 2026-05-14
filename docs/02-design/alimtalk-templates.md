# 카카오 알림톡 템플릿 정의서

> COURTSIDE — 테니스 코치 매칭 O2O 서비스
> 카카오 비즈메시지 API 기반 알림톡 템플릿 관리 문서

---

## 1. 발송 정책

```
채널: 카카오 알림톡 (비즈메시지 API)
발신 프로필: COURTSIDE (카카오톡 채널)
발송 조건: NotificationSetting 해당 항목 = true일 때만 발송
대체 발송: 알림톡 실패 시 앱 내 알림(Notification 테이블)으로 대체 저장
변수 표기: #{변수명} — 서버에서 동적 치환
버튼 타입: 웹링크 (앱 딥링크 URL scheme)
```

---

## 2. 템플릿 목록

| # | 템플릿 코드 | 카테고리 | 수신자 | 발송 시점 | 설정 항목 |
|---|------------|----------|--------|----------|----------|
| 1 | BOOKING_REQUEST | 예약 | 코치 | 수강생 레슨 신청 시 | bookingAlert |
| 2 | BOOKING_CONFIRMED | 예약 | 수강생 | 코치 수락 시 | bookingAlert |
| 3 | BOOKING_REJECTED | 예약 | 수강생 | 코치 거절 시 | bookingAlert |
| 4 | BOOKING_ON_HOLD | 예약 | 수강생 | 코치 보류 시 | bookingAlert |
| 5 | BOOKING_PROPOSAL | 예약 | 수강생 | 코치 대체 일정 제안 시 | bookingAlert |
| 6 | BOOKING_CANCELLED | 예약 | 상대방 | 취소 시 | bookingAlert |
| 6 | LESSON_REMINDER | 레슨 | 수강생 + 코치 | 레슨 D-1 09:00 | lessonReminder |
| 7 | PENDING_CONFIRM_REMINDER | 예약 | 코치 | 희망 레슨일 D-2 (미결제+미확정) | bookingAlert |
| 8 | PENDING_CONFIRM_FINAL | 예약 | 코치 + 수강생 | 희망 레슨일 D-1 (미결제+미확정) | bookingAlert |
| 7 | RESCHEDULE_REQUEST | 스케줄 변경 | 코치 | 수강생 변경 요청 시 | bookingAlert |
| 8 | RESCHEDULE_PROPOSED | 스케줄 변경 | 수강생 | 코치 "모두 제안하기" 시 | bookingAlert |
| 9 | RESCHEDULE_UNAVAILABLE | 스케줄 변경 | 수강생 | 코치 "불가 알림 보내기" 시 | bookingAlert |
| 10 | RESCHEDULE_ACCEPTED | 스케줄 변경 | 코치 | 수강생 제안 수락 시 | bookingAlert |
| 11 | RESCHEDULE_COMPLETED | 스케줄 변경 | 수강생 | 일정 변경 확정 시 | bookingAlert |
| 12 | RESCHEDULE_REJECTED_BY_STUDENT | 스케줄 변경 | 코치 | 수강생 제안 거절 시 | bookingAlert |
| 13 | RESCHEDULE_HOLD_EXPIRED | 스케줄 변경 | 코치 | 홀드 12시간 만료 시 | 항상 |
| 14 | CHAT_MESSAGE | 채팅 | 상대방 | 새 메시지 수신 시 | chatMessage |
| 15 | SUBSCRIPTION_RENEW | 구독 | 코치 | 구독 갱신 3일 전 | 항상 |
| 16 | SUBSCRIPTION_EXPIRE | 구독 | 코치 | 구독 만료 시 | 항상 |
| 17 | VERIFY_APPROVED | 검증 | 코치 | 검증 승인 시 | 항상 |
| 18 | VERIFY_REJECTED | 검증 | 코치 | 검증 반려 시 | 항상 |
| 19 | MAKEUP_MERGE_PROPOSED | 회차 조정 | 수강생 | 코치 회차 통합 제안 시 (FR-14m) | bookingAlert |
| 20 | MAKEUP_SPLIT_PROPOSED | 회차 조정 | 수강생 | 코치 회차 분할 제안 시 (FR-14m) | bookingAlert |
| 21 | MAKEUP_ADJUSTMENT_CONFIRMED | 회차 조정 | 코치 | 수강생 통합/분할 수락 시 (FR-14m) | bookingAlert |
| 22 | STUDENT_SELF_CLAIM | 가입/매칭 | 코치 | 학생이 가입 시 본인을 코치로 지정 + 매칭 성공 | 항상 |

### STUDENT_SELF_CLAIM (학생 셀프 신청 알림)

**수신자**: 코치 (매칭 성공한 코치)
**발송 시점**: 학생이 프로필 등록 화면에서 코치 이름/번호 입력 후 "등록 완료" 클릭, 시스템이 입력 번호로 코치를 찾아 매칭 성공 시
**현재 채널**: SMS (Solapi `type: SMS`) — 카카오 알림톡 비즈채널 템플릿 승인 완료 시 ATA로 전환
**설정 항목**: 항상 (사용자가 딠 수 없음 — 핵심 운영 알림)

**메시지 본문** (`lib/notification.ts → buildStudentClaimMessage`):
```
[COURTSIDE]

#{학생명}님이 회원님을 본인의 코치로 지정해 가입을 완료했어요.

▶ 마이페이지 → 학생 관리 → 대기 신청 확인
학생을 본인 명단에 등록하면 자동으로 연결됩니다.
```

**변수**:
- `#{학생명}`: 학생의 닉네임(카카오) 또는 이메일

**API 호출**:
- `submitStudentProfile` Server Action 내부에서 `sendSms()` 호출 (fire-and-forget)
- 결과는 `student_self_claims.notifiedAt / notifyAttempts / notifyLastError`에 기록

**미발송 케이스** (`student_self_claims.notifyLastError`에 사유 기록):
- `SKIPPED: ENV_NOT_SET` — Solapi 환경변수 미설정 (Vercel)
- HTTP/네트워크 에러 — Solapi API 응답 메시지 그대로 기록

---

## (이하 기존 템플릿 세부는 origin 본문에서 계속 이어짐)
