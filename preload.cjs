const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  getVersion: () => process.env.npm_package_version || '1.0.0',
  getPlatform: () => process.platform,
  on: (channel, func) => {
    const validChannels = ['app-ready', 'signal-update'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
});
