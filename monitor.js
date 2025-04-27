const { exec } = require('child_process');

const blackList = [
  'keylogger.exe',
  'spyapp.exe',
  'somebadapp.exe',
  'screenrecorder.exe',
  'remoteaccess.exe',
];

// Return array of running process names on Windows
function currentProcess() {
  return new Promise((resolve, reject) => {
    exec('tasklist', (err, stdout, stderr) => {
      if (err) return reject(err);

      const processes = stdout
        .split('\n')
        .slice(3) // skip headers
        .map(line => line.trim().split(/\s+/)[0]) // first word = process name
        .filter(name => name); // remove empty

      resolve(processes);
    });
  });
}

async function scan() {
  try {
    const processes = await currentProcess();

    // For exact matches (recommended)
    const processesLower = processes.map(p => p.toLowerCase());
    const blackListLower = blackList.map(app => app.toLowerCase());

    for (const badApp of blackListLower) {
      if (processesLower.includes(badApp)) {
        console.log(`🛑 Detected harmful app: ${badApp}`);
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('Error scanning processes:', err);
    return false;
  }
}

function startMonitoring(openBlur, closeBlur) {
  let blurActive = false;

  async function check() {
    try {
      const harmfulDetected = await scan();

      if (harmfulDetected && !blurActive) {
        openBlur();
        blurActive = true;
      } else if (!harmfulDetected && blurActive) {
        closeBlur();
        blurActive = false;
      }
    } catch (err) {
      console.error('Error during monitoring check:', err);
    }
  }

  check(); // initial check
  setInterval(check, 5000);
  console.log('Guardian started...');
}

module.exports = { startMonitoring };
