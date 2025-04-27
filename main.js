const { app, BrowserWindow, Notification, screen } = require('electron');
const path = require('path');
const { startMonitoring } = require('./monitor.js');

let blurWindow = null;

function createBlurWindow() {
  if (blurWindow) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  blurWindow = new BrowserWindow({
    width,
    height,
    x: primaryDisplay.bounds.x,
    y: primaryDisplay.bounds.y,
    fullscreen: true,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    }
  });

  blurWindow.loadFile('blurOverlay.html')
    .then(() => console.log('✅ Blur overlay window opened.'))
    .catch(err => console.error('Failed to load blurOverlay.html:', err));

  blurWindow.setIgnoreMouseEvents(true); // Allow clicks to pass through
}

function closeBlurWindow() {
  if (blurWindow) {
    blurWindow.close();
    blurWindow = null;
    console.log('❌ Blur overlay window closed.');
  }
}

function showNotification() {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: 'Privacy Guardian Alert',
      body: 'A harmful app was detected! Screen has been blurred for your protection.',
      icon: path.join(__dirname, 'icon.png'),
      silent: false,
    });

    notification.show();
  } else {
    console.log('⚠️ Notifications are not supported on this platform.');
  }
}

app.whenReady().then(() => {
  startMonitoring(() => {
    createBlurWindow();
    showNotification();
  }, closeBlurWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && blurWindow === null) {
      // No need to create the blurWindow on activate unless you want it always on
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
