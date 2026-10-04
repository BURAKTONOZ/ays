const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;

// Windows hata mesajlarını sustur
dialog.showErrorBox = function(title, content) {
    console.log(`Hata engellendi: ${title} - ${content}`);
};

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
      frame: false, // Windows penceresini kapatır
      transparent: true, // Yuvarlatılmış köşelerin çalışmasını sağlar
      icon: path.join(__dirname, 'icon.ico'),
      webPreferences: {
        nodeIntegration: true, 
        contextIsolation: false 
      }
    });
    mainWindow.loadFile('desktop.html');
  }

  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

  // Üst Bardan Gelen Komutlar
  ipcMain.on('window-minimize', () => { if(mainWindow) mainWindow.minimize(); });
  ipcMain.on('window-maximize', () => {
    if(mainWindow) { mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); }
  });
  ipcMain.on('window-close', () => { if(mainWindow) mainWindow.close(); });
}
