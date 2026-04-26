(function () {
  var sidebar = document.querySelector('.admin-sidebar');
  if (!sidebar) return;

  // 1. 사이드바 오버레이 주입
  var overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  // 2. 모바일 헤더 주입
  var logoEl = sidebar.querySelector('.logo');
  var logoText = logoEl ? logoEl.textContent.trim() : '🎾 COURTSIDE Admin';
  var mobileHeader = document.createElement('div');
  mobileHeader.className = 'mobile-header';
  mobileHeader.innerHTML =
    '<button class="m-hamburger" id="sidebar-toggle" aria-label="메뉴">☰</button>' +
    '<span class="m-logo">' + logoText + '</span>';
  document.body.insertBefore(mobileHeader, document.body.firstChild);

  // 3. 햄버거 토글
  document.getElementById('sidebar-toggle').addEventListener('click', function () {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });
  overlay.addEventListener('click', function () {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });
  // 사이드바 내 링크 클릭 시 자동 닫기 (모바일)
  sidebar.querySelectorAll('.nav-link').forEach(function (link) {
    link.addEventListener('click', function () {
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      }
    });
  });

  // 4. 테이블 가로 스크롤 래퍼 자동 주입
  document.querySelectorAll('.admin-table').forEach(function (table) {
    if (!table.parentElement.classList.contains('admin-table-wrap')) {
      var wrap = document.createElement('div');
      wrap.className = 'admin-table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    }
  });
})();
