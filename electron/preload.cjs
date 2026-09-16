const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('brew', {
  getState: () => ipcRenderer.invoke('brew:get'),
  dispatch: action => ipcRenderer.invoke('brew:action', action),
  togglePanel: () => ipcRenderer.invoke('brew:panel'),
  hidePanel: () => ipcRenderer.invoke('brew:hide'),
  gesture: (phase, mode) => ipcRenderer.invoke('brew:gesture', phase, mode),
  nudge: (x, y, size) => ipcRenderer.invoke('brew:nudge', x, y, size),
  exportData: () => ipcRenderer.invoke('brew:export'),
  onState: callback => { const listener = (_, value) => callback(value); ipcRenderer.on('brew:state', listener); return () => ipcRenderer.removeListener('brew:state', listener); },
  onReminder: callback => { const listener = () => callback(); ipcRenderer.on('brew:reminder', listener); return () => ipcRenderer.removeListener('brew:reminder', listener); }
});
