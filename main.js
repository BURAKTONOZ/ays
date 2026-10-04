const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Hata loglama
const logFile = path.join(app.getPath('userData'), 'error.log');
process.on('uncaughtException', (err) => {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${err.stack}\n`);
});

let mainWindow;

// Tek kopya (Single Instance) Kilidi
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function createWindow () {
    mainWindow = new BrowserWindow({
      width: 1366,
      height: 800,
      minWidth: 1024,
      minHeight: 700,
      frame: false,
      transparent: false, // Yeniden boyutlandırma sorununu çözer
      backgroundColor: '#0a0f1f',
      icon: path.join(__dirname, 'icon.ico'),
      webPreferences: {
        nodeIntegration: false, // GÜVENLİK: Kapatıldı
        contextIsolation: true, // GÜVENLİK: Aktifleştirildi
        preload: path.join(__dirname, 'preload.js')
      }
    });

    mainWindow.loadFile('desktop.html');
  }

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  // Güvenli IPC İletişimi
  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if(mainWindow) {
      mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    }
  });
  ipcMain.on('window-close', () => mainWindow?.close());
}
