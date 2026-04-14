/**
 * COURTSIDE — 시간 슬롯 공통 코드
 * 모든 시간 선택 화면에서 동일한 코드 체계로 사용
 *
 * 사용 화면:
 *   - 1-7-schedule-register.html (코치 스케줄 등록)
 *   - 3-1-type-select.html (레슨 신청 시간 선택)
 *   - 3-4-confirm.html (확인 화면 — 선택 시간 표시)
 *
 * 코드 규칙:
 *   code: "T" + HH + MM (예: T0900, T0930, T1400)
 *   label: "HH:MM" (예: "09:00", "09:30", "14:00")
 *   group: AM(오전 06~11) / PM(오후 12~17) / EVENING(저녁 18~22)
 *
 * DB 저장:
 *   Schedule.slotTime = label (HH:mm 형식)
 *   BookingSchedule.startTime = label
 */

const TIME_SLOTS = {
  // 오전 (06:00 ~ 11:50)
  AM: [
    { code: 'T0600', label: '06:00' }, { code: 'T0610', label: '06:10' },
    { code: 'T0620', label: '06:20' }, { code: 'T0630', label: '06:30' },
    { code: 'T0640', label: '06:40' }, { code: 'T0650', label: '06:50' },
    { code: 'T0700', label: '07:00' }, { code: 'T0710', label: '07:10' },
    { code: 'T0720', label: '07:20' }, { code: 'T0730', label: '07:30' },
    { code: 'T0740', label: '07:40' }, { code: 'T0750', label: '07:50' },
    { code: 'T0800', label: '08:00' }, { code: 'T0810', label: '08:10' },
    { code: 'T0820', label: '08:20' }, { code: 'T0830', label: '08:30' },
    { code: 'T0840', label: '08:40' }, { code: 'T0850', label: '08:50' },
    { code: 'T0900', label: '09:00' }, { code: 'T0910', label: '09:10' },
    { code: 'T0920', label: '09:20' }, { code: 'T0930', label: '09:30' },
    { code: 'T0940', label: '09:40' }, { code: 'T0950', label: '09:50' },
    { code: 'T1000', label: '10:00' }, { code: 'T1010', label: '10:10' },
    { code: 'T1020', label: '10:20' }, { code: 'T1030', label: '10:30' },
    { code: 'T1040', label: '10:40' }, { code: 'T1050', label: '10:50' },
    { code: 'T1100', label: '11:00' }, { code: 'T1110', label: '11:10' },
    { code: 'T1120', label: '11:20' }, { code: 'T1130', label: '11:30' },
    { code: 'T1140', label: '11:40' }, { code: 'T1150', label: '11:50' },
  ],
  // 오후 (12:00 ~ 17:50)
  PM: [
    { code: 'T1200', label: '12:00' }, { code: 'T1210', label: '12:10' },
    { code: 'T1220', label: '12:20' }, { code: 'T1230', label: '12:30' },
    { code: 'T1240', label: '12:40' }, { code: 'T1250', label: '12:50' },
    { code: 'T1300', label: '13:00' }, { code: 'T1310', label: '13:10' },
    { code: 'T1320', label: '13:20' }, { code: 'T1330', label: '13:30' },
    { code: 'T1340', label: '13:40' }, { code: 'T1350', label: '13:50' },
    { code: 'T1400', label: '14:00' }, { code: 'T1410', label: '14:10' },
    { code: 'T1420', label: '14:20' }, { code: 'T1430', label: '14:30' },
    { code: 'T1440', label: '14:40' }, { code: 'T1450', label: '14:50' },
    { code: 'T1500', label: '15:00' }, { code: 'T1510', label: '15:10' },
    { code: 'T1520', label: '15:20' }, { code: 'T1530', label: '15:30' },
    { code: 'T1540', label: '15:40' }, { code: 'T1550', label: '15:50' },
    { code: 'T1600', label: '16:00' }, { code: 'T1610', label: '16:10' },
    { code: 'T1620', label: '16:20' }, { code: 'T1630', label: '16:30' },
    { code: 'T1640', label: '16:40' }, { code: 'T1650', label: '16:50' },
    { code: 'T1700', label: '17:00' }, { code: 'T1710', label: '17:10' },
    { code: 'T1720', label: '17:20' }, { code: 'T1730', label: '17:30' },
    { code: 'T1740', label: '17:40' }, { code: 'T1750', label: '17:50' },
  ],
  // 저녁 (18:00 ~ 22:50)
  EVENING: [
    { code: 'T1800', label: '18:00' }, { code: 'T1810', label: '18:10' },
    { code: 'T1820', label: '18:20' }, { code: 'T1830', label: '18:30' },
    { code: 'T1840', label: '18:40' }, { code: 'T1850', label: '18:50' },
    { code: 'T1900', label: '19:00' }, { code: 'T1910', label: '19:10' },
    { code: 'T1920', label: '19:20' }, { code: 'T1930', label: '19:30' },
    { code: 'T1940', label: '19:40' }, { code: 'T1950', label: '19:50' },
    { code: 'T2000', label: '20:00' }, { code: 'T2010', label: '20:10' },
    { code: 'T2020', label: '20:20' }, { code: 'T2030', label: '20:30' },
    { code: 'T2040', label: '20:40' }, { code: 'T2050', label: '20:50' },
    { code: 'T2100', label: '21:00' }, { code: 'T2110', label: '21:10' },
    { code: 'T2120', label: '21:20' }, { code: 'T2130', label: '21:30' },
    { code: 'T2140', label: '21:40' }, { code: 'T2150', label: '21:50' },
    { code: 'T2200', label: '22:00' }, { code: 'T2210', label: '22:10' },
    { code: 'T2220', label: '22:20' }, { code: 'T2230', label: '22:30' },
    { code: 'T2240', label: '22:40' }, { code: 'T2250', label: '22:50' },
  ]
};

// 전체 슬롯 flat 배열
const ALL_TIME_SLOTS = [...TIME_SLOTS.AM, ...TIME_SLOTS.PM, ...TIME_SLOTS.EVENING];

// 요일 코드
const DAY_CODES = [
  { code: 'SUN', label: '일', index: 0 },
  { code: 'MON', label: '월', index: 1 },
  { code: 'TUE', label: '화', index: 2 },
  { code: 'WED', label: '수', index: 3 },
  { code: 'THU', label: '목', index: 4 },
  { code: 'FRI', label: '금', index: 5 },
  { code: 'SAT', label: '토', index: 6 },
];

/**
 * 시간 슬롯 그리드 렌더링 헬퍼
 * @param {string} containerId - 렌더링할 DOM 컨테이너 ID
 * @param {Array} slots - TIME_SLOTS.AM / PM / EVENING
 * @param {Set} selectedCodes - 선택된 코드 Set (예: Set(['T0900','T0930']))
 * @param {Set} blockedCodes - 블록된 코드 Set (코치 스케줄 불가 시간)
 * @param {Function} onToggle - 토글 콜백 (code, isSelected)
 */
function renderTimeSlotGrid(containerId, slots, selectedCodes, blockedCodes, onToggle) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  slots.forEach(slot => {
    const el = document.createElement('div');
    const isBlocked = blockedCodes && blockedCodes.has(slot.code);
    const isSelected = selectedCodes && selectedCodes.has(slot.code);

    el.className = 'time-chip' + (isSelected ? ' active' : '') + (isBlocked ? ' blocked' : '');
    el.textContent = slot.label;
    el.dataset.code = slot.code;
    el.dataset.label = slot.label;

    if (!isBlocked) {
      el.onclick = function() {
        this.classList.toggle('active');
        if (onToggle) onToggle(slot.code, this.classList.contains('active'));
      };
    }

    container.appendChild(el);
  });
}

/**
 * code → label 변환
 */
function getTimeLabel(code) {
  const slot = ALL_TIME_SLOTS.find(s => s.code === code);
  return slot ? slot.label : code;
}

function getDayLabel(code) {
  const day = DAY_CODES.find(d => d.code === code);
  return day ? day.label : code;
}
