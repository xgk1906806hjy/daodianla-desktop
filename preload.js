const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  toggleMini: () => ipcRenderer.invoke('window:toggle-mini'),
  togglePin: () => ipcRenderer.invoke('window:toggle-pin'),
  notify: (title, body) => ipcRenderer.send('app:notify', { title, body }),
  onMiniModeChanged: (callback) => {
    ipcRenderer.on('window:mini-changed', (_event, value) => callback(value));
  },
  onPinChanged: (callback) => {
    ipcRenderer.on('window:pin-changed', (_event, value) => callback(value));
  }
});
