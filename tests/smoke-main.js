const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const outputDirectory = path.join(__dirname, '..', 'release');
const runtimeErrors = [];

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 900,
    height: 660,
    show: false,
    backgroundColor: '#f5f3ed',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      paintWhenInitiallyHidden: true
    }
  });

  window.webContents.on('console-message', (_event, level, message) => {
    if (level >= 3) runtimeErrors.push(message);
  });

  try {
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
      check(document.body.scrollWidth <= window.innerWidth, '页面出现横向溢出');

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
        desktopBridge: !!window.desktop
      };
    })()`);

    result.runtimeErrors = runtimeErrors;
    result.ok = result.ok && runtimeErrors.length === 0;
    fs.mkdirSync(outputDirectory, { recursive: true });
    const preview = await window.webContents.capturePage();
    fs.writeFileSync(path.join(outputDirectory, '应用预览.png'), preview.toPNG());
    fs.writeFileSync(path.join(outputDirectory, 'smoke-result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    app.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
