export type FeatureInfo = {
  title: string;
  description: string;
};

// 코치 플랜 카드의 각 feature code 별 친절한 설명 (클릭 시 안내 팝업에 표시)
export const FEATURE_INFO: Record<string, FeatureInfo> = {
  // 🆓 무료 플랜
  STUDENT_3: {
    title: "학생 3명까지 관리",
    description:
      "동시에 등록 가능한 학생 수가 3명까지로 제한됩니다. 학생을 졸업 처리(보관)하면 새 학생을 추가할 수 있어요. 무제한 관리는 PRO 플랜에서 제공돼요.",
  },
  SCHEDULE: {
    title: "스케줄 등록",
    description:
      "주간 캘린더에 가용 시간을 등록하고, 학생별 레슨을 직접 추가/이동할 수 있어요. 한 주에 몇 개를 만들든 제한이 없습니다.",
  },
  CHAT: {
    title: "1:1 채팅",
    description:
      "학생 한 명 한 명과 앱 내에서 1:1로 메시지를 주고받을 수 있어요. 보강·변경 요청, 사진/영상 공유 등이 가능합니다.",
  },
  ALIMTALK_30: {
    title: "알림톡 월 30건",
    description:
      "카카오 알림톡(레슨 확정, 보강 안내, 결제 요청 등)을 한 달에 30건까지 발송할 수 있어요. 30건을 초과하면 다음 달 1일까지 발송이 제한됩니다. 무제한은 PRO에서 제공돼요.",
  },

  // 💎 월간 PRO
  STUDENT_UNLIMITED: {
    title: "학생 무제한 관리",
    description:
      "등록 가능한 학생 수에 제한이 없어요. 100명, 200명까지 늘어나도 추가 비용 없이 그대로 관리할 수 있어요.",
  },
  ALIMTALK_UNLIMITED: {
    title: "알림톡 무제한 발송",
    description:
      "카카오 알림톡을 발송 건수 제한 없이 사용할 수 있어요. 레슨 알림·결제 요청·공지를 자유롭게 보낼 수 있습니다.",
  },
  AUTO_REGULAR: {
    title: "정기 레슨 자동 생성",
    description:
      "매주 같은 요일·같은 시간에 반복되는 정기 레슨을 자동으로 생성해주는 기능이에요. 한 번 설정하면 매주 일정이 자동으로 채워지므로 캘린더 관리가 훨씬 편해집니다. 무료 플랜에서는 사용할 수 없어요.",
  },
  STATS: {
    title: "통계 대시보드",
    description:
      "월별 매출, 학생별 출석률, 회차 소진 현황 등 운영에 필요한 지표를 한눈에 볼 수 있어요. 무료 플랜에서는 사용할 수 없습니다.",
  },
  MEMBER_SEARCH: {
    title: "회원 검색·정렬",
    description:
      "이름·전화번호로 학생을 빠르게 찾고, 등록일·잔여 회차·최근 레슨 등 다양한 기준으로 정렬할 수 있어요. 학생 수가 많아질수록 빛을 발하는 기능입니다.",
  },
  PRO_BADGE: {
    title: "PRO 배지",
    description:
      "코치 프로필에 PRO 배지가 표시돼요. 학생들에게 신뢰감을 주고, 검색·추천 노출에 우대 가산점이 부여됩니다.",
  },

  // 🏆 연간 PRO
  ALL_MONTHLY: {
    title: "월간 PRO 전체 기능",
    description:
      "월간 PRO에서 제공하는 모든 기능(학생 무제한, 알림톡 무제한, 정기 레슨, 통계, 회원 검색, PRO 배지)이 그대로 포함돼요.",
  },
  CSV_EXPORT: {
    title: "레슨 이력 CSV 내보내기",
    description:
      "학생별 레슨 이력, 결제 내역을 CSV 파일로 내려받아 엑셀·구글시트 등에서 자유롭게 분석할 수 있어요. 세무 신고·연말 정산에도 활용됩니다.",
  },
  PRIORITY_SUPPORT: {
    title: "우선 고객 지원 (카톡 1:1)",
    description:
      "카카오톡 1:1 채널로 빠르게 문의할 수 있어요. 일반 문의보다 응답 우선순위가 높아 평균 응답 시간이 절반 이하로 단축됩니다.",
  },
  VERIFY_PRIORITY: {
    title: "인증 배지 우선 심사",
    description:
      "코치 인증 배지(자격증·경력 검증) 신청 시 일반 회원보다 먼저 심사돼요. 평균 심사 기간이 절반 이하로 줄어듭니다.",
  },
  ANNUAL_BADGE: {
    title: "ANNUAL 배지",
    description:
      "PRO 배지에 더해 ANNUAL 배지가 추가로 표시돼요. 장기 운영 코치임을 학생에게 어필할 수 있고, 추천 노출에 추가 가산점이 부여됩니다.",
  },
};
