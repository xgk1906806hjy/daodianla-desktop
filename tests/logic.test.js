const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

const settings = {
  monthlySalary: 12000,
  workDaysPerMonth: 21.75,
  workStart: '09:00',
  workEnd: '18:00',
  lunchStart: '12:00',
  lunchEnd: '13:00',
  weekdays: [1, 2, 3, 4, 5],
  payday: 10
};

test('每日计薪工时为 8 小时，午休不计薪', () => {
  assert.equal(L.getTotalWorkSeconds(settings), 8 * 3600);
});

test('工时计算不依赖周一是否为工作日', () => {
  assert.equal(L.getTotalWorkSeconds({ ...settings, weekdays: [0] }), 8 * 3600);
});

test('下午三点的今日工资只计算五小时有效工时', () => {
  const now = new Date(2026, 10, 23, 15, 0, 0);
  const snapshot = L.getSalarySnapshot(now, settings);
  assert.equal(snapshot.earnedSeconds, 5 * 3600);
  assert.ok(Math.abs(snapshot.todayAmount - (12000 / 21.75) * (5 / 8)) < 0.000001);
  assert.equal(snapshot.dayProgress, 5 / 8);
});

test('午休期间工资不会继续累计', () => {
  const noon = L.getSalarySnapshot(new Date(2026, 10, 23, 12, 0, 0), settings);
  const lunch = L.getSalarySnapshot(new Date(2026, 10, 23, 12, 59, 59), settings);
  assert.equal(noon.earnedSeconds, 3 * 3600);
  assert.equal(lunch.earnedSeconds, 3 * 3600);
});

test('上班前工资为零，下班后达到今日目标', () => {
  const before = L.getSalarySnapshot(new Date(2026, 10, 23, 8, 0, 0), settings);
  const after = L.getSalarySnapshot(new Date(2026, 10, 23, 19, 0, 0), settings);
  assert.equal(before.todayAmount, 0);
  assert.ok(Math.abs(after.todayAmount - 12000 / 21.75) < 0.000001);
  assert.equal(after.dayProgress, 1);
});

test('休息日和午休、下班状态正确', () => {
  const saturday = new Date(2026, 10, 21, 15, 0, 0);
  assert.equal(L.getWorkStatus(saturday, settings), 'restday');
  assert.equal(L.getSalarySnapshot(saturday, settings).todayAmount, 0);
  assert.equal(L.getWorkStatus(new Date(2026, 10, 23, 12, 30, 0), settings), 'break');
  assert.equal(L.getWorkStatus(new Date(2026, 10, 23, 18, 0, 0), settings), 'after');
});

test('下班倒计时指向当天十八点', () => {
  const now = new Date(2026, 10, 23, 15, 0, 0);
  const countdown = L.getOffworkCountdown(now, settings);
  assert.equal(countdown.isToday, true);
  assert.equal(countdown.diffMs, 3 * 3600 * 1000);
  assert.equal(countdown.target.getHours(), 18);
});

test('周五下班后倒计时指向下周一', () => {
  const now = new Date(2026, 10, 20, 19, 0, 0);
  const countdown = L.getOffworkCountdown(now, settings);
  assert.equal(countdown.target.getDay(), 1);
  assert.equal(countdown.target.getDate(), 23);
  assert.equal(countdown.target.getHours(), 18);
});

test('短月份发薪日自动落到月末', () => {
  const target = L.getNextPayday(new Date(2027, 1, 10), 31);
  assert.equal(target.getMonth(), 1);
  assert.equal(target.getDate(), 28);
});

test('非法午休与空工作日会被拦截', () => {
  assert.ok(L.validateSettings({ ...settings, lunchStart: '13:00', lunchEnd: '12:00' }));
  assert.ok(L.validateSettings({ ...settings, weekdays: [] }));
  assert.equal(L.validateSettings(settings), '');
});

test('摸鱼段位随今日累计时间升级', () => {
  assert.equal(L.getSlackLevel(0).name, '摸鱼见习生');
  assert.equal(L.getSlackLevel(10 * 60).name, '摸鱼熟练工');
  assert.equal(L.getSlackLevel(30 * 60).name, '摸鱼研究所所长');
  assert.equal(L.getSlackLevel(60 * 60).name, '带薪休息大师');
  assert.equal(L.getSlackLevel(120 * 60).name, '摸鱼传说');
  assert.equal(L.getSlackLevel(7200).next, null);
});

test('摸鱼段位进度与计时格式正确', () => {
  const level = L.getSlackLevel(20 * 60);
  assert.equal(level.next.name, '摸鱼研究所所长');
  assert.equal(level.remainingSeconds, 10 * 60);
  assert.equal(level.progress, 0.5);
  assert.equal(L.formatSlackClock(65), '01:05');
  assert.equal(L.formatSlackClock(3661), '1:01:01');
});
