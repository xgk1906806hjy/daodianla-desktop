const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const outputDirectory = path.join(__dirname, '..', 'release');
const runtimeErrors = [];

app.setPath('userData', path.join(outputDirectory, 'smoke-profile'));

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 800,
    height: 560,
    show: false,
    backgroundColor: '#f5f3ed',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      paintWhenInitiallyHidden: true
    }
  });

  window.webContents.on('console-message', (_event, level, message) => {
    if (level >= 3) runtimeErrors.push(message);
  });

  try {
    await window.webContents.session.clearStorageData({ storages: ['localstorage'] });
    await window.loadFile(path.join(__dirname, '..', 'index.html'));
    await new Promise((resolve) => setTimeout(resolve, 1300));
    const result = await window.webContents.executeJavaScript(`(() => {
      const errors = [];
      const element = (id) => document.getElementById(id);
      const check = (condition, message) => { if (!condition) errors.push(message); };
      check(!!window.desktop, '桌面桥接未加载');
      check(element('countdown').textContent.trim().length > 0, '倒计时为空');
      check(element('salaryAmount').textContent.trim().length > 0, '工资金额为空');
      check(document.querySelectorAll('.holiday-card').length >= 3, '内置倒计时卡片不足');
      check(document.querySelectorAll('.slack-card').length === 3, '摸鱼补给站卡片不足');
      check(element('slackLevel').textContent.trim().length > 0, '摸鱼段位为空');
      check(!!element('salaryMiniBtn'), '工资置顶入口缺失');
      check(!!element('miniCountdown') && !!element('miniSalaryBig'), '置顶小窗缺少倒计时或工资');
      check(!!element('miniPinToggle'), '置顶小窗缺少置顶开关');
      check(document.body.scrollWidth <= window.innerWidth, '页面出现横向溢出');
      check(document.documentElement.scrollHeight <= window.innerHeight, '页面出现纵向溢出');

      const press = (id) => element(id).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const waterBefore = Number((element('waterCount').textContent.match(/\d+/) || ['0'])[0]);
      press('waterBtn');
      const waterAfter = Number((element('waterCount').textContent.match(/\d+/) || ['0'])[0]);
      press('slackToggleBtn');
      check(element('slackToggleBtn').textContent.includes('结束摸鱼'), '摸鱼计时无法开始');
      press('slackToggleBtn');
      check(element('slackToggleBtn').textContent.includes('开始摸鱼'), '摸鱼计时无法结束');
      press('fortuneBtn');
      check(element('fortuneGrade').textContent.trim().length > 0, '摸鱼签内容为空');

      element('settingsBtn').click();
      check(element('settingsModal').open, '设置弹窗无法打开');
      element('settingsModal').close();
      element('addHolidayBtn').click();
      check(element('holidayModal').open, '期待弹窗无法打开');
      element('holidayModal').close();
      element('bossBtn').click();
      check(document.body.classList.contains('boss-mode'), '老板键无法进入');
      element('exitBossBtn').click();
      check(!document.body.classList.contains('boss-mode'), '老板键无法退出');
      element('privacyBtn').click();
      check(element('salaryAmount').textContent.includes('*'), '金额隐藏无效');
      element('privacyBtn').click();

      return {
        ok: errors.length === 0,
        errors,
        countdown: element('countdown').textContent.trim(),
        salary: element('salaryAmount').textContent.trim(),
        holidayCards: document.querySelectorAll('.holiday-card').length,
        slackCards: document.querySelectorAll('.slack-card').length,
        slackLevel: element('slackLevel').textContent.trim(),
        waterCount: element('waterCount').textContent.trim(),
        miniSalaryValue: element('miniSalaryBig').textContent.trim(),
        waterBefore,
        waterAfter,
        desktopBridge: !!window.desktop
      };
    })()`);

    await new Promise((resolve) => setTimeout(resolve, 1200));
    const followup = await window.webContents.executeJavaScript(`(() => ({
      waterAfterTick: Number((document.getElementById('waterCount').textContent.match(/\\d+/) || ['0'])[0]),
      slackStore: localStorage.getItem('daodianla.slack.v1'),
      timerText: document.getElementById('slackTimer').textContent.trim()
    }))()`);
    result.waterAfterTick = followup.waterAfterTick;
    result.slackStore = followup.slackStore;
    result.timerText = followup.timerText;
    if (followup.waterAfterTick !== result.waterBefore + 1) {
      result.ok = false;
      result.errors.push('带薪喝水打卡无效');
    }
    result.waterAfter = followup.waterAfterTick;

    result.runtimeErrors = runtimeErrors;
    result.ok = result.ok && runtimeErrors.length === 0;
    fs.mkdirSync(outputDirectory, { recursive: true });
    const preview = await window.webContents.capturePage();
    fs.writeFileSync(path.join(outputDirectory, '应用预览.png'), preview.toPNG());

    window.setSize(380, 240);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const miniResult = await window.webContents.executeJavaScript(`(() => {
      document.body.classList.add('mini');
      return {
        countdown: document.getElementById('miniCountdown').textContent.trim(),
        amount: document.getElementById('miniSalaryBig').textContent.trim(),
        rate: document.getElementById('miniSalaryRate').textContent.trim(),
        pinState: document.getElementById('miniPinState').textContent.trim(),
        className: document.body.className,
        appDisplay: getComputedStyle(document.querySelector('.app-shell')).display,
        miniDisplay: getComputedStyle(document.getElementById('miniPanel')).display,
        fitsWidth: document.body.scrollWidth <= window.innerWidth,
        fitsHeight: document.documentElement.scrollHeight <= window.innerHeight
      };
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 300));
    window.setPosition(-2000, -2000, false);
    window.showInactive();
    await new Promise((resolve) => setTimeout(resolve, 600));
    const miniPreview = await window.webContents.capturePage({ x: 0, y: 0, width: 380, height: 240 });
    window.hide();
    fs.writeFileSync(path.join(outputDirectory, '置顶小窗预览.png'), miniPreview.toPNG());
    result.miniCountdown = miniResult.countdown;
    result.miniSalaryAmount = miniResult.amount;
    result.miniSalaryRate = miniResult.rate;
    result.miniPinState = miniResult.pinState;
    result.miniDebug = {
      className: miniResult.className,
      appDisplay: miniResult.appDisplay,
      miniDisplay: miniResult.miniDisplay,
      fitsWidth: miniResult.fitsWidth,
      fitsHeight: miniResult.fitsHeight
    };
    if (!miniResult.countdown || !miniResult.amount || !miniResult.fitsWidth || !miniResult.fitsHeight) {
      result.ok = false;
      result.errors.push('倒计时与工资置顶小窗渲染失败');
    }

    fs.writeFileSync(path.join(outputDirectory, 'smoke-result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
});
