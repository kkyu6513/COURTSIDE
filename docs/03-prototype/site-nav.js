/**
 * COURTSIDE 프로토타입 — 전체 화면 사이트맵 네비게이션
 * 모든 HTML 파일에서 <script src="../site-nav.js"></script> 로 로드
 * 좌측에 접이식 하이어라키 구조로 전체 화면 이동 가능
 */

(function() {
  const basePath = (function() {
    const path = window.location.pathname;
    if (path.includes('/flow1-onboarding/')) return '../';
    if (path.includes('/flow2-home/')) return '../';
    if (path.includes('/flow3-booking/')) return '../';
    if (path.includes('/flow4-chat/')) return '../';
    if (path.includes('/flow5-payment/')) return '../';
    if (path.includes('/flow6-student-my/')) return '../';
    if (path.includes('/flow7-coach-my/')) return '../';
    if (path.includes('/flow8-review-notify/')) return '../';
    if (path.includes('/flow9-admin/')) return '../';
    return '';
  })();

  const siteMap = [
    {
      title: 'Flow 1. 온보딩',
      icon: '🔐',
      items: [
        { label: '1-1 스플래시', path: 'flow1-onboarding/1-1-splash.html' },
        { label: '1-2 로그인', path: 'flow1-onboarding/1-2-login.html' },
        { label: '1-2b 회원가입', path: 'flow1-onboarding/1-2b-signup.html' },
        { label: '1-3 역할선택', path: 'flow1-onboarding/1-3-role-select.html' },
        { label: '1-4 학생프로필', path: 'flow1-onboarding/1-4-student-profile.html' },
        { label: '1-4b 학생완료', path: 'flow1-onboarding/1-4b-signup-complete.html' },
        { label: '1-5 구독선택', path: 'flow1-onboarding/1-5-coach-subscription.html' },
        { label: '1-6 코치프로필', path: 'flow1-onboarding/1-6-coach-profile.html' },
        { label: '1-6b 코치완료', path: 'flow1-onboarding/1-6b-coach-complete.html' },
        { label: '1-7 스케줄등록', path: 'flow1-onboarding/1-7-schedule-register.html' },
        { label: '약관상세', path: 'flow1-onboarding/terms-detail.html?code=TERMS_OF_SERVICE' },
      ]
    },
    {
      title: 'Flow 2. 홈/탐색',
      icon: '🏠',
      items: [
        { label: '2-1 홈', path: 'flow2-home/2-1-home.html' },
        { label: '2-2 코치목록', path: 'flow2-home/2-2-coach-list.html' },
        { label: '2-3 코치상세', path: 'flow2-home/2-3-coach-detail.html' },
        { label: '2-3a 리뷰목록', path: 'flow2-home/2-3a-reviews.html' },
      ]
    },
    {
      title: 'Flow 3. 레슨신청',
      icon: '📋',
      items: [
        { label: '3-1 레슨선택', path: 'flow3-booking/3-1-type-select.html' },
        { label: '3-4 확인제출', path: 'flow3-booking/3-4-confirm.html' },
        { label: '3-5 신청완료', path: 'flow3-booking/3-5-complete.html' },
      ]
    },
    {
      title: 'Flow 4. 채팅',
      icon: '💬',
      items: [
        { label: '4-1 채팅목록', path: 'flow4-chat/4-1-chat-list.html' },
        { label: '4-2 1:1채팅', path: 'flow4-chat/4-2-chat.html' },
      ]
    },
    {
      title: 'Flow 5. 결제',
      icon: '💳',
      items: [
        { label: '5-1 결제정보', path: 'flow5-payment/5-1-payment.html' },
        { label: '5-2 결제완료', path: 'flow5-payment/5-2-complete.html' },
      ]
    },
    {
      title: 'Flow 6. 수강생마이',
      icon: '👤',
      items: [
        { label: '6-1 비로그인', path: 'flow6-student-my/6-1-guest.html' },
        { label: '6-2 마이페이지', path: 'flow6-student-my/6-2-mypage.html' },
        { label: '6-3 프로필수정', path: 'flow6-student-my/6-3-profile-edit.html' },
        { label: '6-4 테니스정보', path: 'flow6-student-my/6-4-tennis-info.html' },
        { label: '6-5 신청내역', path: 'flow6-student-my/6-5-booking-list.html' },
        { label: '6-6 신청상세', path: 'flow6-student-my/6-6-booking-detail.html' },
        { label: '6-7 찜코치', path: 'flow6-student-my/6-7-favorites.html' },
      ]
    },
    {
      title: 'Flow 7. 코치마이',
      icon: '🏅',
      items: [
        { label: '7-0 스케줄홈', path: 'flow7-coach-my/7-0-schedule-home.html' },
        { label: '7-1 코치마이', path: 'flow7-coach-my/7-1-coach-mypage.html' },
        { label: '7-2 신청수신', path: 'flow7-coach-my/7-2-booking-inbox.html' },
        { label: '7-3 수락거절', path: 'flow7-coach-my/7-3-booking-action.html' },
        { label: '7-5 구독관리', path: 'flow7-coach-my/7-5-subscription.html' },
        { label: '7-6 예약현황', path: 'flow7-coach-my/7-6-bookings.html' },
        { label: '7-7 리뷰현황', path: 'flow7-coach-my/7-7-reviews.html' },
        { label: '7-8 레슨이력', path: 'flow7-coach-my/7-8-lesson-history.html' },
        { label: '7-9 통계', path: 'flow7-coach-my/7-9-stats.html' },
      ]
    },
    {
      title: 'Flow 8. 리뷰/알림',
      icon: '🔔',
      items: [
        { label: '8-1 리뷰작성', path: 'flow8-review-notify/8-1-review-write.html' },
        { label: '8-2 알림목록', path: 'flow8-review-notify/8-2-notify-list.html' },
        { label: '8-3 알림설정', path: 'flow8-review-notify/8-3-notify-settings.html' },
      ]
    },
    {
      title: 'Flow 9. 관리자',
      icon: '⚙️',
      items: [
        { label: '9-1 대시보드', path: 'flow9-admin/9-1-dashboard.html' },
        { label: '9-2 회원관리', path: 'flow9-admin/9-2-users.html' },
        { label: '9-3 코치검증', path: 'flow9-admin/9-3-coach-verify.html' },
        { label: '9-4 배너관리', path: 'flow9-admin/9-4-banners.html' },
        { label: '9-5 구독플랜', path: 'flow9-admin/9-5-subscription-plans.html' },
        { label: '9-6 코드관리', path: 'flow9-admin/9-6-code-manage.html' },
        { label: '9-7 약관관리', path: 'flow9-admin/9-7-terms.html' },
        { label: '9-8 신고관리', path: 'flow9-admin/9-8-reports.html' },
      ]
    }
  ];

  // 현재 페이지 경로
  const currentPath = window.location.pathname;

  // 현재 페이지가 속한 Flow 찾기
  let currentFlow = -1;
  siteMap.forEach((flow, fi) => {
    flow.items.forEach(item => {
      if (currentPath.includes(item.path.split('?')[0])) currentFlow = fi;
    });
  });

  // 스타일 주입
  const style = document.createElement('style');
  style.textContent = `
    #site-nav-toggle {
      position: fixed; top: 50%; left: 0; transform: translateY(-50%);
      width: 28px; height: 56px; background: rgba(91,74,138,0.9); color: #fff;
      border: none; border-radius: 0 8px 8px 0; cursor: pointer; z-index: 9999;
      font-size: 14px; display: flex; align-items: center; justify-content: center;
      box-shadow: 2px 0 8px rgba(0,0,0,0.2); transition: left 0.3s;
    }
    #site-nav-panel {
      position: fixed; top: 0; left: -260px; width: 260px; height: 100vh;
      background: #1E3A5F; color: #fff; z-index: 9998; overflow-y: auto;
      transition: left 0.3s ease; box-shadow: 4px 0 20px rgba(0,0,0,0.3);
      font-family: 'Pretendard', -apple-system, sans-serif;
    }
    #site-nav-panel.open { left: 0; }
    #site-nav-toggle.open { left: 260px; }
    #site-nav-panel::-webkit-scrollbar { width: 4px; }
    #site-nav-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
    .snav-header {
      padding: 20px 16px 12px; font-size: 15px; font-weight: 800;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      display: flex; align-items: center; gap: 8px;
    }
    .snav-flow {
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .snav-flow-title {
      padding: 10px 16px; font-size: 12px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; gap: 6px;
      color: rgba(255,255,255,0.5); transition: color 0.15s;
    }
    .snav-flow-title:hover { color: rgba(255,255,255,0.8); }
    .snav-flow-title.active { color: #2DD4BF; }
    .snav-flow-title .arrow { margin-left: auto; font-size: 10px; transition: transform 0.2s; }
    .snav-flow-title.expanded .arrow { transform: rotate(90deg); }
    .snav-items { display: none; padding: 0 0 6px; }
    .snav-items.show { display: block; }
    .snav-item {
      display: block; padding: 7px 16px 7px 32px; font-size: 12px;
      color: rgba(255,255,255,0.5); text-decoration: none; transition: all 0.1s;
      border-left: 2px solid transparent; margin-left: 14px;
    }
    .snav-item:hover { color: #fff; background: rgba(255,255,255,0.05); }
    .snav-item.current {
      color: #2DD4BF; font-weight: 700; border-left-color: #2DD4BF;
      background: rgba(45,212,191,0.08);
    }
  `;
  document.head.appendChild(style);

  // 토글 버튼
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'site-nav-toggle';
  toggleBtn.textContent = '☰';
  document.body.appendChild(toggleBtn);

  // 패널
  const panel = document.createElement('div');
  panel.id = 'site-nav-panel';

  let html = '<div class="snav-header">🎾 COURTSIDE<span style="font-size:11px;font-weight:400;opacity:0.5;">Sitemap</span></div>';

  // 공통 링크 (작업 현황표, 상태 흐름도)
  html += '<div style="padding:8px 16px;display:flex;flex-direction:column;gap:6px;border-bottom:1px solid rgba(255,255,255,0.06);">';
  html += '<a href="' + basePath + 'project-status.html" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,0.08);color:#fff;text-decoration:none;font-size:12px;font-weight:600;">📊 작업 현황표</a>';
  html += '<a href="' + basePath + 'status-flow.html" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,0.08);color:#fff;text-decoration:none;font-size:12px;font-weight:600;">상태 흐름도</a>';
  html += '</div>';

  siteMap.forEach((flow, fi) => {
    const isCurrentFlow = fi === currentFlow;
    html += '<div class="snav-flow">';
    html += '<div class="snav-flow-title' + (isCurrentFlow ? ' active expanded' : '') + '" onclick="toggleFlow(this)">';
    html += '<span>' + flow.icon + '</span> ' + flow.title;
    html += '<span class="arrow">›</span></div>';
    html += '<div class="snav-items' + (isCurrentFlow ? ' show' : '') + '">';

    flow.items.forEach(item => {
      const href = basePath + item.path;
      const isCurrent = currentPath.includes(item.path.split('?')[0]);
      html += '<a class="snav-item' + (isCurrent ? ' current' : '') + '" href="' + href + '">' + item.label + '</a>';
    });

    html += '</div></div>';
  });

  panel.innerHTML = html;
  document.body.appendChild(panel);

  // 토글 동작
  toggleBtn.addEventListener('click', function() {
    panel.classList.toggle('open');
    toggleBtn.classList.toggle('open');
    toggleBtn.textContent = panel.classList.contains('open') ? '✕' : '☰';
  });

  // Flow 접기/펼치기
  window.toggleFlow = function(el) {
    el.classList.toggle('expanded');
    const items = el.nextElementSibling;
    items.classList.toggle('show');
  };

})();
