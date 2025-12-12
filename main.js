const { app, BrowserWindow, powerSaveBlocker, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let powerSaveBlockerId = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 500,
        minWidth: 300,
        minHeight: 320,
        alwaysOnTop: true,
        frame: false,
        transparent: true,
        resizable: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.setAlwaysOnTop(true, 'floating');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC handlers for power save blocker
ipcMain.on('start-power-save-blocker', () => {
    if (powerSaveBlockerId === null) {
        powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
        console.log('Power save blocker started:', powerSaveBlockerId);
    }
});

ipcMain.on('stop-power-save-blocker', () => {
    if (powerSaveBlockerId !== null) {
        powerSaveBlocker.stop(powerSaveBlockerId);
        console.log('Power save blocker stopped:', powerSaveBlockerId);
        powerSaveBlockerId = null;
    }
});
