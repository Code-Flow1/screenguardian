import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { app, BrowserWindow, ipcMain } from 'electron';

const logFile = path.join('.', 'logs.txt');
const blackList = [
    'keylogger.exe',
    'spyapp.exe',
    'somebadapp.exe',
    'screenrecorder.exe',
    'remoteaccess.exe',
];

let blurWindow = null;
let manualOverride = false;
let isScanning = true; // Add a flag to control scanning

// Logs event with timestamp to logs.txt and console
function logEvent(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.log(logMessage.trim());
}

// Create Electron blur window
function createBlurWindow() {
    if (blurWindow) return; // Don't create if it already exists

    blurWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        x: 0,
        y: 0,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        fullscreen: true,
        skipTaskbar: true,
        focusable: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    blurWindow.loadFile('blurOverlay.html');

    blurWindow.on('closed', () => {
        blurWindow = null;
        logEvent('Blur overlay window closed');
    });

    logEvent('Blur overlay window opened');
}

// Close the blur overlay window
function closeBlurWindow() {
    if (blurWindow) {
        blurWindow.close();
        blurWindow = null;
    }
}

// Returns a Promise resolving to a list of running process names on Windows
function getRunningProcesses() {
    return new Promise((resolve, reject) => {
        exec('tasklist', (err, stdout, stderr) => {
            if (err) {
                reject(err);
                return;
            }
            const processes = stdout
                .split('\n')
                .slice(3)
                .map((line) => line.trim().split(/\s+/)[0])
                .filter((name) => name);
            resolve(processes);
        });
    });
}

// Main loop scanning running processes and controlling blur overlay
async function scanAndBlur() {
    if (!isScanning) return; // Stop scanning if flag is false

    console.log('Scanning for harmful apps...');
    try {
        if (manualOverride) {
            //  Do not return here.  Continue to scan, but prevent window creation.
            //  return;
        }

        let harmfulDetected = false;
        let detectedProcess = '';
        const processes = await getRunningProcesses();

        for (const processName of processes) {
            if (blackList.some((appName) =>
                processName.toLowerCase().includes(appName.toLowerCase())
            )) {
                harmfulDetected = true;
                detectedProcess = processName;
                break;
            }
        }

        if (harmfulDetected) {
            logEvent(`Detected harmful app running: ${detectedProcess}`);
            createBlurWindow();
        } else {
            closeBlurWindow();
        }
    } catch (err) {
        logEvent(`Error during scanning: ${err.message}`);
    }
}

app.whenReady().then(() => {
    // Add IPC listener for close button click
    ipcMain.on('close-blur', () => {
        logEvent('User manually closed blur overlay');
        manualOverride = true; // Set override flag
        closeBlurWindow();
        //  Removed  isScanning = false;  The scanner should keep running!
    });

    // Run first scan immediately
    scanAndBlur();

    // Then run every 15 seconds (15000 milliseconds)
    setInterval(scanAndBlur, 15000);

    console.log('Privacy Guardian started. Monitoring harmful apps...');
});

// Quit only when the main window is closed.  Keep scanning in background.
app.on('window-all-closed', () => {
    //  Do not quit; keep scanning.
});

// Recreate window if dock icon is clicked (macOS)
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        scanAndBlur(); // Call scanAndBlur to re-create the blur window if necessary.  Important.
    }
});
