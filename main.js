const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;

// Windows hata mesajlarını tamamen kapat
dialog.showErrorBox = function(title, content) {
    console.log(`Hata engellendi: ${title} - ${content}`);
};

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: false, 
    transparent: true, 
    icon: path.join(__dirname, 'icon.ico'), // Uygulama ikonu
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false 
    }
  });

  mainWindow.loadFile('desktop.html');
  mainWindow.on('unresponsive', (e) => { e.preventDefault(); });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Arayüzden gelen Küçült, Büyüt ve Kapatma komutları
ipcMain.on('window-minimize', () => {
  if(mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if(mainWindow) {
    if(mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  if(mainWindow) mainWindow.close();
});
