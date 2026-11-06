// Gives the game the same window.IconApp updater bridge the Android app provides,
// and tags the page as the PC app (body.pcapp) so the update button shows while
// browser-only features like "Scan a real folder" stay available.
const { contextBridge, ipcRenderer } = require('electron');

const version = ipcRenderer.sendSync('sync-version');
contextBridge.exposeInMainWorld('IconApp', {
  checkForUpdate: userAsked => ipcRenderer.send('upd-check', !!userAsked),
  installUpdate: () => ipcRenderer.send('upd-install'),
  openUpdateInBrowser: () => ipcRenderer.send('upd-browser'),
  version: () => version,
  platform: 'pc',
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  quit: () => ipcRenderer.send('quit'),
  onUpdateStatus: cb => { listener = cb; if (last) cb(last); },
});
let listener = null, last = null;
ipcRenderer.on('update-status', (e, st) => { last = st; if (listener) listener(st); });
// (the context-isolated preload can't call the page's functions, so the game subscribes instead)
window.addEventListener('DOMContentLoaded', () => document.body.classList.add('pcapp'));
