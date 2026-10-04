const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;

// Windows hata pencerelerini susturur
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
      frame: false, // Windows penceresini tamamen iptal eder
      transparent: false,
      backgroundColor: '#0a0f1f',
      icon: path.join(__dirname, 'icon.ico'),
      webPreferences: {
        nodeIntegration: true, 
        contextIsolation: false // Buton iletişimini aktif eder
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
