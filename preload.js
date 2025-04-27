const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openBlur: () => ipcRenderer.send('open-blur'),
  closeBlur: () => ipcRenderer.send('close-blur')
});
