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
    frame: false, 
    transparent: true, 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false 
    }
  });

  // EXE açıldığında artık desktop.html dosyasını okuyacak
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

ipcMain.on('window-minimize', () => {
  if(mainWindow) mainWindow.minimize();
});

ipcMain.on('window-close', () => {
  if(mainWindow) mainWindow.close();
});
