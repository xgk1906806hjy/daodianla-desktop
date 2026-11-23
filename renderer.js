const L = window.PunchLogic;

const SETTINGS_KEY = 'daodianla.settings.v1';
const HOLIDAYS_KEY = 'daodianla.holidays.v1';
const PRIVACY_KEY = 'daodianla.privacy.v1';
const DEFAULT_SETTINGS = {
  monthlySalary: 12000,
  workDaysPerMonth: 21.75,
  workStart: '09:00',
  workEnd: '18:00',
  lunchStart: '12:00',
  lunchEnd: '13:00',
  weekdays: [1, 2, 3, 4, 5],
  payday: 10
};
const WEEKDAYS = [
  { value: 1, label: '周一' }, { value: 2, label: '周二' }, { value: 3, label: '周三' },
  { value: 4, label: '周四' }, { value: 5, label: '周五' }, { value: 6, label: '周六' }, { value: 0, label: '周日' }
];
const QUOTES = [
  ['工资是劳动的报酬，准时下班是对生活的尊重。', '到点啦编辑部'],
  ['今天完成的任务已经很多，剩下的明天再发光。', '打工人工位'],
  ['工作做不完很正常，饭忘了吃可不划算。', '准时下班协会'],
  ['你负责认真工作，我负责提醒你认真生活。', '到点啦编辑部'],
  ['人生不只有待办事项，还有晚风和热腾腾的饭。', '今晚吃什么研究组'],
  ['每一个普通的工作日，都藏着一点工资进账的快乐。', '快乐储蓄罐'],
  ['别只盯着进度条，也看看窗外今天的天空。', '窗外观察员'],
  ['到点不是偷懒，是给明天的自己留一点电。', '准时下班协会']
];
const HOLIDAY_STYLES = {
  weekend: { code: 'WK', color: '#e1ece3', ink: '#315b49' },
  newyear: { code: 'NY', color: '#f7dfd2', ink: '#b55434' },
  payday: { code: 'PAY', color: '#f6e8b9', ink: '#896722' },
  travel: { code: 'TR', color: '#dfeaec', ink: '#3e6872' },
  holiday: { code: 'HD', color: '#e1ece3', ink: '#315b49' },
  birthday: { code: 'BD', color: '#f7dfd2', ink: '#b55434' },
  anniversary: { code: 'AN', color: '#eee5dc', ink: '#7b6250' }
};

const $ = (id) => document.getElementById(id);
const pad = (value) => String(value).padStart(2, '0');
const money = (value, digits = 2) => Number(value).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

let settings = loadSettings();
let customHolidays = loadHolidays();
let amountVisible = localStorage.getItem(PRIVACY_KEY) !== 'hidden';
let quoteIndex = Math.floor(Math.random() * QUOTES.length);
let lastStatus = null;
let toastTimer = null;
let isMini = false;

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_SETTINGS };
    const merged = { ...DEFAULT_SETTINGS, ...saved };
    merged.weekdays = Array.isArray(merged.weekdays) ? merged.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6) : DEFAULT_SETTINGS.weekdays;
    return L.validateSettings(merged) ? { ...DEFAULT_SETTINGS } : merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function loadHolidays() {
  try {
    const saved = JSON.parse(localStorage.getItem(HOLIDAYS_KEY));
    if (!Array.isArray(saved)) return [];
    return saved.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && HOLIDAY_STYLES[item.type]).slice(0, 30);
  } catch {
    return [];
  }
}

function saveHolidays() {
  localStorage.setItem(HOLIDAYS_KEY, JSON.stringify(customHolidays));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function formatInputDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function showToast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').classList.add('show');
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2300);
}

function renderDateAndWeek(now, status) {
  $('dateLine').textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAYS.find((day) => day.value === now.getDay()).label}`;
  const hour = now.getHours();
  $('greeting').textContent = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = L.addDays(L.startOfDay(now), -mondayOffset);
  let completed = 0;
  let workdayCount = 0;
  const dots = WEEKDAYS.map((weekday, index) => {
    const date = L.addDays(monday, index);
    const workday = settings.weekdays.includes(weekday.value);
    if (workday) workdayCount += 1;
    const isPast = L.startOfDay(date) < L.startOfDay(now);
    const isToday = index === mondayOffset;
    if (workday && (isPast || (isToday && status === 'after'))) completed += 1;
    const className = `week-day${workday && (isPast || (isToday && status === 'after')) ? ' done' : ''}${isToday ? ' today' : ''}`;
    return `<div class="${className}"><i></i><span>${weekday.label.slice(1)}</span></div>`;
  }).join('');
  $('weekDots').innerHTML = dots;
  $('weekProgressText').textContent = `${completed} / ${workdayCount} 天`;
}

function countdownMarkup(duration) {
  const dayPart = duration.days > 0 ? `<span class="day-part">${duration.days}<small>天</small></span>` : '';
  return `${dayPart}<span class="time-unit">${pad(duration.hours)}</span><span class="time-label">时</span><span class="time-unit">${pad(duration.minutes)}</span><span class="time-label">分</span><span class="time-unit">${pad(duration.seconds)}</span><span class="time-label">秒</span>`;
}

function miniCountdownText(duration) {
  return `${duration.days > 0 ? `${duration.days}天 ` : ''}${pad(duration.hours)}:${pad(duration.minutes)}:${pad(duration.seconds)}`;
}

function renderOffwork(now, status, snapshot) {
  const statusMap = {
    working: ['搬砖进行中', ''],
    before: ['还没上班', ''],
    break: ['午休充电中', ''],
    after: ['今日已下班', 'after'],
    restday: ['今天休息日', 'restday']
  };
  $('workStatus').textContent = statusMap[status][0];
  $('workStatus').className = `status-pill ${statusMap[status][1]}`;
  $('miniStatus').textContent = statusMap[status][0];

  const countdown = L.getOffworkCountdown(now, settings);
  const duration = L.splitDuration(countdown.diffMs);
  if (status === 'after') {
    $('countdown').innerHTML = '<span class="finished">到点啦，去生活吧</span>';
    $('countdownHint').textContent = '今天的工作已经完成，辛苦啦';
    $('miniCountdown').textContent = '已经下班啦';
  } else if (status === 'restday') {
    $('countdown').innerHTML = '<span class="finished">今天不上班</span>';
    $('countdownHint').textContent = '好好休息，也是正经事';
    $('miniCountdown').textContent = '今天休息日';
  } else {
    $('countdown').innerHTML = countdownMarkup(duration);
    $('countdownHint').textContent = countdown.isToday ? `距离今天 ${settings.workEnd} 下班` : '距离下个工作日下班';
    $('miniCountdown').textContent = miniCountdownText(duration);
  }

  const progress = snapshot.dayProgress * 100;
  $('workProgressText').textContent = `${progress.toFixed(1)}%`;
  $('workProgressBar').style.width = `${progress}%`;
  $('miniProgressBar').style.width = `${progress}%`;
  $('scheduleText').textContent = settings.weekdays.includes(now.getDay()) ? `${settings.workStart} — ${settings.workEnd}` : '今日无工作安排';
  $('lunchText').textContent = settings.weekdays.includes(now.getDay()) ? `午休 ${settings.lunchStart} — ${settings.lunchEnd}` : '下次工作日见';
}

function renderSalary(snapshot, status) {
  const perMinute = snapshot.salaryPerSecond * 60;
  const daily = snapshot.salaryPerSecond * snapshot.totalWorkSeconds;
  const setAmount = (id, value) => { $(id).textContent = amountVisible ? value : '****'; };
  setAmount('salaryAmount', money(snapshot.todayAmount));
  setAmount('salaryRate', money(snapshot.salaryPerSecond, 4));
  setAmount('dailySalary', `¥${money(daily)}`);
  setAmount('minuteSalary', `¥${money(perMinute)}`);
  setAmount('miniSalary', `¥${money(snapshot.todayAmount)}`);
  $('salaryAmount').classList.toggle('hidden-amount', !amountVisible);
  $('privacyBtn').classList.toggle('active', !amountVisible);
  $('privacyBtn').title = amountVisible ? '隐藏金额' : '显示金额';

  if (status === 'restday') {
    $('rewardText').textContent = '休息时间，快乐不打折';
  } else if (snapshot.todayAmount < 15) {
    $('rewardText').textContent = `距离一杯咖啡还差 ¥${money(15 - snapshot.todayAmount)}`;
  } else {
    $('rewardText').textContent = `今天已赚到 ${(snapshot.todayAmount / 15).toFixed(1)} 杯咖啡`;
  }
}

function holidayDateLabel(date) {
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

function holidayCard(item, now) {
  const style = HOLIDAY_STYLES[item.type];
  const days = Math.round((L.startOfDay(item.date) - L.startOfDay(now)) / 86400000);
  let count;
  if (days === 0) count = '<span class="today-text">就是今天</span>';
  else if (days === 1) count = '<span class="today-text">明天见</span>';
  else if (days < 0) count = '<span class="today-text">已到站</span>';
  else count = `<strong>${days}</strong><span>天后</span>`;
  const deleteButton = item.custom ? `<button class="delete-holiday" data-id="${escapeHtml(item.id)}" title="删除期待" aria-label="删除${escapeHtml(item.name)}">×</button>` : '';
  return `<article class="holiday-card" style="--holiday-color:${style.color};--holiday-ink:${style.ink}">${deleteButton}<div class="holiday-top"><span class="holiday-icon">${style.code}</span><span class="holiday-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span><span class="holiday-date">${holidayDateLabel(item.date)}</span></div><div class="holiday-count">${count}</div></article>`;
}

function renderHolidays(now) {
  const builtIns = [
    { id: 'weekend', name: '快乐周末', type: 'weekend', date: L.getNextWeekend(now) },
    { id: 'newyear', name: '元旦假期', type: 'newyear', date: L.getNextNewYear(now) },
    { id: 'payday', name: '发薪日', type: 'payday', date: L.getNextPayday(now, settings.payday) }
  ];
  const custom = customHolidays.map((item) => ({ ...item, custom: true, date: new Date(`${item.date}T00:00:00`) }));
  const all = [...builtIns, ...custom].sort((a, b) => a.date - b.date);
  $('holidayGrid').innerHTML = all.map((item) => holidayCard(item, now)).join('');
  document.querySelectorAll('.delete-holiday').forEach((button) => {
    button.addEventListener('click', () => {
      customHolidays = customHolidays.filter((item) => item.id !== button.dataset.id);
      saveHolidays();
      renderHolidays(new Date());
      showToast('已删除这个期待');
    });
  });
}

function renderQuote() {
  $('quoteText').textContent = QUOTES[quoteIndex][0];
  $('quoteAuthor').textContent = QUOTES[quoteIndex][1];
}

function celebrate() {
  const colors = ['#ef7448', '#f4ce68', '#315b49', '#8eb8a0', '#f2a58a', '#ffffff'];
  for (let index = 0; index < 75; index += 1) {
    const piece = document.createElement('i');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.setProperty('--duration', `${2.2 + Math.random() * 1.7}s`);
    piece.style.setProperty('--drift', `${-100 + Math.random() * 200}px`);
    piece.style.transform = `rotate(${Math.random() * 180}deg)`;
    piece.style.animationDelay = `${Math.random() * .35}s`;
    $('confettiLayer').appendChild(piece);
    setTimeout(() => piece.remove(), 4400);
  }
}

function tick() {
  const now = new Date();
  const status = L.getWorkStatus(now, settings);
  const snapshot = L.getSalarySnapshot(now, settings);
  renderDateAndWeek(now, status);
  renderOffwork(now, status, snapshot);
  renderSalary(snapshot, status);

  if (lastStatus && lastStatus !== 'after' && status === 'after') {
    celebrate();
    window.desktop?.notify('到点啦，下班快乐！', '今天辛苦啦，关掉电脑去享受生活吧。');
    showToast('到点啦，今天辛苦啦');
  }
  lastStatus = status;
}

function fillSettingsForm(values) {
  $('monthlySalaryInput').value = values.monthlySalary;
  $('workDaysInput').value = values.workDaysPerMonth;
  $('workStartInput').value = values.workStart;
  $('workEndInput').value = values.workEnd;
  $('lunchStartInput').value = values.lunchStart;
  $('lunchEndInput').value = values.lunchEnd;
  $('paydayInput').value = values.payday;
  document.querySelectorAll('#weekdayInputs input').forEach((input) => {
    input.checked = values.weekdays.includes(Number(input.value));
  });
  $('settingsError').textContent = '';
}

function buildWeekdayInputs() {
  $('weekdayInputs').innerHTML = WEEKDAYS.map((day) => `<label class="weekday-option"><input type="checkbox" value="${day.value}"><span>${day.label}</span></label>`).join('');
}

function setBossMode(enabled) {
  document.body.classList.toggle('boss-mode', enabled);
  if (enabled) {
    $('settingsModal').close();
    $('holidayModal').close();
  }
}

function bindEvents() {
  $('minimizeBtn').addEventListener('click', () => window.desktop?.minimize());
  $('maximizeBtn').addEventListener('click', () => window.desktop?.maximize());
  $('closeBtn').addEventListener('click', () => window.desktop?.close());
  $('pinBtn').addEventListener('click', () => window.desktop?.togglePin());
  $('miniBtn').addEventListener('click', () => window.desktop?.toggleMini());
  $('restoreMiniBtn').addEventListener('click', () => window.desktop?.toggleMini());
  $('settingsBtn').addEventListener('click', () => {
    fillSettingsForm(settings);
    $('settingsModal').showModal();
  });
  $('addHolidayBtn').addEventListener('click', () => {
    $('holidayForm').reset();
    $('holidayDateInput').min = formatInputDate(new Date());
    $('holidayDateInput').value = formatInputDate(L.addDays(new Date(), 7));
    $('holidayModal').showModal();
    setTimeout(() => $('holidayNameInput').focus(), 50);
  });
  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => $(button.dataset.close).close());
  });
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  $('resetSettingsBtn').addEventListener('click', () => fillSettingsForm({ ...DEFAULT_SETTINGS }));
  $('settingsForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const next = {
      monthlySalary: Number($('monthlySalaryInput').value),
      workDaysPerMonth: Number($('workDaysInput').value),
      workStart: $('workStartInput').value,
      workEnd: $('workEndInput').value,
      lunchStart: $('lunchStartInput').value,
      lunchEnd: $('lunchEndInput').value,
      payday: Number($('paydayInput').value),
      weekdays: [...document.querySelectorAll('#weekdayInputs input:checked')].map((input) => Number(input.value))
    };
    const error = L.validateSettings(next);
    if (error) {
      $('settingsError').textContent = error;
      return;
    }
    settings = next;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    $('settingsModal').close();
    lastStatus = null;
    tick();
    renderHolidays(new Date());
    showToast('设置已保存，快乐参数已更新');
  });

  $('holidayForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('holidayNameInput').value.trim();
    const date = $('holidayDateInput').value;
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (new Date(`${date}T00:00:00`) < L.startOfDay(new Date())) {
      showToast('选一个今天或未来的日期吧');
      return;
    }
    customHolidays.push({
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      name,
      date,
      type: $('holidayTypeInput').value
    });
    saveHolidays();
    $('holidayModal').close();
    renderHolidays(new Date());
    showToast('新盼头已添加');
  });

  $('privacyBtn').addEventListener('click', () => {
    amountVisible = !amountVisible;
    localStorage.setItem(PRIVACY_KEY, amountVisible ? 'visible' : 'hidden');
    tick();
  });
  $('newQuoteBtn').addEventListener('click', () => {
    quoteIndex = (quoteIndex + 1 + Math.floor(Math.random() * (QUOTES.length - 1))) % QUOTES.length;
    renderQuote();
  });
  $('celebrateBtn').addEventListener('click', () => {
    celebrate();
    showToast('今天的快乐已提前送达');
  });
  $('bossBtn').addEventListener('click', () => setBossMode(true));
  $('exitBossBtn').addEventListener('click', () => setBossMode(false));
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      setBossMode(!document.body.classList.contains('boss-mode'));
    }
    if (event.key === 'Escape' && document.body.classList.contains('boss-mode')) setBossMode(false);
  });

  window.desktop?.onMiniModeChanged((value) => {
    isMini = value;
    document.body.classList.toggle('mini', isMini);
    tick();
  });
  window.desktop?.onPinChanged((value) => {
    $('pinBtn').classList.toggle('active', value);
    $('pinBtn').title = value ? '取消置顶' : '窗口置顶';
    showToast(value ? '窗口已置顶' : '已取消置顶');
  });
}

buildWeekdayInputs();
bindEvents();
renderQuote();
renderHolidays(new Date());
tick();
setInterval(tick, 1000);
setInterval(() => renderHolidays(new Date()), 60000);
