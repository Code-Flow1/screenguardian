import fs from 'fs';
import path from 'path';
import { exec, execSync } from 'child_process';
import { app, BrowserWindow, ipcMain, Notification } from 'electron';

const logFile = path.join('.', 'logs.txt');

// Configuration
const config = {
    blackList: [
        'keylogger.exe',
        'spyapp.exe',
        'somebadapp.exe',
        'screenrecorder.exe',
        'remoteaccess.exe',
    ],
    trackedSites: [
        'facebook.com',
        'youtube.com',
        'twitter.com',
        'instagram.com',
        'reddit.com',
    ],
    timeoutDuration: 10000, // 10 seconds
    useExternalBrowserExtension: false, // Flag to indicate if using extension
};

let blurWindow = null;
let manualOverride = false;
let isScanning = true;
let timeoutId = null;
let mainWindow; //  Declare mainWindow

// Logs event with timestamp to logs.txt and console/
function logEvent(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.log(logMessage.trim());
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('log-message', logMessage); // Send to renderer
    }
}

// Create Electron blur window
function createBlurWindow() {
    if (blurWindow) return;

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
        clearTimeout(timeoutId);
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

// Function to display a notification
function showNotification(title, body) {
    if (Notification.isSupported()) {
        new Notification({
            title: title,
            body: body,
        }).show();
    } else {
        logEvent(`Notification not supported: ${title} - ${body}`);
    }
}

// Function to get open browser tabs
function getOpenTabs() {
    const openTabs = [];
    const windows = BrowserWindow.getAllWindows();

    for (const win of windows) {
        if (!win.isDestroyed()) {
            const contents = win.webContents;
            if (!contents.isDestroyed()) {
                const url = contents.getURL();
                try {
                    const parsedURL = new URL(url);
                    openTabs.push(parsedURL.hostname);
                } catch (e) {
                    logEvent(`Invalid URL: ${url} - ${e.message}`);
                }
            }
        }
    }
    return openTabs;
}

// Main loop scanning running processes and browser tabs
async function scanAndBlur() {
    if (!isScanning) return;

    logEvent('Scanning for harmful apps and sites...');
    try {
        if (manualOverride) {
            // Do *not* return here. We still want to scan.
        }

        let harmfulDetected = false;
        let detectedProcess = '';
        let detectedSite = '';

        // Check for harmful processes
        const processes = await getRunningProcesses();
        for (const processName of processes) {
            if (config.blackList.some((appName) =>
                processName.toLowerCase().includes(appName.toLowerCase())
            )) {
                harmfulDetected = true;
                detectedProcess = processName;
                break;
            }
        }

        // Check for harmful sites
        const openTabs = getOpenTabs();
        for (const tab of openTabs) {
            const tabDomain = tab.toLowerCase();
            if (config.trackedSites.some((site) => tabDomain.includes(site.toLowerCase()))) {
                harmfulDetected = true;
                detectedSite = tab;
                break;
            }
        }

        if (harmfulDetected) {
            if (detectedProcess) {
                logEvent(`Detected harmful app running: ${detectedProcess}`);
                showNotification('Harmful App Detected', `Please close ${detectedProcess} immediately.`);
            } else if (detectedSite) {
                logEvent(`Detected harmful site: ${detectedSite}`);
                // Clear any existing timeout
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                // Set a timeout to display the blur window
                timeoutId = setTimeout(() => {
                    createBlurWindow();
                    timeoutId = null;
                }, config.timeoutDuration);
            }
        } else {
            // No harmful activity
            logEvent('Scan complete: No harmful apps or sites detected.');
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            closeBlurWindow();
        }
    } catch (err) {
        logEvent(`Error during scanning: ${err.message}`);
    }
}

app.whenReady().then(() => {
    // Create the main window
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
    mainWindow.loadFile('index.html'); //  Load a basic HTML file

    // Add IPC listener for close button click
    ipcMain.on('close-blur', () => {
        logEvent('User manually closed blur overlay');
        manualOverride = true;
        closeBlurWindow();
        clearTimeout(timeoutId);
    });

    //  IPC handler for receiving site data from a browser extension (EXAMPLE)
    ipcMain.on('detected-site-from-extension', (event, siteData) => {
        logEvent(`Received site data from extension: ${siteData}`);
        //  In a real implementation, validate the siteData!
        if (config.trackedSites.some((trackedSite) => siteData.toLowerCase().includes(trackedSite.toLowerCase()))) {
            //  Consider only showing blur if the main window is focused.
            createBlurWindow(); //  Show the blur
        }
    });

    // Run first scan immediately
    scanAndBlur();

    // Then run every 15 seconds
    setInterval(scanAndBlur, 15000);

    logEvent('Privacy Guardian started. Monitoring apps and sites...');
});

app.on('window-all-closed', () => {
    //  Do not quit; keep scanning.
    if (process.platform !== 'darwin') {
        //app.quit();  //  Comment out to keep running
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        scanAndBlur();
    }
});
