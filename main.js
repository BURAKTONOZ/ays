const { app, BrowserWindow, ipcMain, dialog } = require('electron');

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
    frame: false, // Windows çerçevesini (X, küçült tuşları) tamamen kaldırır
    transparent: true, // Yuvarlak hatlı pencere tasarımı için gerekli
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false // HTML/JS içinden X ve - tuşlarını kontrol edebilmemiz için gerekli
    }
  });

  mainWindow.loadFile('index.html');

  // Yanıt vermeme durumlarında Windows uyarılarını gizle
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

// Arayüzden (HTML) gelen Küçültme ve Kapatma komutlarını dinle
ipcMain.on('window-minimize', () => {
  if(mainWindow) mainWindow.minimize();
});

ipcMain.on('window-close', () => {
  if(mainWindow) mainWindow.close();
});
