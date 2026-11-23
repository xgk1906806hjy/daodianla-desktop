(function initLogic(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.PunchLogic = api;
  }
})(typeof self !== 'undefined' ? self : globalThis, () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  function parseTime(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return NaN;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return NaN;
    return hours * 60 + minutes;
  }

  function startOfDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  }

  function atMinutes(date, minutes) {
    const result = startOfDay(date);
    result.setMinutes(minutes);
    return result;
  }

  function isWorkday(date, settings) {
    return settings.weekdays.includes(date.getDay());
  }

  function getWorkIntervals(date, settings) {
    if (!isWorkday(date, settings)) return [];
    const start = parseTime(settings.workStart);
    const end = parseTime(settings.workEnd);
    const lunchStart = parseTime(settings.lunchStart);
    const lunchEnd = parseTime(settings.lunchEnd);
    const ranges = [
      [start, lunchStart],
      [lunchEnd, end]
    ];
    return ranges
      .filter(([from, to]) => Number.isFinite(from) && Number.isFinite(to) && to > from)
      .map(([from, to]) => ({ start: atMinutes(date, from), end: atMinutes(date, to) }));
  }

  function getTotalWorkSeconds(settings) {
    const start = parseTime(settings.workStart);
    const end = parseTime(settings.workEnd);
    const lunchStart = parseTime(settings.lunchStart);
    const lunchEnd = parseTime(settings.lunchEnd);
    const totalMinutes = [start, end, lunchStart, lunchEnd].every(Number.isFinite)
      ? Math.max(0, lunchStart - start) + Math.max(0, end - lunchEnd)
      : 0;
    return Math.max(0, totalMinutes * 60);
  }

  function getSalarySnapshot(now, settings) {
    const intervals = getWorkIntervals(now, settings);
    const earnedSeconds = intervals.reduce((sum, interval) => {
      const elapsed = Math.min(Math.max(now - interval.start, 0), interval.end - interval.start);
      return sum + elapsed / 1000;
    }, 0);
    const totalWorkSeconds = getTotalWorkSeconds(settings);
    const salaryPerSecond = totalWorkSeconds > 0 && settings.workDaysPerMonth > 0
      ? settings.monthlySalary / (settings.workDaysPerMonth * totalWorkSeconds)
      : 0;

    return {
      earnedSeconds,
      totalWorkSeconds,
      salaryPerSecond,
      todayAmount: earnedSeconds * salaryPerSecond,
      dayProgress: totalWorkSeconds ? Math.min(earnedSeconds / totalWorkSeconds, 1) : 0
    };
  }

  function getWorkStatus(now, settings) {
    if (!isWorkday(now, settings)) return 'restday';
    const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const workStart = parseTime(settings.workStart);
    const workEnd = parseTime(settings.workEnd);
    const lunchStart = parseTime(settings.lunchStart);
    const lunchEnd = parseTime(settings.lunchEnd);
    if (currentMinutes < workStart) return 'before';
    if (currentMinutes >= workEnd) return 'after';
    if (currentMinutes >= lunchStart && currentMinutes < lunchEnd) return 'break';
    return 'working';
  }

  function getOffworkCountdown(now, settings) {
    let target = null;
    if (isWorkday(now, settings) && now < atMinutes(now, parseTime(settings.workEnd))) {
      target = atMinutes(now, parseTime(settings.workEnd));
    } else {
      for (let offset = 1; offset <= 14; offset += 1) {
        const candidate = addDays(now, offset);
        if (isWorkday(candidate, settings)) {
          target = atMinutes(candidate, parseTime(settings.workEnd));
          break;
        }
      }
    }
    return {
      target,
      diffMs: target ? Math.max(target - now, 0) : 0,
      isToday: target ? startOfDay(target).getTime() === startOfDay(now).getTime() : false
    };
  }

  function splitDuration(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { totalSeconds, days, hours, minutes, seconds };
  }

  function getNextWeekend(now) {
    const delta = (6 - now.getDay() + 7) % 7;
    return startOfDay(addDays(now, delta));
  }

  function getNextNewYear(now) {
    let target = new Date(now.getFullYear(), 0, 1);
    if (startOfDay(now) > target) target = new Date(now.getFullYear() + 1, 0, 1);
    return target;
  }

  function getNextPayday(now, payday) {
    const safePayday = Math.min(Math.max(Number(payday) || 1, 1), 31);
    const makeDate = (year, month) => {
      const lastDay = new Date(year, month + 1, 0).getDate();
      return new Date(year, month, Math.min(safePayday, lastDay));
    };
    let target = makeDate(now.getFullYear(), now.getMonth());
    if (startOfDay(now) > target) target = makeDate(now.getFullYear(), now.getMonth() + 1);
    return target;
  }

  function daysUntil(now, target) {
    return Math.max(0, Math.round((startOfDay(target) - startOfDay(now)) / DAY_MS));
  }

  const SLACK_LEVELS = [
    { min: 0, name: '摸鱼见习生' },
    { min: 10 * 60, name: '摸鱼熟练工' },
    { min: 30 * 60, name: '摸鱼研究所所长' },
    { min: 60 * 60, name: '带薪休息大师' },
    { min: 120 * 60, name: '摸鱼传说' }
  ];

  function getSlackLevel(seconds) {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    let index = 0;
    for (let cursor = 0; cursor < SLACK_LEVELS.length; cursor += 1) {
      if (safeSeconds >= SLACK_LEVELS[cursor].min) index = cursor;
    }
    const current = SLACK_LEVELS[index];
    const next = SLACK_LEVELS[index + 1] || null;
    const span = next ? next.min - current.min : 1;
    const progress = next ? Math.min(1, Math.max(0, (safeSeconds - current.min) / span)) : 1;
    return {
      index,
      name: current.name,
      next,
      remainingSeconds: next ? Math.max(0, Math.ceil(next.min - safeSeconds)) : 0,
      progress
    };
  }

  function formatSlackClock(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const rest = total % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  }

  function validateSettings(settings) {
    const workStart = parseTime(settings.workStart);
    const workEnd = parseTime(settings.workEnd);
    const lunchStart = parseTime(settings.lunchStart);
    const lunchEnd = parseTime(settings.lunchEnd);
    if (!Number.isFinite(settings.monthlySalary) || settings.monthlySalary <= 0) return '月薪需要大于 0';
    if (!Number.isFinite(settings.workDaysPerMonth) || settings.workDaysPerMonth <= 0 || settings.workDaysPerMonth > 31) return '每月计薪天数应在 0～31 之间';
    if (!settings.weekdays.length) return '至少选择一个星期工作日';
    if (!(workEnd > workStart)) return '下班时间需要晚于上班时间';
    if (!(lunchStart >= workStart && lunchEnd > lunchStart && lunchEnd <= workEnd)) return '午休时间需要位于工作时间内';
    if (!Number.isFinite(settings.payday) || settings.payday < 1 || settings.payday > 31) return '发薪日应在 1～31 日之间';
    return '';
  }

  return {
    parseTime,
    startOfDay,
    addDays,
    atMinutes,
    isWorkday,
    getWorkIntervals,
    getTotalWorkSeconds,
    getSalarySnapshot,
    getWorkStatus,
    getOffworkCountdown,
    splitDuration,
    getNextWeekend,
    getNextNewYear,
    getNextPayday,
    daysUntil,
    getSlackLevel,
    formatSlackClock,
    validateSettings
  };
});
