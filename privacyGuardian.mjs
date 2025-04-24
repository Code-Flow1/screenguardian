import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { DesktopUseClient } from 'desktop-use';  // Screenpipe client

const client = new DesktopUseClient(); // Initialize Screenpipe client

const logFile = path.join('.', 'logs.txt');

const blackList = [
  'keylogger.exe',
  'spyapp.exe',
  'somebadapp.exe',
  'screenrecorder.exe',
  'remoteaccess.exe',
];

let blurWindow = null;

// Logs event with timestamp to logs.txt and console
function logEvent(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFile, logMessage);
  console.log(logMessage.trim());
}

// Opens a fullscreen transparent blur overlay window using Screenpipe
async function createBlurWindow() {
  if (blurWindow) return; // Already open, do nothing

  const blurHtmlPath = path.resolve('./blurOverlay.html');
  const blurHtmlUrl = `file://${blurHtmlPath}`;

  blurWindow = await client.openWindow({
    url: blurHtmlUrl,
    alwaysOnTop: true,
    transparent: true,
    fullscreen: true,
    frame: false,
    skipTaskbar: true,
    focusable: false,
  });

  console.log('Blur overlay window opened.');
}

// Closes the blur overlay window if open
async function closeBlurWindow() {
  if (blurWindow) {
    await blurWindow.close();
    blurWindow = null;
    console.log('Blur overlay window closed.');
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
        .slice(3) // Skip header rows
        .map(line => line.trim().split(/\s+/)[0]) // Get process name only
        .filter(name => name);
      resolve(processes);
    });
  });
}

// Main loop scanning running processes and controlling blur overlay
async function scanAndBlur() {
  console.log('Scanning for harmful apps...');  // Debug log to confirm interval runs
  try {
    let harmfulDetected = false;

    const processes = await getRunningProcesses();

    for (const processName of processes) {
      // Check if process name contains any blacklisted app name (case-insensitive)
      if (blackList.some(appName => processName.toLowerCase().includes(appName.toLowerCase()))) {
        harmfulDetected = true;
        logEvent(`Detected harmful app running: ${processName}`);
        break; // Stop checking once found
      }
    }

    if (harmfulDetected) {
      await createBlurWindow();
    } else {
      await closeBlurWindow();
    }
  } catch (err) {
    logEvent(`Error during scanning: ${err.message}`);
  }
}

// Run first scan immediately
scanAndBlur();

// Then run every 15 seconds (15000 milliseconds)
setInterval(scanAndBlur, 15000);

console.log('Privacy Guardian started. Monitoring harmful apps...');
