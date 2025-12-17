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
            contextIsolation: false,
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.setAlwaysOnTop(true, 'floating');
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
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

ipcMain.on('close-window', () => {
    if (mainWindow) {
        mainWindow.close();
    }
});

// Window size states
const SMALL_SIZE = { width: 400, height: 660 };
const LARGE_SIZE = { width: 550, height: 940 };
const MIN_SIZE = {
    width: Math.round(SMALL_SIZE.width / 1.2),
    height: Math.round(SMALL_SIZE.height / 1.2)
};

// size cycle order:
// small -> big
// big -> small
// small -> min
// min -> small
let currentSizeState = 'small'; // 'min' | 'small' | 'large'
let lastSmallToggleTarget = 'large'; // 'large' | 'min' (controls what SMALL toggles to next)
let savedPosition = null;

ipcMain.on('maximize-window', () => {
    if (!mainWindow) return;

    const bounds = mainWindow.getBounds();
    const display = screen.getPrimaryDisplay();
    const screenWidth = display.workAreaSize.width;

    // Detect if window is on right or left side of screen (based on current bounds)
    const windowCenterX = bounds.x + bounds.width / 2;
    const isOnRightSide = windowCenterX > screenWidth / 2;

    // Decide next state based on requested behavior
    let nextState;
    if (currentSizeState === 'large') {
        nextState = 'small';
        lastSmallToggleTarget = 'min';
    } else if (currentSizeState === 'min') {
        nextState = 'small';
        lastSmallToggleTarget = 'large';
    } else {
        // current is SMALL
        nextState = lastSmallToggleTarget;
    }

    const targetSize =
        nextState === 'min' ? MIN_SIZE :
            nextState === 'small' ? SMALL_SIZE :
                LARGE_SIZE;

    // Save position when leaving SMALL for another mode (so we can restore to it later)
    if (currentSizeState === 'small' && nextState !== 'small') {
        savedPosition = { x: bounds.x, y: bounds.y };
    }

    // If returning to SMALL, prefer restoring the saved position
    let newX = bounds.x;
    let newY = bounds.y;

    if (nextState === 'small' && savedPosition) {
        newX = savedPosition.x;
        newY = savedPosition.y;
        savedPosition = null;
    } else {
        // For min/large transitions: keep the same y, and grow/shrink from the side
        // If the window is on the right side, adjust x so resizing happens to the left.
        if (isOnRightSide) {
            newX = bounds.x + (bounds.width - targetSize.width);
        }
    }

    // Disable CSS transitions before resize
    mainWindow.webContents.send('disable-transitions');

    // Apply new bounds
    mainWindow.setBounds({
        x: newX,
        y: newY,
        width: targetSize.width,
        height: targetSize.height
    }, true);

    // Re-enable transitions after a short delay
    setTimeout(() => {
        mainWindow.webContents.send('enable-transitions');
    }, 100);

    currentSizeState = nextState;
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
