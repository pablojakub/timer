const { app, BrowserWindow, powerSaveBlocker, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow;
let powerSaveBlockerId = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 660,
        minWidth: 300,
        minHeight: 320,
        alwaysOnTop: true,
        frame: false,
        transparent: true,
        resizable: false,
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

// IPC handlers for window controls
ipcMain.on('minimize-window', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

// Window size states
const SMALL_SIZE = { width: 400, height: 660 };
const LARGE_SIZE = { width: 600, height: 990 };
let isLargeSize = false;
let savedPosition = null;

ipcMain.on('maximize-window', () => {
    if (mainWindow) {
        const bounds = mainWindow.getBounds();
        const display = screen.getPrimaryDisplay();
        const screenWidth = display.workAreaSize.width;

        if (isLargeSize) {
            // Return to small size at saved position
            if (savedPosition) {
                mainWindow.setBounds({
                    x: savedPosition.x,
                    y: savedPosition.y,
                    width: SMALL_SIZE.width,
                    height: SMALL_SIZE.height
                });
                savedPosition = null;
            } else {
                mainWindow.setSize(SMALL_SIZE.width, SMALL_SIZE.height);
            }
            isLargeSize = false;
        } else {
            // Save current position
            savedPosition = { x: bounds.x, y: bounds.y };

            // Detect if window is on right or left side of screen
            const windowCenterX = bounds.x + bounds.width / 2;
            const isOnRightSide = windowCenterX > screenWidth / 2;

            // Calculate new position based on side
            let newX, newY;
            if (isOnRightSide) {
                // Window on right side - grow to the left
                newX = bounds.x - (LARGE_SIZE.width - SMALL_SIZE.width);
            } else {
                // Window on left side - grow to the right (keep same x)
                newX = bounds.x;
            }
            newY = bounds.y; // Keep same y position

            // Set new size and position
            mainWindow.setBounds({
                x: newX,
                y: newY,
                width: LARGE_SIZE.width,
                height: LARGE_SIZE.height
            });
            isLargeSize = true;
        }
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
