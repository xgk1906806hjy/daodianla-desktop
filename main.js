const { app, BrowserWindow, ipcMain, Notification, screen } = require('electron');
const path = require('node:path');

let mainWindow = null;
let normalBounds = null;
let isMini = false;
let isPinned = false;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 660,
    minWidth: 820,
    minHeight: 620,
    backgroundColor: '#f5f3ed',
    frame: false,
    show: false,
    title: '到点啦',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function sendWindowState(channel, value) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, value);
  }
}

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  return mainWindow.isMaximized();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:toggle-pin', () => {
  if (!mainWindow) return false;
  isPinned = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(isPinned);
  sendWindowState('window:pin-changed', isPinned);
  return isPinned;
});
ipcMain.handle('window:toggle-mini', () => {
  if (!mainWindow) return false;

  isMini = !isMini;
  if (isMini) {
    normalBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(normalBounds);
    const width = 380;
    const height = 240;
    const x = Math.min(
      Math.max(normalBounds.x, display.workArea.x),
      display.workArea.x + display.workArea.width - width
    );
    const y = Math.min(
      Math.max(normalBounds.y, display.workArea.y),
      display.workArea.y + display.workArea.height - height
    );

    mainWindow.setMinimumSize(width, height);
    mainWindow.setResizable(false);
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setBounds({ x, y, width, height });
  } else {
    mainWindow.setResizable(true);
    mainWindow.setMinimumSize(980, 700);
    mainWindow.setAlwaysOnTop(isPinned);
    if (normalBounds) mainWindow.setBounds(normalBounds);
  }

  setTimeout(() => sendWindowState('window:mini-changed', isMini), 80);
  return isMini;
});
ipcMain.on('app:notify', (_event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

app.whenReady().then(() => {
  app.setAppUserModelId('local.daodianla.desktop');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
